/*
Copyright 2023 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import * as path from "path";
import * as os from "os";
import * as crypto from "crypto";
import * as fse from "fs-extra";
import { APIRequestContext } from "@playwright/test";

import { getFreePort } from "../utils/port";
import { Docker } from "../docker";
import {
    HomeserverConfig,
    HomeserverInstance,
    Homeserver,
    StartHomeserverOpts,
    Credentials,
} from "../utils/homeserver";

function randB64Bytes(numBytes: number): string {
    return crypto.randomBytes(numBytes).toString("base64").replace(/=*$/, "");
}

async function cfgDirFromTemplate(
    opts: StartHomeserverOpts,
): Promise<HomeserverConfig & { registrationSecret: string }> {
    const templateDir = path.join(__dirname, "templates", opts.template);

    const stats = await fse.stat(templateDir);
    if (!stats?.isDirectory) {
        throw new Error(`No such template: ${opts.template}`);
    }
    const tempDir = await fse.mkdtemp(path.join(os.tmpdir(), "react-sdk-synapsedocker-"));

    // copy the contents of the template dir, omitting homeserver.yaml as we'll template that
    console.log(`Copy ${templateDir} -> ${tempDir}`);
    await fse.copy(templateDir, tempDir, { filter: (f) => path.basename(f) !== "homeserver.yaml" });

    const registrationSecret = randB64Bytes(16);
    const macaroonSecret = randB64Bytes(16);
    const formSecret = randB64Bytes(16);

    const port = await getFreePort();
    const baseUrl = `http://localhost:${port}`;

    // now copy homeserver.yaml, applying substitutions
    const templateHomeserver = path.join(templateDir, "homeserver.yaml");
    const outputHomeserver = path.join(tempDir, "homeserver.yaml");
    console.log(`Gen ${templateHomeserver} -> ${outputHomeserver}`);
    let hsYaml = await fse.readFile(templateHomeserver, "utf8");
    hsYaml = hsYaml.replace(/{{REGISTRATION_SECRET}}/g, registrationSecret);
    hsYaml = hsYaml.replace(/{{MACAROON_SECRET_KEY}}/g, macaroonSecret);
    hsYaml = hsYaml.replace(/{{FORM_SECRET}}/g, formSecret);
    hsYaml = hsYaml.replace(/{{PUBLIC_BASEURL}}/g, baseUrl);
    if (opts.oAuthServerPort) {
        hsYaml = hsYaml.replace(/{{OAUTH_SERVER_PORT}}/g, opts.oAuthServerPort.toString());
    }
    hsYaml = hsYaml.replace(/{{HOST_DOCKER_INTERNAL}}/g, await Docker.hostnameOfHost());
    if (opts.variables) {
        let fetchedHostContainer: Awaited<ReturnType<typeof Docker.hostnameOfHost>> | null = null;
        for (const key in opts.variables) {
            let value = String(opts.variables[key]);

            if (value === "{{HOST_DOCKER_INTERNAL}}") {
                if (!fetchedHostContainer) {
                    fetchedHostContainer = await Docker.hostnameOfHost();
                }
                value = fetchedHostContainer;
            }

            hsYaml = hsYaml.replace(new RegExp("%" + key + "%", "g"), value);
        }
    }

    await fse.writeFile(outputHomeserver, hsYaml);

    // now generate a signing key (we could use synapse's config generation for
    // this, or we could just do this...)
    // NB. This assumes the homeserver.yaml specifies the key in this location
    const signingKey = randB64Bytes(32);
    const outputSigningKey = path.join(tempDir, "localhost.signing.key");
    console.log(`Gen -> ${outputSigningKey}`);
    await fse.writeFile(outputSigningKey, `ed25519 x ${signingKey}`);

    return {
        port,
        baseUrl,
        configDir: tempDir,
        registrationSecret,
    };
}

export class Synapse implements Homeserver, HomeserverInstance {
    private docker: Docker = new Docker();
    public config: HomeserverConfig & { serverId: string; registrationSecret: string };

    public constructor(private readonly request: APIRequestContext) {}

    /**
     * Start a synapse instance: the template must be the name of
     * one of the templates in the playwright/plugins/synapsedocker/templates
     * directory.
     *
     * Any value in opts.variables that is set to `{{HOST_DOCKER_INTERNAL}}'
     * will be replaced with 'host.docker.internal' (if we are on Docker) or
     * 'host.containers.internal' if we are on Podman.
     */
    public async start(opts: StartHomeserverOpts): Promise<HomeserverInstance> {
        if (this.config) await this.stop();

        const synCfg = await cfgDirFromTemplate(opts);
        console.log(`Starting synapse with config dir ${synCfg.configDir}...`);
        const dockerSynapseParams = ["--rm", "-v", `${synCfg.configDir}:/data`, "-p", `${synCfg.port}:8008/tcp`];
        if (await Docker.isPodman()) {
            // Make host.containers.internal work to allow Synapse to talk to the test OIDC server.
            dockerSynapseParams.push("--network");
            dockerSynapseParams.push("slirp4netns:allow_host_loopback=true");
        } else {
            // Make host.docker.internal work to allow Synapse to talk to the test OIDC server.
            dockerSynapseParams.push("--add-host");
            dockerSynapseParams.push("host.docker.internal:host-gateway");
        }
        const synapseId = await this.docker.run({
            image: "matrixdotorg/synapse:develop",
            containerName: `react-sdk-playwright-synapse`,
            params: dockerSynapseParams,
            cmd: ["run"],
        });
        console.log(`Started synapse with id ${synapseId} on port ${synCfg.port}.`);
        // Await Synapse healthcheck
        await this.docker.exec([
            "curl",
            "--connect-timeout",
            "30",
            "--retry",
            "30",
            "--retry-delay",
            "1",
            "--retry-all-errors",
            "--silent",
            "http://localhost:8008/health",
        ]);

        this.config = {
            ...synCfg,
            serverId: synapseId,
        };
        return this;
    }

    public async stop(): Promise<void> {
        if (!this.config) throw new Error("Missing existing synapse instance, did you call stop() before start()?");
        const id = this.config.serverId;
        const synapseLogsPath = path.join("playwright", "synapselogs", id);
        await fse.ensureDir(synapseLogsPath);
        await this.docker.persistLogsToFile({
            stdoutFile: path.join(synapseLogsPath, "stdout.log"),
            stderrFile: path.join(synapseLogsPath, "stderr.log"),
        });
        await this.docker.stop();
        await fse.remove(this.config.configDir);
        console.log(`Stopped synapse id ${id}.`);
    }

    public async registerUser(username: string, password: string, displayName?: string): Promise<Credentials> {
        const url = `${this.config.baseUrl}/_synapse/admin/v1/register`;
        const { nonce } = await this.request.get(url).then((r) => r.json());
        const mac = crypto
            .createHmac("sha1", this.config.registrationSecret)
            .update(`${nonce}\0${username}\0${password}\0notadmin`)
            .digest("hex");
        const res = await this.request.post(url, {
            data: {
                nonce,
                username,
                password,
                mac,
                admin: false,
                displayname: displayName,
            },
        });

        const data = await res.json();
        return {
            homeServer: data.home_server,
            accessToken: data.access_token,
            userId: data.user_id,
            deviceId: data.device_id,
            password,
        };
    }
}

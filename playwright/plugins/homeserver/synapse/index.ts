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

import * as path from "node:path";
import * as os from "node:os";
import * as crypto from "node:crypto";
import * as fse from "fs-extra";
import { APIRequestContext } from "@playwright/test";

import { getFreePort } from "../../utils/port";
import { Docker } from "../../docker";
import { HomeserverConfig, HomeserverInstance, Homeserver, StartHomeserverOpts, Credentials } from "..";
import { randB64Bytes } from "../../utils/rand";

async function cfgDirFromTemplate(opts: StartHomeserverOpts): Promise<Omit<HomeserverConfig, "dockerUrl">> {
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
    if (opts.variables) {
        for (const key in opts.variables) {
            hsYaml = hsYaml.replace(new RegExp("%" + key + "%", "g"), String(opts.variables[key]));
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

    // Allow anyone to read, write and execute in the /temp/react-sdk-synapsedocker-xxx directory
    // so that the DIND setup that we use to update the playwright screenshots work without any issues.
    await fse.chmod(tempDir, 0o757);

    return {
        port,
        baseUrl,
        configDir: tempDir,
        registrationSecret,
    };
}

export class Synapse implements Homeserver, HomeserverInstance {
    protected docker: Docker = new Docker();
    public config: HomeserverConfig & { serverId: string };

    public constructor(private readonly request: APIRequestContext) {}

    /**
     * Start a synapse instance: the template must be the name of
     * one of the templates in the playwright/plugins/synapsedocker/templates
     * directory.
     */
    public async start(opts: StartHomeserverOpts): Promise<HomeserverInstance> {
        if (this.config) await this.stop();

        const synCfg = await cfgDirFromTemplate(opts);
        console.log(`Starting synapse with config dir ${synCfg.configDir}...`);
        const dockerSynapseParams = ["-v", `${synCfg.configDir}:/data`, "-p", `${synCfg.port}:8008/tcp`];
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
        const dockerUrl = `http://${await this.docker.getContainerIp()}:8008`;
        this.config = {
            ...synCfg,
            serverId: synapseId,
            dockerUrl,
        };
        return this;
    }

    public async stop(): Promise<string[]> {
        if (!this.config) throw new Error("Missing existing synapse instance, did you call stop() before start()?");
        const id = this.config.serverId;
        const synapseLogsPath = path.join("playwright", "logs", "synapse", id);
        await fse.ensureDir(synapseLogsPath);
        await this.docker.persistLogsToFile({
            stdoutFile: path.join(synapseLogsPath, "stdout.log"),
            stderrFile: path.join(synapseLogsPath, "stderr.log"),
        });
        await this.docker.stop();
        await fse.remove(this.config.configDir);
        console.log(`Stopped synapse id ${id}.`);

        return [path.join(synapseLogsPath, "stdout.log"), path.join(synapseLogsPath, "stderr.log")];
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

        if (!res.ok()) {
            throw await res.json();
        }

        const data = await res.json();
        return {
            homeServer: data.home_server,
            accessToken: data.access_token,
            userId: data.user_id,
            deviceId: data.device_id,
            password,
            displayName,
        };
    }

    public async loginUser(userId: string, password: string): Promise<Credentials> {
        const url = `${this.config.baseUrl}/_matrix/client/v3/login`;
        const res = await this.request.post(url, {
            data: {
                type: "m.login.password",
                identifier: {
                    type: "m.id.user",
                    user: userId,
                },
                password: password,
            },
        });
        const json = await res.json();

        return {
            password,
            accessToken: json.access_token,
            userId: json.user_id,
            deviceId: json.device_id,
            homeServer: json.home_server,
        };
    }
}

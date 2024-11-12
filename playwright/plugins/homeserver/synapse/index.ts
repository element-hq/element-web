/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
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

// Docker tag to use for synapse docker image.
// We target a specific digest as every now and then a Synapse update will break our CI.
// This digest is updated by the playwright-image-updates.yaml workflow periodically.
const DOCKER_TAG = "develop@sha256:7ab3cd9f4d167b47288c6704ed455046b67b5a5097c843ddfbcbc6d3a03ff76f";

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

    private adminToken?: string;

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
            image: `ghcr.io/element-hq/synapse:${DOCKER_TAG}`,
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

    private async registerUserInternal(
        username: string,
        password: string,
        displayName?: string,
        admin = false,
    ): Promise<Credentials> {
        const url = `${this.config.baseUrl}/_synapse/admin/v1/register`;
        const { nonce } = await this.request.get(url).then((r) => r.json());
        const mac = crypto
            .createHmac("sha1", this.config.registrationSecret)
            .update(`${nonce}\0${username}\0${password}\0${admin ? "" : "not"}admin`)
            .digest("hex");
        const res = await this.request.post(url, {
            data: {
                nonce,
                username,
                password,
                mac,
                admin,
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

    public registerUser(username: string, password: string, displayName?: string): Promise<Credentials> {
        return this.registerUserInternal(username, password, displayName, false);
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

    public async setThreepid(userId: string, medium: string, address: string): Promise<void> {
        if (this.adminToken === undefined) {
            const result = await this.registerUserInternal("admin", "totalyinsecureadminpassword", undefined, true);
            this.adminToken = result.accessToken;
        }

        const url = `${this.config.baseUrl}/_synapse/admin/v2/users/${userId}`;
        const res = await this.request.put(url, {
            data: {
                threepids: [
                    {
                        medium,
                        address,
                    },
                ],
            },
            headers: {
                Authorization: `Bearer ${this.adminToken}`,
            },
        });

        if (!res.ok()) {
            throw await res.json();
        }
    }
}

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

import path, { basename } from "node:path";
import os from "node:os";
import * as fse from "fs-extra";
import { BrowserContext, TestInfo } from "@playwright/test";

import { getFreePort } from "../utils/port";
import { Docker } from "../docker";
import { PG_PASSWORD, PostgresDocker } from "../postgres";
import { HomeserverInstance } from "../homeserver";
import { Instance as MailhogInstance } from "../mailhog";

// Docker tag to use for `ghcr.io/matrix-org/matrix-authentication-service` image.
// We use a debug tag so that we have a shell and can run all 3 necessary commands in one run.
const TAG = "0.8.0-debug";

export interface ProxyInstance {
    containerId: string;
    postgresId: string;
    configDir: string;
    port: number;
}

async function cfgDirFromTemplate(opts: {
    postgresHost: string;
    synapseUrl: string;
    masPort: string;
    smtpPort: string;
}): Promise<{
    configDir: string;
}> {
    const configPath = path.join(__dirname, "config.yaml");
    const tempDir = await fse.mkdtemp(path.join(os.tmpdir(), "react-sdk-mas-"));

    const outputHomeserver = path.join(tempDir, "config.yaml");
    console.log(`Gen ${configPath} -> ${outputHomeserver}`);
    let config = await fse.readFile(configPath, "utf8");
    config = config.replace(/{{MAS_PORT}}/g, opts.masPort);
    config = config.replace(/{{POSTGRES_HOST}}/g, opts.postgresHost);
    config = config.replace(/{{POSTGRES_PASSWORD}}/g, PG_PASSWORD);
    config = config.replace(/%{{SMTP_PORT}}/g, opts.smtpPort);
    config = config.replace(/{{SYNAPSE_URL}}/g, opts.synapseUrl);

    await fse.writeFile(outputHomeserver, config);

    // Allow anyone to read, write and execute in the temp directory
    // so that the DIND setup that we use to update the playwright screenshots work without any issues.
    await fse.chmod(tempDir, 0o757);

    return {
        configDir: tempDir,
    };
}

export class MatrixAuthenticationService {
    private readonly masDocker = new Docker();
    private readonly postgresDocker = new PostgresDocker("mas");
    private instance: ProxyInstance;
    public port: number;

    constructor(private context: BrowserContext) {}

    async prepare(): Promise<{ port: number }> {
        this.port = await getFreePort();
        return { port: this.port };
    }

    async start(homeserver: HomeserverInstance, mailhog: MailhogInstance): Promise<ProxyInstance> {
        console.log(new Date(), "Starting mas...");

        if (!this.port) await this.prepare();
        const port = this.port;
        const { containerId: postgresId, ipAddress: postgresIp } = await this.postgresDocker.start();
        const { configDir } = await cfgDirFromTemplate({
            masPort: port.toString(),
            postgresHost: postgresIp,
            synapseUrl: homeserver.config.dockerUrl,
            smtpPort: mailhog.smtpPort.toString(),
        });

        console.log(new Date(), "starting mas container...", TAG);
        const containerId = await this.masDocker.run({
            image: "ghcr.io/matrix-org/matrix-authentication-service:" + TAG,
            containerName: "react-sdk-playwright-mas",
            params: ["-p", `${port}:8080/tcp`, "-v", `${configDir}:/config`, "--entrypoint", "sh"],
            cmd: [
                "-c",
                "mas-cli database migrate --config /config/config.yaml && " +
                    "mas-cli config sync --config /config/config.yaml && " +
                    "mas-cli server --config /config/config.yaml",
            ],
        });
        console.log(new Date(), "started!");

        // Set up redirects
        const baseUrl = `http://localhost:${port}`;
        for (const path of [
            "**/_matrix/client/*/login",
            "**/_matrix/client/*/login/**",
            "**/_matrix/client/*/logout",
            "**/_matrix/client/*/refresh",
        ]) {
            await this.context.route(path, async (route) => {
                await route.continue({
                    url: new URL(route.request().url().split("/").slice(3).join("/"), baseUrl).href,
                });
            });
        }

        this.instance = { containerId, postgresId, port, configDir };
        return this.instance;
    }

    async stop(testInfo: TestInfo): Promise<void> {
        if (!this.instance) return; // nothing to stop
        const id = this.instance.containerId;
        const logPath = path.join("playwright", "logs", "matrix-authentication-service", id);
        await fse.ensureDir(logPath);
        await this.masDocker.persistLogsToFile({
            stdoutFile: path.join(logPath, "stdout.log"),
            stderrFile: path.join(logPath, "stderr.log"),
        });

        await this.masDocker.stop();
        await this.postgresDocker.stop();

        if (testInfo.status !== "passed") {
            const logs = [path.join(logPath, "stdout.log"), path.join(logPath, "stderr.log")];
            for (const path of logs) {
                await testInfo.attach(`mas-${basename(path)}`, {
                    path,
                    contentType: "text/plain",
                });
            }
            await testInfo.attach("mas-config.yaml", {
                path: path.join(this.instance.configDir, "config.yaml"),
                contentType: "text/plain",
            });
        }

        await fse.remove(this.instance.configDir);
        console.log(new Date(), "Stopped mas.");
    }
}

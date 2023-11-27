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
import * as fse from "fs-extra";

import { getFreePort } from "../../utils/port";
import { Homeserver, HomeserverConfig, HomeserverInstance, StartHomeserverOpts } from "../";
import { randB64Bytes } from "../../utils/rand";
import { Synapse } from "../synapse";
import { Docker } from "../../docker";

const dockerConfigDir = "/etc/dendrite/";
const dendriteConfigFile = "dendrite.yaml";

// Surprisingly, Dendrite implements the same register user Admin API Synapse, so we can just extend it
export class Dendrite extends Synapse implements Homeserver, HomeserverInstance {
    public config: HomeserverConfig & { serverId: string };
    protected image = "matrixdotorg/dendrite-monolith:main";
    protected entrypoint = "/usr/bin/dendrite";

    /**
     * Start a dendrite instance: the template must be the name of one of the templates
     * in the playwright/plugins/dendritedocker/templates directory
     * @param opts
     */
    public async start(opts: StartHomeserverOpts): Promise<HomeserverInstance> {
        const denCfg = await cfgDirFromTemplate(this.image, opts);

        console.log(`Starting dendrite with config dir ${denCfg.configDir}...`);

        const dendriteId = await this.docker.run({
            image: this.image,
            params: [
                "--rm",
                "-v",
                `${denCfg.configDir}:` + dockerConfigDir,
                "-p",
                `${denCfg.port}:8008/tcp`,
                "--entrypoint",
                this.entrypoint,
            ],
            containerName: `react-sdk-playwright-dendrite`,
            cmd: ["--config", dockerConfigDir + dendriteConfigFile, "--really-enable-open-registration", "true", "run"],
        });

        console.log(`Started dendrite with id ${dendriteId} on port ${denCfg.port}.`);

        // Await Dendrite healthcheck
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
            "http://localhost:8008/_matrix/client/versions",
        ]);

        this.config = {
            ...denCfg,
            serverId: dendriteId,
        };
        return this;
    }

    public async stop(): Promise<void> {
        if (!this.config) throw new Error("Missing existing dendrite instance, did you call stop() before start()?");

        const dendriteLogsPath = path.join("playwright", "dendritelogs", this.config.serverId);
        await fse.ensureDir(dendriteLogsPath);

        await this.docker.persistLogsToFile({
            stdoutFile: path.join(dendriteLogsPath, "stdout.log"),
            stderrFile: path.join(dendriteLogsPath, "stderr.log"),
        });

        await this.docker.stop();

        await fse.remove(this.config.configDir);

        console.log(`Stopped dendrite id ${this.config.serverId}.`);
    }
}

export class Pinecone extends Dendrite {
    protected image = "matrixdotorg/dendrite-demo-pinecone:main";
    protected entrypoint = "/usr/bin/dendrite-demo-pinecone";
}

async function cfgDirFromTemplate(dendriteImage: string, opts: StartHomeserverOpts): Promise<HomeserverConfig> {
    const template = "default"; // XXX: for now we only have one template
    const templateDir = path.join(__dirname, "templates", template);

    const stats = await fse.stat(templateDir);
    if (!stats?.isDirectory) {
        throw new Error(`No such template: ${template}`);
    }
    const tempDir = await fse.mkdtemp(path.join(os.tmpdir(), "react-sdk-dendritedocker-"));

    // copy the contents of the template dir, omitting homeserver.yaml as we'll template that
    console.log(`Copy ${templateDir} -> ${tempDir}`);
    await fse.copy(templateDir, tempDir, { filter: (f) => path.basename(f) !== dendriteConfigFile });

    const registrationSecret = randB64Bytes(16);

    const port = await getFreePort();
    const baseUrl = `http://localhost:${port}`;

    // now copy homeserver.yaml, applying substitutions
    console.log(`Gen ${path.join(templateDir, dendriteConfigFile)}`);
    let hsYaml = await fse.readFile(path.join(templateDir, dendriteConfigFile), "utf8");
    hsYaml = hsYaml.replace(/{{REGISTRATION_SECRET}}/g, registrationSecret);
    await fse.writeFile(path.join(tempDir, dendriteConfigFile), hsYaml);

    const docker = new Docker();
    await docker.run({
        image: dendriteImage,
        params: ["--rm", "--entrypoint=", "-v", `${tempDir}:/mnt`],
        containerName: `react-sdk-playwright-dendrite-keygen`,
        cmd: ["/usr/bin/generate-keys", "-private-key", "/mnt/matrix_key.pem"],
    });

    return {
        port,
        baseUrl,
        configDir: tempDir,
        registrationSecret,
    };
}

export function isDendrite(): boolean {
    return process.env["PLAYWRIGHT_HOMESERVER"] === "dendrite" || process.env["PLAYWRIGHT_HOMESERVER"] === "pinecone";
}

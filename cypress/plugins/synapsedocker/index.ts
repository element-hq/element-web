/*
Copyright 2022 The Matrix.org Foundation C.I.C.

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

/// <reference types="cypress" />

import * as path from "path";
import * as os from "os";
import * as crypto from "crypto";
import * as childProcess from "child_process";
import * as fse from "fs-extra";
import * as net from "net";

import PluginEvents = Cypress.PluginEvents;
import PluginConfigOptions = Cypress.PluginConfigOptions;

// A cypress plugins to add command to start & stop synapses in
// docker with preset templates.

interface SynapseConfig {
    configDir: string;
    registrationSecret: string;
    // Synapse must be configured with its public_baseurl so we have to allocate a port & url at this stage
    baseUrl: string;
    port: number;
}

export interface SynapseInstance extends SynapseConfig {
    synapseId: string;
}

const synapses = new Map<string, SynapseInstance>();

function randB64Bytes(numBytes: number): string {
    return crypto.randomBytes(numBytes).toString("base64").replace(/=*$/, "");
}

async function getFreePort(): Promise<number> {
    return new Promise<number>(resolve => {
        const srv = net.createServer();
        srv.listen(0, () => {
            const port = (<net.AddressInfo>srv.address()).port;
            srv.close(() => resolve(port));
        });
    });
}

async function cfgDirFromTemplate(template: string): Promise<SynapseConfig> {
    const templateDir = path.join(__dirname, "templates", template);

    const stats = await fse.stat(templateDir);
    if (!stats?.isDirectory) {
        throw new Error(`No such template: ${template}`);
    }
    const tempDir = await fse.mkdtemp(path.join(os.tmpdir(), 'react-sdk-synapsedocker-'));

    // change permissions on the temp directory so the docker container can see its contents
    await fse.chmod(tempDir, 0o777);

    // copy the contents of the template dir, omitting homeserver.yaml as we'll template that
    console.log(`Copy ${templateDir} -> ${tempDir}`);
    await fse.copy(templateDir, tempDir, { filter: f => path.basename(f) !== 'homeserver.yaml' });

    const registrationSecret = randB64Bytes(16);
    const macaroonSecret = randB64Bytes(16);
    const formSecret = randB64Bytes(16);

    const port = await getFreePort();
    const baseUrl = `http://localhost:${port}`;

    // now copy homeserver.yaml, applying substitutions
    console.log(`Gen ${path.join(templateDir, "homeserver.yaml")}`);
    let hsYaml = await fse.readFile(path.join(templateDir, "homeserver.yaml"), "utf8");
    hsYaml = hsYaml.replace(/{{REGISTRATION_SECRET}}/g, registrationSecret);
    hsYaml = hsYaml.replace(/{{MACAROON_SECRET_KEY}}/g, macaroonSecret);
    hsYaml = hsYaml.replace(/{{FORM_SECRET}}/g, formSecret);
    hsYaml = hsYaml.replace(/{{PUBLIC_BASEURL}}/g, baseUrl);
    await fse.writeFile(path.join(tempDir, "homeserver.yaml"), hsYaml);

    // now generate a signing key (we could use synapse's config generation for
    // this, or we could just do this...)
    // NB. This assumes the homeserver.yaml specifies the key in this location
    const signingKey = randB64Bytes(32);
    console.log(`Gen ${path.join(templateDir, "localhost.signing.key")}`);
    await fse.writeFile(path.join(tempDir, "localhost.signing.key"), `ed25519 x ${signingKey}`);

    return {
        port,
        baseUrl,
        configDir: tempDir,
        registrationSecret,
    };
}

// Start a synapse instance: the template must be the name of
// one of the templates in the cypress/plugins/synapsedocker/templates
// directory
async function synapseStart(template: string): Promise<SynapseInstance> {
    const synCfg = await cfgDirFromTemplate(template);

    console.log(`Starting synapse with config dir ${synCfg.configDir}...`);

    const containerName = `react-sdk-cypress-synapse-${crypto.randomBytes(4).toString("hex")}`;

    const synapseId = await new Promise<string>((resolve, reject) => {
        childProcess.execFile('docker', [
            "run",
            "--name", containerName,
            "-d",
            "-v", `${synCfg.configDir}:/data`,
            "-p", `${synCfg.port}:8008/tcp`,
            "matrixdotorg/synapse:develop",
            "run",
        ], (err, stdout) => {
            if (err) reject(err);
            resolve(stdout.trim());
        });
    });

    synapses.set(synapseId, { synapseId, ...synCfg });

    console.log(`Started synapse with id ${synapseId} on port ${synCfg.port}.`);

    // Await Synapse healthcheck
    await new Promise<void>((resolve, reject) => {
        childProcess.execFile("docker", [
            "exec", synapseId,
            "curl",
            "--connect-timeout", "30",
            "--retry", "30",
            "--retry-delay", "1",
            "--retry-all-errors",
            "--silent",
            "http://localhost:8008/health",
        ], { encoding: 'utf8' }, (err, stdout) => {
            if (err) reject(err);
            else resolve();
        });
    });

    return synapses.get(synapseId);
}

async function synapseStop(id: string): Promise<void> {
    const synCfg = synapses.get(id);

    if (!synCfg) throw new Error("Unknown synapse ID");

    try {
        const synapseLogsPath = path.join("cypress", "synapselogs", id);
        await fse.ensureDir(synapseLogsPath);

        const stdoutFile = await fse.open(path.join(synapseLogsPath, "stdout.log"), "w");
        const stderrFile = await fse.open(path.join(synapseLogsPath, "stderr.log"), "w");
        await new Promise<void>((resolve, reject) => {
            childProcess.spawn('docker', [
                "logs",
                id,
            ], {
                stdio: ["ignore", stdoutFile, stderrFile],
            }).once('close', resolve);
        });
        await fse.close(stdoutFile);
        await fse.close(stderrFile);

        await new Promise<void>((resolve, reject) => {
            childProcess.execFile('docker', [
                "stop",
                id,
            ], err => {
                if (err) reject(err);
                resolve();
            });
        });
    } finally {
        await new Promise<void>((resolve, reject) => {
            childProcess.execFile('docker', [
                "rm",
                id,
            ], err => {
                if (err) reject(err);
                resolve();
            });
        });
    }

    await fse.remove(synCfg.configDir);

    synapses.delete(id);

    console.log(`Stopped synapse id ${id}.`);
    // cypress deliberately fails if you return 'undefined', so
    // return null to signal all is well and we've handled the task.
    return null;
}

/**
 * @type {Cypress.PluginConfig}
 */
export function synapseDocker(on: PluginEvents, config: PluginConfigOptions) {
    on("task", {
        synapseStart,
        synapseStop,
    });

    on("after:spec", async (spec) => {
        // Cleans up any remaining synapse instances after a spec run
        // This is on the theory that we should avoid re-using synapse
        // instances between spec runs: they should be cheap enough to
        // start that we can have a separate one for each spec run or even
        // test. If we accidentally re-use synapses, we could inadvertently
        // make our tests depend on each other.
        for (const synId of synapses.keys()) {
            console.warn(`Cleaning up synapse ID ${synId} after ${spec.name}`);
            await synapseStop(synId);
        }
    });

    on("before:run", async () => {
        // tidy up old synapse log files before each run
        await fse.emptyDir(path.join("cypress", "synapselogs"));
    });
}

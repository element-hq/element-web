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

/// <reference types="cypress" />

import PluginEvents = Cypress.PluginEvents;
import PluginConfigOptions = Cypress.PluginConfigOptions;
import { getFreePort } from "../utils/port";
import { dockerIp, dockerRun, dockerStop } from "../docker";

// A cypress plugins to add command to manage an instance of Mailhog in Docker

export interface Instance {
    host: string;
    smtpPort: number;
    httpPort: number;
    containerId: string;
}

const instances = new Map<string, Instance>();

// Start a synapse instance: the template must be the name of
// one of the templates in the cypress/plugins/synapsedocker/templates
// directory
async function mailhogStart(): Promise<Instance> {
    const smtpPort = await getFreePort();
    const httpPort = await getFreePort();

    console.log(`Starting mailhog...`);

    const containerId = await dockerRun({
        image: "mailhog/mailhog:latest",
        containerName: `react-sdk-cypress-mailhog`,
        params: ["--rm", "-p", `${smtpPort}:1025/tcp`, "-p", `${httpPort}:8025/tcp`],
    });

    console.log(`Started mailhog on ports smtp=${smtpPort} http=${httpPort}.`);

    const host = await dockerIp({ containerId });
    const instance: Instance = { smtpPort, httpPort, containerId, host };
    instances.set(containerId, instance);
    return instance;
}

async function mailhogStop(id: string): Promise<void> {
    const synCfg = instances.get(id);

    if (!synCfg) throw new Error("Unknown mailhog ID");

    await dockerStop({
        containerId: id,
    });

    instances.delete(id);

    console.log(`Stopped mailhog id ${id}.`);
    // cypress deliberately fails if you return 'undefined', so
    // return null to signal all is well, and we've handled the task.
    return null;
}

/**
 * @type {Cypress.PluginConfig}
 */
export function mailhogDocker(on: PluginEvents, config: PluginConfigOptions) {
    on("task", {
        mailhogStart,
        mailhogStop,
    });

    on("after:spec", async (spec) => {
        // Cleans up any remaining instances after a spec run
        for (const synId of instances.keys()) {
            console.warn(`Cleaning up synapse ID ${synId} after ${spec.name}`);
            await mailhogStop(synId);
        }
    });
}

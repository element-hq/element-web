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

import PluginEvents = Cypress.PluginEvents;
import PluginConfigOptions = Cypress.PluginConfigOptions;
import { dockerExec, dockerIp, dockerRun, dockerStop } from "../docker";
import { getFreePort } from "../utils/port";
import { HomeserverInstance } from "../utils/homeserver";

// A cypress plugin to add command to start & stop https://github.com/matrix-org/sliding-sync
// SLIDING_SYNC_PROXY_TAG env used as the docker tag to use for `ghcr.io/matrix-org/sliding-sync` image.

export interface ProxyInstance {
    containerId: string;
    postgresId: string;
    port: number;
}

const instances = new Map<string, ProxyInstance>();

const PG_PASSWORD = "p4S5w0rD";

async function proxyStart(dockerTag: string, homeserver: HomeserverInstance): Promise<ProxyInstance> {
    console.log(new Date(), "Starting sliding sync proxy...");

    const postgresId = await dockerRun({
        image: "postgres",
        containerName: "react-sdk-cypress-sliding-sync-postgres",
        params: ["--rm", "-e", `POSTGRES_PASSWORD=${PG_PASSWORD}`],
    });

    const postgresIp = await dockerIp({ containerId: postgresId });
    const homeserverIp = await dockerIp({ containerId: homeserver.serverId });
    console.log(new Date(), "postgres container up");

    const waitTimeMillis = 30000;
    const startTime = new Date().getTime();
    let lastErr: Error;
    while (new Date().getTime() - startTime < waitTimeMillis) {
        try {
            await dockerExec({
                containerId: postgresId,
                params: ["pg_isready", "-U", "postgres"],
            });
            lastErr = null;
            break;
        } catch (err) {
            console.log("pg_isready: failed");
            lastErr = err;
        }
    }
    if (lastErr) {
        console.log("rethrowing");
        throw lastErr;
    }

    const port = await getFreePort();
    console.log(new Date(), "starting proxy container...", dockerTag);
    const containerId = await dockerRun({
        image: "ghcr.io/matrix-org/sliding-sync:" + dockerTag,
        containerName: "react-sdk-cypress-sliding-sync-proxy",
        params: [
            "--rm",
            "-p",
            `${port}:8008/tcp`,
            "-e",
            "SYNCV3_SECRET=bwahahaha",
            "-e",
            `SYNCV3_SERVER=http://${homeserverIp}:8008`,
            "-e",
            `SYNCV3_DB=user=postgres dbname=postgres password=${PG_PASSWORD} host=${postgresIp} sslmode=disable`,
        ],
    });
    console.log(new Date(), "started!");

    const instance: ProxyInstance = { containerId, postgresId, port };
    instances.set(containerId, instance);
    return instance;
}

async function proxyStop(instance: ProxyInstance): Promise<void> {
    await dockerStop({
        containerId: instance.containerId,
    });
    await dockerStop({
        containerId: instance.postgresId,
    });

    instances.delete(instance.containerId);

    console.log(new Date(), "Stopped sliding sync proxy.");
    // cypress deliberately fails if you return 'undefined', so
    // return null to signal all is well, and we've handled the task.
    return null;
}

/**
 * @type {Cypress.PluginConfig}
 */
export function slidingSyncProxyDocker(on: PluginEvents, config: PluginConfigOptions) {
    const dockerTag = config.env["SLIDING_SYNC_PROXY_TAG"];

    on("task", {
        proxyStart: proxyStart.bind(null, dockerTag),
        proxyStop,
    });

    on("after:spec", async (spec) => {
        for (const instance of instances.values()) {
            console.warn(`Cleaning up proxy on port ${instance.port} after ${spec.name}`);
            await proxyStop(instance);
        }
    });
}

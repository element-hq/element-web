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

import { getFreePort } from "../utils/port";
import { Docker } from "../docker";
import { PG_PASSWORD, PostgresDocker } from "../postgres";

// Docker tag to use for `ghcr.io/matrix-org/sliding-sync` image.
const SLIDING_SYNC_PROXY_TAG = "v0.99.3";

export interface ProxyInstance {
    containerId: string;
    postgresId: string;
    port: number;
}

export class SlidingSyncProxy {
    private readonly proxyDocker = new Docker();
    private readonly postgresDocker = new PostgresDocker("sliding-sync");
    private instance: ProxyInstance;

    constructor(private synapseIp: string) {}

    async start(): Promise<ProxyInstance> {
        console.log(new Date(), "Starting sliding sync proxy...");

        const { ipAddress: postgresIp, containerId: postgresId } = await this.postgresDocker.start();

        const port = await getFreePort();
        console.log(new Date(), "starting proxy container...", SLIDING_SYNC_PROXY_TAG);
        const containerId = await this.proxyDocker.run({
            image: "ghcr.io/matrix-org/sliding-sync:" + SLIDING_SYNC_PROXY_TAG,
            containerName: "react-sdk-playwright-sliding-sync-proxy",
            params: [
                "-p",
                `${port}:8008/tcp`,
                "-e",
                "SYNCV3_SECRET=bwahahaha",
                "-e",
                `SYNCV3_SERVER=${this.synapseIp}`,
                "-e",
                `SYNCV3_DB=user=postgres dbname=postgres password=${PG_PASSWORD} host=${postgresIp} sslmode=disable`,
            ],
        });
        console.log(new Date(), "started!");

        this.instance = { containerId, postgresId, port };
        return this.instance;
    }

    async stop(): Promise<void> {
        await this.postgresDocker.stop();
        await this.proxyDocker.stop();
        console.log(new Date(), "Stopped sliding sync proxy.");
    }
}

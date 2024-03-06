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

import mailhog from "mailhog";

import { getFreePort } from "../utils/port";
import { Docker } from "../docker";

export interface Instance {
    host: string;
    smtpPort: number;
    httpPort: number;
    containerId: string;
}

export class MailHogServer {
    private readonly docker: Docker = new Docker();
    private instance?: Instance;

    async start(): Promise<{ api: mailhog.API; instance: Instance }> {
        if (this.instance) throw new Error("Mailhog server is already running!");
        const smtpPort = await getFreePort();
        const httpPort = await getFreePort();
        console.log(`Starting mailhog...`);
        const containerId = await this.docker.run({
            image: "mailhog/mailhog:latest",
            containerName: `react-sdk-playwright-mailhog`,
            params: ["-p", `${smtpPort}:1025/tcp`, "-p", `${httpPort}:8025/tcp`],
        });
        console.log(`Started mailhog on ports smtp=${smtpPort} http=${httpPort}.`);
        const host = await this.docker.getContainerIp();
        this.instance = { smtpPort, httpPort, containerId, host };
        return { api: mailhog({ host: "localhost", port: httpPort }), instance: this.instance };
    }

    async stop(): Promise<void> {
        if (!this.instance) throw new Error("Missing existing mailhog instance, did you call stop() before start()?");
        await this.docker.stop();
        console.log(`Stopped mailhog id ${this.instance.containerId}.`);
        this.instance = undefined;
    }
}

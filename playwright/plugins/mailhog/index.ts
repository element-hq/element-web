/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
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

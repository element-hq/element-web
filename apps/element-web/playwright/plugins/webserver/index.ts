/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import * as http from "node:http";
import { type AddressInfo } from "node:net";

export class Webserver {
    private server?: http.Server;

    public start(html: string): string {
        if (this.server) this.stop();

        this.server = http.createServer((req, res) => {
            res.writeHead(200, {
                "Content-Type": "text/html",
            });
            res.end(html);
        });
        this.server.listen();

        const address = this.server.address() as AddressInfo;
        console.log(`Started webserver at ${address.address}:${address.port}`);
        return `http://localhost:${address.port}`;
    }

    public stop(): void {
        if (!this.server) return;
        console.log("Stopping webserver");
        const address = this.server.address() as AddressInfo;
        this.server.close();
        console.log(`Stopped webserver at ${address.address}:${address.port}`);
    }
}

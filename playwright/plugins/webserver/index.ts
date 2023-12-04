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

import * as http from "http";
import { AddressInfo } from "net";

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
        return `http://localhost:${address.port}/`;
    }

    public stop(): void {
        if (!this.server) return;
        console.log("Stopping webserver");
        const address = this.server.address() as AddressInfo;
        this.server.close();
        console.log(`Stopped webserver at ${address.address}:${address.port}`);
    }
}

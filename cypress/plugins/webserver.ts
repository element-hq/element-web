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

import * as http from "http";
import { AddressInfo } from "net";

import PluginEvents = Cypress.PluginEvents;
import PluginConfigOptions = Cypress.PluginConfigOptions;

const servers: http.Server[] = [];

function serveHtmlFile(html: string): string {
    const server = http.createServer((req, res) => {
        res.writeHead(200, {
            "Content-Type": "text/html",
        });
        res.end(html);
    });
    server.listen();
    servers.push(server);

    return `http://localhost:${(server.address() as AddressInfo).port}/`;
}

function stopWebServers(): null {
    for (const server of servers) {
        server.close();
    }
    servers.splice(0, servers.length); // clear

    return null; // tell cypress we did the task successfully (doesn't allow undefined)
}

export function webserver(on: PluginEvents, config: PluginConfigOptions) {
    on("task", { serveHtmlFile, stopWebServers });
    on("after:run", stopWebServers);
}

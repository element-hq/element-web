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

import http from "http";
import express from "express";
import { AddressInfo } from "net";

import PluginEvents = Cypress.PluginEvents;
import PluginConfigOptions = Cypress.PluginConfigOptions;

const servers: http.Server[] = [];

function startOAuthServer(html: string): number {
    const app = express();

    // static files. This includes the "authorization endpoint".
    app.use(express.static(__dirname + "/res"));

    // token endpoint (see https://openid.net/specs/openid-connect-core-1_0.html#TokenEndpoint)
    app.use("/oauth/token", express.urlencoded());
    app.post("/oauth/token", (req, res) => {
        // if the code is valid, accept it. Otherwise, return an error.
        const code = req.body.code;
        if (code === "valid_auth_code") {
            res.send({
                access_token: "oauth_access_token",
                token_type: "Bearer",
                expires_in: "3600",
            });
        } else {
            res.send({ error: "bad auth code" });
        }
    });

    // userinfo endpoint (see https://openid.net/specs/openid-connect-core-1_0.html#UserInfo)
    app.get("/oauth/userinfo", (req, res) => {
        // TODO: validate that the request carries an auth header which matches the access token we issued above

        // return an OAuth2 user info object
        res.send({
            sub: "alice",
            name: "Alice",
        });
    });

    const server = http.createServer(app);
    server.listen();
    servers.push(server);
    const address = server.address() as AddressInfo;
    console.log(`Started OAuth server at ${address.address}:${address.port}`);
    return address.port;
}

function stopOAuthServer(): null {
    console.log("Stopping OAuth servers");
    for (const server of servers) {
        const address = server.address() as AddressInfo;
        server.close();
        console.log(`Stopped OAuth server at ${address.address}:${address.port}`);
    }
    servers.splice(0, servers.length); // clear
    return null;
}

export function oAuthServer(on: PluginEvents, config: PluginConfigOptions) {
    on("task", { startOAuthServer, stopOAuthServer });
    on("after:run", stopOAuthServer);
}

/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import http from "http";
import express from "express";
import { type AddressInfo } from "net";
import { type TestInfo } from "@playwright/test";
import { randB64Bytes } from "@element-hq/element-web-playwright-common/lib/utils/rand.js";

export class OAuthServer {
    private server?: http.Server;
    private sub?: string;

    public onTestStarted(testInfo: TestInfo): void {
        this.sub = testInfo.testId;
    }

    public start(): number {
        if (this.server) this.stop();
        const token = randB64Bytes(16);

        const app = express();

        // static files. This includes the "authorization endpoint".
        app.use(express.static(__dirname + "/res"));

        // token endpoint (see https://openid.net/specs/openid-connect-core-1_0.html#TokenEndpoint)
        app.use("/oauth/token", express.urlencoded({ extended: true }));
        app.post("/oauth/token", (req, res) => {
            // if the code is valid, accept it. Otherwise, return an error.
            const code = req.body.code;
            if (code === "valid_auth_code") {
                res.send({
                    access_token: token,
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
                sub: this.sub,
                name: "Alice",
            });
        });

        this.server = http.createServer(app);
        this.server.listen();
        const address = this.server.address() as AddressInfo;
        console.log(`Started OAuth server at ${address.address}:${address.port}`);
        return address.port;
    }

    public stop(): void {
        console.log("Stopping OAuth server");
        const address = this.server.address() as AddressInfo;
        this.server.close();
        console.log(`Stopped OAuth server at ${address.address}:${address.port}`);
    }
}

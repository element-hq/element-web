/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { APIRequestContext, TestInfo } from "@playwright/test";
import { Readable } from "stream";
import stripAnsi from "strip-ansi";

import { Credentials } from "../plugins/homeserver";

export class ContainerLogger {
    private logs: Record<string, string> = {};

    public getConsumer(container: string) {
        this.logs[container] = "";
        return (stream: Readable) => {
            stream.on("data", (chunk) => {
                this.logs[container] += chunk.toString();
            });
            stream.on("err", (chunk) => {
                this.logs[container] += "ERR " + chunk.toString();
            });
        };
    }

    public async testStarted(testInfo: TestInfo) {
        for (const container in this.logs) {
            this.logs[container] = "";
        }
    }

    public async testFinished(testInfo: TestInfo) {
        if (testInfo.status !== "passed") {
            for (const container in this.logs) {
                await testInfo.attach(container, {
                    body: stripAnsi(this.logs[container]),
                    contentType: "text/plain",
                });
            }
        }
    }
}

export type Verb = "GET" | "POST" | "PUT" | "DELETE";

export class Api {
    private _request?: APIRequestContext;

    constructor(private readonly baseUrl: string) {}

    public setRequest(request: APIRequestContext): void {
        this._request = request;
    }

    public async request<R extends {}>(verb: "GET", path: string, token?: string, data?: never): Promise<R>;
    public async request<R extends {}>(verb: Verb, path: string, token?: string, data?: object): Promise<R>;
    public async request<R extends {}>(verb: Verb, path: string, token?: string, data?: object): Promise<R> {
        const url = `${this.baseUrl}/_matrix/client/${path}`;
        const res = await this._request.fetch(url, {
            data,
            method: verb,
            headers: token
                ? {
                      Authorization: `Bearer ${token}`,
                  }
                : undefined,
        });

        if (!res.ok()) {
            throw await res.json();
        }

        return res.json();
    }
}

export class ClientServerApi extends Api {
    constructor(baseUrl: string) {
        super(`${baseUrl}/_matrix/client/`);
    }

    public async loginUser(userId: string, password: string): Promise<Credentials> {
        const json = await this.request<{
            access_token: string;
            user_id: string;
            device_id: string;
            home_server: string;
        }>("POST", "v3/login", undefined, {
            type: "m.login.password",
            identifier: {
                type: "m.id.user",
                user: userId,
            },
            password: password,
        });

        return {
            password,
            accessToken: json.access_token,
            userId: json.user_id,
            deviceId: json.device_id,
            homeServer: json.home_server,
            username: userId.slice(1).split(":")[0],
        };
    }
}

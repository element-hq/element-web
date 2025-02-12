/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type APIRequestContext } from "@playwright/test";

import { type Credentials } from "../homeserver";

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
        const url = `${this.baseUrl}${path}`;
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
            throw new Error(
                `Request to ${url} failed with status ${res.status()}: ${JSON.stringify(await res.json())}`,
            );
        }

        return res.json();
    }
}

export class ClientServerApi extends Api {
    constructor(baseUrl: string) {
        super(`${baseUrl}/_matrix/client`);
    }

    public async loginUser(userId: string, password: string): Promise<Credentials> {
        const json = await this.request<{
            access_token: string;
            user_id: string;
            device_id: string;
            home_server: string;
        }>("POST", "/v3/login", undefined, {
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
            homeServer: json.home_server || json.user_id.split(":").slice(1).join(":"),
            username: userId.slice(1).split(":")[0],
        };
    }
}

/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type APIRequestContext } from "@playwright/test";

export type Verb = "GET" | "POST" | "PUT" | "DELETE";

/**
 * A generic API client.
 */
export class Api {
    private _request?: APIRequestContext;

    public constructor(private readonly baseUrl: string) {}

    /**
     * Set the request context to use for making requests.
     * @param request - The request context to use.
     */
    public setRequest(request: APIRequestContext): void {
        this._request = request;
    }

    /**
     * Make a request to the API.
     * @param verb - The HTTP verb to use.
     * @param path - The path to request.
     * @param token - The access token to use for the request.
     * @param data - The data to send with the request.
     */
    public async request<R extends object>(verb: "GET", path: string, token?: string, data?: never): Promise<R>;
    public async request<R extends object>(verb: Verb, path: string, token?: string, data?: object): Promise<R>;
    public async request<R extends object>(verb: Verb, path: string, token?: string, data?: object): Promise<R> {
        if (!this._request) {
            throw new Error("No request context set");
        }

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

/**
 * Credentials for a user.
 */
export interface Credentials {
    /** The base URL of the homeserver's CS API. */
    homeserverBaseUrl: string;

    accessToken: string;
    userId: string;
    deviceId: string;

    /** The domain part of the user's matrix ID. */
    homeServer: string;

    password: string | null; // null for password-less users
    displayName?: string;
    username: string; // the localpart of the userId
}

/**
 * A client-server API for interacting with a Matrix homeserver.
 */
export class ClientServerApi extends Api {
    public constructor(baseUrl: string) {
        super(`${baseUrl}/_matrix/client`);
    }

    /**
     * Register a user on the homeserver.
     * @param userId - The user ID to register.
     * @param password - The password to use for the user.
     */
    public async loginUser(userId: string, password: string): Promise<Omit<Credentials, "homeserverBaseUrl">> {
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

/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import { APIRequestContext } from "playwright-core";
import { KeyBackupInfo } from "matrix-js-sdk/src/crypto-api";

import { HomeserverInstance } from "../plugins/homeserver";

/**
 * A small subset of the Client-Server API used to manipulate the state of the
 * account on the homeserver independently of the client under test.
 */
export class TestClientServerAPI {
    public constructor(
        private request: APIRequestContext,
        private homeserver: HomeserverInstance,
        private accessToken: string,
    ) {}

    public async getCurrentBackupInfo(): Promise<KeyBackupInfo | null> {
        const res = await this.request.get(`${this.homeserver.baseUrl}/_matrix/client/v3/room_keys/version`, {
            headers: { Authorization: `Bearer ${this.accessToken}` },
        });

        return await res.json();
    }

    /**
     * Calls the API directly to delete the given backup version
     * @param version The version to delete
     */
    public async deleteBackupVersion(version: string): Promise<void> {
        const res = await this.request.delete(
            `${this.homeserver.baseUrl}/_matrix/client/v3/room_keys/version/${version}`,
            {
                headers: { Authorization: `Bearer ${this.accessToken}` },
            },
        );

        if (!res.ok) {
            throw new Error(`Failed to delete backup version: ${res.status}`);
        }
    }
}

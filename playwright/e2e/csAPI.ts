/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import { type APIRequestContext } from "playwright-core";
import { type KeyBackupInfo } from "matrix-js-sdk/src/crypto-api";

import { type HomeserverInstance } from "../plugins/homeserver";
import { ClientServerApi } from "../plugins/utils/api.ts";

/**
 * A small subset of the Client-Server API used to manipulate the state of the
 * account on the homeserver independently of the client under test.
 */
export class TestClientServerAPI extends ClientServerApi {
    public constructor(
        request: APIRequestContext,
        homeserver: HomeserverInstance,
        private accessToken: string,
    ) {
        super(homeserver.baseUrl);
        this.setRequest(request);
    }

    public async getCurrentBackupInfo(): Promise<KeyBackupInfo | null> {
        return this.request("GET", `/v3/room_keys/version`, this.accessToken);
    }

    /**
     * Calls the API directly to delete the given backup version
     * @param version The version to delete
     */
    public async deleteBackupVersion(version: string): Promise<void> {
        await this.request("DELETE", `/v3/room_keys/version/${version}`, this.accessToken);
    }
}

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

import { APIRequestContext, Page, expect } from "@playwright/test";

import { HomeserverInstance } from "../plugins/homeserver";

export class Crypto {
    public constructor(
        private page: Page,
        private homeserver: HomeserverInstance,
        private request: APIRequestContext,
    ) {}

    /**
     * Check that the user has published cross-signing keys, and that the user's device has been cross-signed.
     */
    public async assertDeviceIsCrossSigned(): Promise<void> {
        const { userId, deviceId, accessToken } = await this.page.evaluate(() => ({
            userId: window.mxMatrixClientPeg.get().getUserId(),
            deviceId: window.mxMatrixClientPeg.get().getDeviceId(),
            accessToken: window.mxMatrixClientPeg.get().getAccessToken(),
        }));

        const res = await this.request.post(`${this.homeserver.config.baseUrl}/_matrix/client/v3/keys/query`, {
            headers: { Authorization: `Bearer ${accessToken}` },
            data: { device_keys: { [userId]: [] } },
        });
        const json = await res.json();

        // there should be three cross-signing keys
        expect(json.master_keys[userId]).toHaveProperty("keys");
        expect(json.self_signing_keys[userId]).toHaveProperty("keys");
        expect(json.user_signing_keys[userId]).toHaveProperty("keys");

        // and the device should be signed by the self-signing key
        const selfSigningKeyId = Object.keys(json.self_signing_keys[userId].keys)[0];

        expect(json.device_keys[userId][deviceId]).toBeDefined();

        const myDeviceSignatures = json.device_keys[userId][deviceId].signatures[userId];
        expect(myDeviceSignatures[selfSigningKeyId]).toBeDefined();
    }
}

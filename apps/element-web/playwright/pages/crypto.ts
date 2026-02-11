/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type APIRequestContext, type Page, expect } from "@playwright/test";

import { type HomeserverInstance } from "../plugins/homeserver";

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

        const res = await this.request.post(`${this.homeserver.baseUrl}/_matrix/client/v3/keys/query`, {
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

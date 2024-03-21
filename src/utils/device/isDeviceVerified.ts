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

import { MatrixClient } from "matrix-js-sdk/src/matrix";

/**
 * Check if one of our own devices is verified via cross signing
 *
 * @param client - reference to the MatrixClient
 * @param deviceId - ID of the device to be checked
 *
 * @returns `null` if the device is unknown or has not published encryption keys; otherwise a boolean
 *    indicating whether the device has been cross-signed by a cross-signing key we trust.
 */
export const isDeviceVerified = async (client: MatrixClient, deviceId: string): Promise<boolean | null> => {
    const trustLevel = await client.getCrypto()?.getDeviceVerificationStatus(client.getSafeUserId(), deviceId);
    if (!trustLevel) {
        // either no crypto, or an unknown/no-e2e device
        return null;
    }
    return trustLevel.crossSigningVerified;
};

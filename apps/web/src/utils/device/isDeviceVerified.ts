/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type MatrixClient } from "matrix-js-sdk/src/matrix";

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

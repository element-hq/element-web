/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type Device, type MatrixClient } from "matrix-js-sdk/src/matrix";

/**
 * Get crypto information on a specific device.
 *
 * Only devices with Crypto support are returned. If the MatrixClient doesn't support cryptography, `undefined` is
 * returned.
 *
 * @param client  - Matrix Client.
 * @param userId  - ID of the user owning the device.
 * @param deviceId - ID of the device.
 * @param downloadUncached - If true, download the device list for users whose device list we are not
 *    currently tracking. Defaults to false.
 *
 * @returns Information on the device if it is known.
 */
export async function getDeviceCryptoInfo(
    client: MatrixClient,
    userId: string,
    deviceId: string,
    downloadUncached?: boolean,
): Promise<Device | undefined> {
    const crypto = client.getCrypto();
    if (!crypto) {
        // no crypto support, no device.
        return undefined;
    }

    const deviceMap = await crypto.getUserDeviceInfo([userId], downloadUncached);
    return deviceMap.get(userId)?.get(deviceId);
}

/**
 * Get the IDs of the given user's devices.
 *
 * Only devices with Crypto support are returned. If the MatrixClient doesn't support cryptography, an empty Set is
 * returned.
 *
 * @param client  - Matrix Client.
 * @param userId  - ID of the user to query.
 */

export async function getUserDeviceIds(client: MatrixClient, userId: string): Promise<Set<string>> {
    const crypto = client.getCrypto();
    if (!crypto) {
        return new Set();
    }

    const deviceMap = await crypto.getUserDeviceInfo([userId]);
    return new Set(deviceMap.get(userId)?.keys() ?? []);
}

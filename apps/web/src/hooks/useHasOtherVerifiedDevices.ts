/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type Device, type MatrixClient } from "matrix-js-sdk/src/matrix";
import { type CryptoApi } from "matrix-js-sdk/src/crypto-api";

import { useAsyncMemo } from "./useAsyncMemo.ts";
import { asyncSome } from "../utils/arrays";

/**
 * Check whether the user has other verified devices, not counting dehydrated devices.
 */
export async function hasOtherVerifiedDevices(
    ownUserId: string,
    ownDeviceId: string,
    crypto: CryptoApi | undefined,
): Promise<boolean | null> {
    if (!crypto) return null;
    const userDevices: Iterable<Device> = (await crypto.getUserDeviceInfo([ownUserId])).get(ownUserId)?.values() ?? [];

    return asyncSome(userDevices, async (device) => {
        // Ignore our own device.
        if (device.deviceId === ownDeviceId) return false;

        // Ignore dehydrated devices. MSC3814 proposes that devices
        // should set a `dehydrated` flag in the device key.
        if (device.dehydrated) return false;

        // Ignore devices without an identity key.
        if (!device.getIdentityKey()) return false;

        const verificationStatus = await crypto.getDeviceVerificationStatus(ownUserId, device.deviceId);
        return !!verificationStatus?.signedByOwner;
    });
}

/**
 * Hook to check whether the user has other verified devices, not counting
 * dehydrated devices.
 */
export function useHasOtherVerifiedDevices(client: MatrixClient): boolean | null | undefined {
    return useAsyncMemo(
        async () => {
            const ownUserId = client.getUserId()!;
            const ownDeviceId = client.getDeviceId()!;
            const crypto = client.getCrypto();
            return await hasOtherVerifiedDevices(ownUserId, ownDeviceId, crypto);
        },
        [],
        undefined,
    );
}

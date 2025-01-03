/*
Copyright 2024 New Vector Ltd.
Copyright 2020-2024 The Matrix.org Foundation C.I.C.
Copyright 2018 New Vector Ltd
Copyright 2016 Aviral Dasgupta
Copyright 2016 OpenMarket Ltd

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// Note: we don't import the base64 utils from `matrix-js-sdk/src/matrix` because this file
// is used by Element Web's service worker, and importing `matrix` brings in ~1mb of stuff
// we don't need. Instead, we ignore the import restriction and only bring in what we actually
// need.
// Note: `base64` is not public in the js-sdk, so if it changes/breaks, that's on us. We should
// be okay with our frequent tests, locked versioning, etc though. We'll pick up problems well
// before release.
// eslint-disable-next-line no-restricted-imports
import { encodeUnpaddedBase64 } from "matrix-js-sdk/src/base64";
import { logger } from "matrix-js-sdk/src/logger";

/**
 * Encrypted format of a pickle key, as stored in IndexedDB.
 */
export interface EncryptedPickleKey {
    /** The encrypted payload. */
    encrypted?: BufferSource;

    /** Initialisation vector for the encryption. */
    iv?: BufferSource;

    /** The encryption key which was used to encrypt the payload. */
    cryptoKey?: CryptoKey;
}

/**
 * Calculates the `additionalData` for the AES-GCM key used by the pickling processes. This
 * additional data is *not* encrypted, but *is* authenticated. The additional data is constructed
 * from the user ID and device ID provided.
 *
 * The later-constructed pickle key is used to decrypt values, such as access tokens, from IndexedDB.
 *
 * See https://developer.mozilla.org/en-US/docs/Web/API/AesGcmParams for more information on
 * `additionalData`.
 *
 * @param {string} userId The user ID who owns the pickle key.
 * @param {string} deviceId The device ID which owns the pickle key.
 * @return {Uint8Array} The additional data as a Uint8Array.
 */
export function getPickleAdditionalData(userId: string, deviceId: string): Uint8Array {
    const additionalData = new Uint8Array(userId.length + deviceId.length + 1);
    for (let i = 0; i < userId.length; i++) {
        additionalData[i] = userId.charCodeAt(i);
    }
    additionalData[userId.length] = 124; // "|"
    for (let i = 0; i < deviceId.length; i++) {
        additionalData[userId.length + 1 + i] = deviceId.charCodeAt(i);
    }
    return additionalData;
}

/**
 * Encrypt the given pickle key, ready for storage in the database.
 *
 * @param pickleKey - The key to be encrypted.
 * @param userId - The user ID the pickle key belongs to.
 * @param deviceId - The device ID the pickle key belongs to.
 *
 * @returns Data object ready for storing in indexeddb.
 */
export async function encryptPickleKey(
    pickleKey: Uint8Array,
    userId: string,
    deviceId: string,
): Promise<EncryptedPickleKey | undefined> {
    if (!crypto?.subtle) {
        return undefined;
    }
    const cryptoKey = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
    const iv = new Uint8Array(32);
    crypto.getRandomValues(iv);

    const additionalData = getPickleAdditionalData(userId, deviceId);
    const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData }, cryptoKey, pickleKey);
    return { encrypted, iv, cryptoKey };
}

/**
 * Decrypts the provided data into a pickle key and base64-encodes it ready for use elsewhere.
 *
 * If `data` is undefined in part or in full, returns undefined.
 *
 *  If crypto functions are not available, returns undefined regardless of input.
 *
 * @param data An object containing the encrypted pickle key data: encrypted payload, initialization vector (IV), and crypto key. Typically loaded from indexedDB.
 * @param userId The user ID the pickle key belongs to.
 * @param deviceId The device ID the pickle key belongs to.
 * @returns A promise that resolves to the encoded pickle key, or undefined if the key cannot be built and encoded.
 */
export async function buildAndEncodePickleKey(
    data: EncryptedPickleKey | undefined,
    userId: string,
    deviceId: string,
): Promise<string | undefined> {
    if (!crypto?.subtle) {
        return undefined;
    }
    if (!data || !data.encrypted || !data.iv || !data.cryptoKey) {
        return undefined;
    }

    try {
        const additionalData = getPickleAdditionalData(userId, deviceId);
        const pickleKeyBuf = await crypto.subtle.decrypt(
            { name: "AES-GCM", iv: data.iv, additionalData },
            data.cryptoKey,
            data.encrypted,
        );
        if (pickleKeyBuf) {
            return encodeUnpaddedBase64(new Uint8Array(pickleKeyBuf));
        }
    } catch {
        logger.error("Error decrypting pickle key");
    }

    return undefined;
}

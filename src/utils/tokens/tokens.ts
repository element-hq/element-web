/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { logger } from "matrix-js-sdk/src/logger";
import decryptAESSecretStorageItem from "matrix-js-sdk/src/utils/decryptAESSecretStorageItem";
import encryptAESSecretStorageItem from "matrix-js-sdk/src/utils/encryptAESSecretStorageItem";
import { type AESEncryptedSecretStoragePayload } from "matrix-js-sdk/src/types";

import * as StorageAccess from "../StorageAccess";

/**
 * Utility functions related to the storage and retrieval of access tokens
 */

/*
 * Names used when storing the tokens in indexeddb or localstorage
 */
export const ACCESS_TOKEN_STORAGE_KEY = "mx_access_token";
export const REFRESH_TOKEN_STORAGE_KEY = "mx_refresh_token";
/*
 * Names of the tokens. Used as part of the calculation to derive AES keys during encryption in persistTokenInStorage,
 * and decryption in restoreSessionFromStorage.
 */
export const ACCESS_TOKEN_IV = "access_token";
export const REFRESH_TOKEN_IV = "refresh_token";
/*
 * Keys for localstorage items which indicate whether we expect a token in indexeddb.
 */
export const HAS_ACCESS_TOKEN_STORAGE_KEY = "mx_has_access_token";
export const HAS_REFRESH_TOKEN_STORAGE_KEY = "mx_has_refresh_token";

/**
 * The pickle key is a string of unspecified length and format.  For AES, we need a 256-bit Uint8Array. So we HKDF the pickle key to generate the AES key.  The AES key should be zeroed after it is used.
 * @param pickleKey
 * @returns AES key
 */
async function pickleKeyToAesKey(pickleKey: string): Promise<Uint8Array> {
    const pickleKeyBuffer = new Uint8Array(pickleKey.length);
    for (let i = 0; i < pickleKey.length; i++) {
        pickleKeyBuffer[i] = pickleKey.charCodeAt(i);
    }
    const hkdfKey = await crypto.subtle.importKey("raw", pickleKeyBuffer, "HKDF", false, ["deriveBits"]);
    pickleKeyBuffer.fill(0);
    return new Uint8Array(
        await crypto.subtle.deriveBits(
            {
                name: "HKDF",
                hash: "SHA-256",
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-ignore: https://github.com/microsoft/TypeScript-DOM-lib-generator/pull/879
                salt: new Uint8Array(32),
                info: new Uint8Array(0),
            },
            hkdfKey,
            256,
        ),
    );
}

/**
 * Try to decrypt a token retrieved from storage
 *
 * Where token is not encrypted (plain text) returns the plain text token.
 *
 * Where token is encrypted, attempts decryption. Returns successfully decrypted token, or throws if
 * decryption failed.
 *
 * @param pickleKey Pickle key: used to derive the encryption key, or undefined if the token is not encrypted.
 *   Must be the same as provided to {@link persistTokenInStorage}.
 * @param token token to be decrypted.
 * @param tokenName Name of the token. Used in logging, but also used as an input when generating the actual AES key,
 *    so the same value must be provided to {@link persistTokenInStorage}.
 *
 * @returns the decrypted token, or the plain text token.
 */
export async function tryDecryptToken(
    pickleKey: string | undefined,
    token: AESEncryptedSecretStoragePayload | string,
    tokenName: string,
): Promise<string> {
    if (typeof token === "string") {
        // Looks like an unencrypted token
        return token;
    }

    // Otherwise, it must be an encrypted token.
    if (!pickleKey) {
        throw new Error(`Error decrypting secret ${tokenName}: no pickle key found.`);
    }

    const encrKey = await pickleKeyToAesKey(pickleKey);
    const decryptedToken = await decryptAESSecretStorageItem(token, encrKey, tokenName);
    encrKey.fill(0);
    return decryptedToken;
}

/**
 * Persist a token in storage
 *
 * When pickle key is present, will attempt to encrypt the token. If encryption fails (typically because
 * WebCrypto is unavailable), the key will be stored unencrypted.
 *
 * Stores in IndexedDB, falling back to localStorage.
 *
 * @param storageKey key used to store the token. Note: not an encryption key; rather a localstorage or indexeddb key.
 * @param tokenName Name of the token. Used in logging, but also used as an input when generating the actual AES key,
 *    so the same value must be provided to {@link tryDecryptToken} when decrypting.
 * @param token the token to store. When undefined, any existing token at the `storageKey` is removed from storage.
 * @param pickleKey Pickle key: used to derive the key used to encrypt token. If `undefined`, the token will be stored
 *    unencrypted.
 * @param hasTokenStorageKey Localstorage key for an item which stores whether we expect to have a token in indexeddb,
 *    eg "mx_has_access_token".
 */
export async function persistTokenInStorage(
    storageKey: string,
    tokenName: string,
    token: string | undefined,
    pickleKey: string | undefined,
    hasTokenStorageKey: string,
): Promise<void> {
    // store whether we expect to find a token, to detect the case
    // where IndexedDB is blown away
    if (token) {
        localStorage.setItem(hasTokenStorageKey, "true");
    } else {
        localStorage.removeItem(hasTokenStorageKey);
    }

    if (pickleKey) {
        let encryptedToken: AESEncryptedSecretStoragePayload | undefined;
        if (token) {
            try {
                // try to encrypt the access token using the pickle key
                const encrKey = await pickleKeyToAesKey(pickleKey);
                encryptedToken = await encryptAESSecretStorageItem(token, encrKey, tokenName);
                encrKey.fill(0);
            } catch (e) {
                // This is likely due to the browser not having WebCrypto or somesuch.
                // Warn about it, but fall back to storing the unencrypted token.
                logger.warn(`Could not encrypt token for ${tokenName}`, e);
            }
        }
        try {
            // Save either the encrypted access token, or the plain access
            // token if there is no token or we were unable to encrypt (e.g. if the browser doesn't
            // have WebCrypto).
            await StorageAccess.idbSave("account", storageKey, encryptedToken || token);
        } catch {
            // if we couldn't save to indexedDB, fall back to localStorage.  We
            // store the access token unencrypted since localStorage only saves
            // strings.
            if (!!token) {
                localStorage.setItem(storageKey, token);
            } else {
                localStorage.removeItem(storageKey);
            }
        }
    } else {
        try {
            await StorageAccess.idbSave("account", storageKey, token);
        } catch {
            if (!!token) {
                localStorage.setItem(storageKey, token);
            } else {
                localStorage.removeItem(storageKey);
            }
        }
    }
}

/**
 * Wraps {@link persistTokenInStorage} with accessToken storage keys
 *
 * @param token - The token to store. When undefined, any existing accessToken is removed from storage.
 * @param pickleKey - Pickle key: used to derive the key used to encrypt token. If `undefined`, the token will be stored
 *    unencrypted.
 */
export async function persistAccessTokenInStorage(
    token: string | undefined,
    pickleKey: string | undefined,
): Promise<void> {
    return persistTokenInStorage(
        ACCESS_TOKEN_STORAGE_KEY,
        ACCESS_TOKEN_IV,
        token,
        pickleKey,
        HAS_ACCESS_TOKEN_STORAGE_KEY,
    );
}

/**
 * Wraps {@link persistTokenInStorage} with refreshToken storage keys.
 *
 * @param token - The token to store. When undefined, any existing refreshToken is removed from storage.
 * @param pickleKey - Pickle key: used to derive the key used to encrypt token. If `undefined`, the token will be stored
 *    unencrypted.
 */
export async function persistRefreshTokenInStorage(
    token: string | undefined,
    pickleKey: string | undefined,
): Promise<void> {
    return persistTokenInStorage(
        REFRESH_TOKEN_STORAGE_KEY,
        REFRESH_TOKEN_IV,
        token,
        pickleKey,
        HAS_REFRESH_TOKEN_STORAGE_KEY,
    );
}

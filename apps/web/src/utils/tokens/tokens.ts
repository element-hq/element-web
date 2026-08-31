/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { logger } from "matrix-js-sdk/src/logger";
import { type AccessTokens } from "matrix-js-sdk/src/matrix";
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
 * Derive the localStorage key used to hold a token when writing it to IndexedDB fails.
 *
 * This is deliberately distinct from `storageKey` itself. Very old sessions may still have a
 * plain token sitting at `storageKey` in localStorage, from before tokens were moved into
 * IndexedDB, and those are *not* authoritative — IndexedDB may well hold a newer value. A token
 * at the fallback key, by contrast, is only ever written by {@link persistTokenInStorage} when
 * the IndexedDB write failed, and is cleared again as soon as one succeeds, so it is always at
 * least as new as anything in IndexedDB.
 *
 * @param storageKey - the primary storage key, eg {@link ACCESS_TOKEN_STORAGE_KEY}
 */
export function getFallbackStorageKey(storageKey: string): string {
    return `${storageKey}_fallback`;
}

/**
 * The pickle key is a string of unspecified length and format.  For AES, we need a 256-bit Uint8Array. So we HKDF the pickle key to generate the AES key.  The AES key should be zeroed after it is used.
 * @param pickleKey
 * @returns AES key
 */
async function pickleKeyToAesKey(pickleKey: string): Promise<Uint8Array<ArrayBuffer>> {
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
async function persistTokenInStorage(
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

    let valueToStore: AESEncryptedSecretStoragePayload | string | undefined = token;
    if (pickleKey && token) {
        try {
            // try to encrypt the access token using the pickle key
            const encrKey = await pickleKeyToAesKey(pickleKey);
            valueToStore = await encryptAESSecretStorageItem(token, encrKey, tokenName);
            encrKey.fill(0);
        } catch (e) {
            // This is likely due to the browser not having WebCrypto or somesuch.
            // Warn about it, but fall back to storing the unencrypted token.
            logger.warn(`Could not encrypt token for ${tokenName}`, e);
        }
    }

    const fallbackStorageKey = getFallbackStorageKey(storageKey);

    try {
        // Save either the encrypted token, or the plain token if there is no token or we were
        // unable to encrypt (e.g. if the browser doesn't have WebCrypto).
        await StorageAccess.idbSave("account", storageKey, valueToStore);
        // IndexedDB is now authoritative, so drop any fallback left behind by an earlier failed
        // write. If we left it in place, getStoredToken would keep preferring it over the value
        // we have just written.
        localStorage.removeItem(fallbackStorageKey);
    } catch (e) {
        // We could not save to IndexedDB, so fall back to localStorage. We store the token
        // unencrypted since localStorage only saves strings.
        logger.error(
            `Failed to write ${tokenName} to IndexedDB; falling back to localStorage. ` +
                `If this token is rotated and the fallback is not read back, the session will be lost.`,
            e,
        );

        // Write the fallback *before* touching IndexedDB below, so that there is never a moment
        // where neither store holds a token.
        if (token) {
            localStorage.setItem(fallbackStorageKey, token);
        } else {
            localStorage.removeItem(fallbackStorageKey);
        }

        // Deliberately leave whatever IndexedDB holds alone, even though it is now stale. The
        // service worker reads the access token from IndexedDB *only* — it cannot reach
        // localStorage, see apps/web/src/serviceworker/index.ts — so removing it would leave that
        // reader with no token at all and send every media request out unauthenticated for the
        // rest of the session. A stale token is no worse than none for it, and after a failure
        // like this it is usually the very token we were trying to write.
        //
        // This client is unaffected either way: getStoredToken prefers the fallback key, and the
        // next write to succeed overwrites IndexedDB and clears the fallback again.
    }
}

/**
 * Wraps {@link persistTokenInStorage} with accessToken & refreshToken storage keys
 *
 * @param tokens - The tokens to persist
 * @param pickleKey - Pickle key: used to derive the key used to encrypt token.
 *     If `undefined`, the token will be stored unencrypted.
 */
export async function persistTokens(pickleKey: string | undefined, tokens: AccessTokens): Promise<void> {
    await persistTokenInStorage(
        ACCESS_TOKEN_STORAGE_KEY,
        ACCESS_TOKEN_IV,
        tokens.accessToken,
        pickleKey,
        HAS_ACCESS_TOKEN_STORAGE_KEY,
    );
    await persistTokenInStorage(
        REFRESH_TOKEN_STORAGE_KEY,
        REFRESH_TOKEN_IV,
        tokens.refreshToken,
        pickleKey,
        HAS_REFRESH_TOKEN_STORAGE_KEY,
    );
}

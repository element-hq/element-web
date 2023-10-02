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

import { decryptAES, encryptAES, IEncryptedPayload } from "matrix-js-sdk/src/crypto/aes";
import { logger } from "matrix-js-sdk/src/logger";

import * as StorageManager from "../StorageManager";

/**
 * Utility functions related to the storage and retrieval of access tokens
 */

/*
 * Keys used when storing the tokens in indexeddb or localstorage
 */
export const ACCESS_TOKEN_STORAGE_KEY = "mx_access_token";
export const REFRESH_TOKEN_STORAGE_KEY = "mx_refresh_token";
/*
 * Used as initialization vector during encryption in persistTokenInStorage
 * And decryption in restoreFromLocalStorage
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
    const hkdfKey = await window.crypto.subtle.importKey("raw", pickleKeyBuffer, "HKDF", false, ["deriveBits"]);
    pickleKeyBuffer.fill(0);
    return new Uint8Array(
        await window.crypto.subtle.deriveBits(
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

const isEncryptedPayload = (token?: IEncryptedPayload | string | undefined): token is IEncryptedPayload => {
    return !!token && typeof token !== "string";
};
/**
 * Try to decrypt a token retrieved from storage
 * Where token is not encrypted (plain text) returns the plain text token
 * Where token is encrypted, attempts decryption. Returns successfully decrypted token, else undefined.
 * @param pickleKey pickle key used during encryption of token, or undefined
 * @param token
 * @param tokenIv initialization vector used during encryption of token eg ACCESS_TOKEN_IV
 * @returns the decrypted token, or the plain text token. Returns undefined when token cannot be decrypted
 */
export async function tryDecryptToken(
    pickleKey: string | undefined,
    token: IEncryptedPayload | string | undefined,
    tokenIv: string,
): Promise<string | undefined> {
    if (pickleKey && isEncryptedPayload(token)) {
        const encrKey = await pickleKeyToAesKey(pickleKey);
        const decryptedToken = await decryptAES(token, encrKey, tokenIv);
        encrKey.fill(0);
        return decryptedToken;
    }
    // if the token wasn't encrypted (plain string) just return it back
    if (typeof token === "string") {
        return token;
    }
    // otherwise return undefined
}

/**
 * Persist a token in storage
 * When pickle key is present, will attempt to encrypt the token
 * Stores in idb, falling back to localStorage
 *
 * @param storageKey key used to store the token
 * @param initializationVector Initialization vector for encrypting the token. Only used when `pickleKey` is present
 * @param token the token to store, when undefined any existing token at the storageKey is removed from storage
 * @param pickleKey optional pickle key used to encrypt token
 * @param hasTokenStorageKey Localstorage key for an item which stores whether we expect to have a token in indexeddb, eg "mx_has_access_token".
 */
export async function persistTokenInStorage(
    storageKey: string,
    initializationVector: string,
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
        let encryptedToken: IEncryptedPayload | undefined;
        try {
            if (!token) {
                throw new Error("No token: not attempting encryption");
            }
            // try to encrypt the access token using the pickle key
            const encrKey = await pickleKeyToAesKey(pickleKey);
            encryptedToken = await encryptAES(token, encrKey, initializationVector);
            encrKey.fill(0);
        } catch (e) {
            logger.warn("Could not encrypt access token", e);
        }
        try {
            // save either the encrypted access token, or the plain access
            // token if we were unable to encrypt (e.g. if the browser doesn't
            // have WebCrypto).
            await StorageManager.idbSave("account", storageKey, encryptedToken || token);
        } catch (e) {
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
            await StorageManager.idbSave("account", storageKey, token);
        } catch (e) {
            if (!!token) {
                localStorage.setItem(storageKey, token);
            } else {
                localStorage.removeItem(storageKey);
            }
        }
    }
}

/**
 * Wraps persistTokenInStorage with accessToken storage keys
 * @param token the token to store, when undefined any existing accessToken is removed from storage
 * @param pickleKey optional pickle key used to encrypt token
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
 * Wraps persistTokenInStorage with refreshToken storage keys
 * @param token the token to store, when undefined any existing refreshToken is removed from storage
 * @param pickleKey optional pickle key used to encrypt token
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

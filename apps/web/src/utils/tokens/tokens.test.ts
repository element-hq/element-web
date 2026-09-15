/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { describe, it, expect, beforeEach, vi } from "vitest";
import { type AESEncryptedSecretStoragePayload } from "matrix-js-sdk/src/types";

import * as StorageAccess from "../StorageAccess";
import {
    ACCESS_TOKEN_NAME,
    ACCESS_TOKEN_STORAGE_KEY,
    REFRESH_TOKEN_NAME,
    persistTokens,
    tryDecryptToken,
} from "./tokens";

const PICKLE_KEY = "aVerySecretPickleKey";
const ACCESS_TOKEN = "syt_access_token_value";

describe("tokens", () => {
    /** Whatever `persistTokens` wrote, keyed by storage key. */
    let saved: Record<string, unknown>;

    beforeEach(() => {
        saved = {};
        vi.spyOn(StorageAccess, "idbSave").mockImplementation(async (_table, key, data) => {
            saved[key as string] = data;
        });
        localStorage.clear();
    });

    /** Persist an access token with the given pickle key and hand back what landed in storage. */
    async function persistAccessToken(pickleKey: string | undefined): Promise<unknown> {
        await persistTokens(pickleKey, { accessToken: ACCESS_TOKEN });
        return saved[ACCESS_TOKEN_STORAGE_KEY];
    }

    describe("tryDecryptToken", () => {
        it("round-trips a token persisted with the same pickle key", async () => {
            const stored = (await persistAccessToken(PICKLE_KEY)) as AESEncryptedSecretStoragePayload;

            // Sanity check that we really did store an encrypted payload rather than the raw token.
            expect(typeof stored).toBe("object");
            expect(stored.ciphertext).toBeDefined();

            await expect(tryDecryptToken(PICKLE_KEY, stored, ACCESS_TOKEN_NAME)).resolves.toEqual(ACCESS_TOKEN);
        });

        it("throws 'bad MAC' when the pickle key does not match the one used to persist", async () => {
            const stored = (await persistAccessToken(PICKLE_KEY)) as AESEncryptedSecretStoragePayload;

            // This is what a pickle key which has been replaced since the token was written looks
            // like in production, so keep the failure recognisable.
            await expect(tryDecryptToken("aDifferentPickleKey", stored, ACCESS_TOKEN_NAME)).rejects.toThrow(
                "Error decrypting secret access_token: bad MAC",
            );
        });

        it("throws when the token name does not match, since it is an input to the key derivation", async () => {
            const stored = (await persistAccessToken(PICKLE_KEY)) as AESEncryptedSecretStoragePayload;

            await expect(tryDecryptToken(PICKLE_KEY, stored, REFRESH_TOKEN_NAME)).rejects.toThrow(
                "Error decrypting secret refresh_token: bad MAC",
            );
        });
    });

    describe("persistTokens", () => {
        it("stores the token as a plain string when there is no pickle key", async () => {
            // `tryDecryptToken` only accepts encrypted payloads, so callers reading this back have to
            // recognise a plain string themselves rather than handing it over for decryption.
            await expect(persistAccessToken(undefined)).resolves.toEqual(ACCESS_TOKEN);
        });
    });
});

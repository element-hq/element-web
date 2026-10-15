/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { describe, it, expect, afterEach, vi } from "vitest";
import { decodeBase64 } from "matrix-js-sdk/src/matrix";

import {
    buildAndEncodePickleKey,
    encryptPickleKey,
    getPickleAdditionalData,
    type EncryptedPickleKey,
} from "./pickling";

const USER_ID = "@alice:example.com";
const DEVICE_ID = "ABCDEFG";

describe("pickling", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    describe("getPickleAdditionalData", () => {
        it("encodes the user ID and device ID separated by a pipe", () => {
            expect(new TextDecoder().decode(getPickleAdditionalData(USER_ID, DEVICE_ID))).toEqual(
                `${USER_ID}|${DEVICE_ID}`,
            );
        });
    });

    describe("buildAndEncodePickleKey", () => {
        it("round-trips a key created by encryptPickleKey", async () => {
            const pickleKey = new Uint8Array(32);
            crypto.getRandomValues(pickleKey);

            const encrypted = await encryptPickleKey(pickleKey, USER_ID, DEVICE_ID);
            const encoded = await buildAndEncodePickleKey(encrypted!, USER_ID, DEVICE_ID);

            expect(encoded).toBeDefined();
            expect(new Uint8Array(decodeBase64(encoded!))).toEqual(pickleKey);
        });

        it.each(["encrypted", "iv", "cryptoKey"] as const)("returns undefined when %s is missing", async (field) => {
            const pickleKey = new Uint8Array(32);
            crypto.getRandomValues(pickleKey);
            const encrypted = {
                ...(await encryptPickleKey(pickleKey, USER_ID, DEVICE_ID))!,
            };
            delete encrypted[field];

            await expect(buildAndEncodePickleKey(encrypted, USER_ID, DEVICE_ID)).resolves.toBeUndefined();
        });

        it("throws when the additional data does not match the user/device", async () => {
            const pickleKey = new Uint8Array(32);
            crypto.getRandomValues(pickleKey);
            const encrypted = (await encryptPickleKey(pickleKey, USER_ID, DEVICE_ID))!;

            // Decryption is authenticated over the user ID and device ID, so a mismatch must fail
            // rather than silently returning a bogus key.
            await expect(buildAndEncodePickleKey(encrypted, USER_ID, "OTHERDEVICE")).rejects.toThrow();
        });

        it("throws a descriptive error when WebCrypto is unavailable", async () => {
            // A complete-looking payload, so we get past the field checks and reach the WebCrypto check.
            const data: EncryptedPickleKey = {
                encrypted: new Uint8Array(1),
                iv: new Uint8Array(32),
                cryptoKey: {} as CryptoKey,
            };

            vi.stubGlobal("crypto", {});

            await expect(buildAndEncodePickleKey(data, USER_ID, DEVICE_ID)).rejects.toThrow(
                /WebCrypto is not available to decrypt the pickle key/,
            );
        });
    });

    describe("encryptPickleKey", () => {
        it("returns undefined when WebCrypto is unavailable", async () => {
            vi.stubGlobal("crypto", {});

            await expect(encryptPickleKey(new Uint8Array(32), USER_ID, DEVICE_ID)).resolves.toBeUndefined();
        });
    });
});

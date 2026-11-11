/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const preloadRustCrypto = vi.fn().mockResolvedValue(undefined);

describe("preloadCryptoIfLoggedIn", () => {
    let preloadCryptoIfLoggedIn: () => void;

    beforeEach(async () => {
        // Each test needs a fresh module registry and mock, or the crypto module would only be imported once per file
        vi.resetModules();
        vi.doMock("matrix-js-sdk/src/matrix", () => ({ preloadRustCrypto }));
        ({ preloadCryptoIfLoggedIn } = await import("./preloadCrypto"));
    });

    afterEach(() => {
        vi.restoreAllMocks();
        localStorage.clear();
        preloadRustCrypto.mockClear();
    });

    it("preloads rust crypto when there is a stored session", async () => {
        localStorage.setItem("mx_has_access_token", "true");

        preloadCryptoIfLoggedIn();
        await vi.dynamicImportSettled();

        expect(preloadRustCrypto).toHaveBeenCalled();
    });

    it("does nothing without a stored session", async () => {
        preloadCryptoIfLoggedIn();
        await vi.dynamicImportSettled();

        expect(preloadRustCrypto).not.toHaveBeenCalled();
    });

    it("does nothing when storage is inaccessible", async () => {
        vi.spyOn(window, "localStorage", "get").mockImplementation(() => {
            throw new Error("SecurityError");
        });

        preloadCryptoIfLoggedIn();
        await vi.dynamicImportSettled();

        expect(preloadRustCrypto).not.toHaveBeenCalled();
    });
});

/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

/**
 * Start loading the js-sdk's crypto module, and with it the crypto WASM, if there is a stored session.
 *
 * A returning user's client needs crypto as soon as it starts, so this lets the browser fetch and compile the WASM
 * alongside loading the config, theme and language, rather than after them. It loads the same module the js-sdk
 * does, so the chunk and the WASM are shared rather than downloaded twice.
 */
export function preloadCryptoIfLoggedIn(): void {
    try {
        // HAS_ACCESS_TOKEN_STORAGE_KEY, not imported to keep utils/tokens out of the entry bundle
        if (window.localStorage?.getItem("mx_has_access_token") !== "true") return;
    } catch {
        // Storage may be inaccessible, in which case there is no stored session either
        return;
    }
    // Any failure is reported when the client initialises crypto
    import("matrix-js-sdk/src/matrix").then(({ preloadRustCrypto }) => preloadRustCrypto()).catch(() => {});
}

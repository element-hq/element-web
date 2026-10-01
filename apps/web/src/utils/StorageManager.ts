/*
Copyright 2024 New Vector Ltd.
Copyright 2019-2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { IndexedDBStore, IndexedDBCryptoStore } from "matrix-js-sdk/src/matrix";
import { logger } from "matrix-js-sdk/src/logger";

import { getIDBFactory } from "./StorageAccess";

const localStorage = window.localStorage;

// The JS SDK will add a prefix of "matrix-js-sdk:" to the sync store name.
const SYNC_STORE_NAME = "riot-web-sync";
const LEGACY_CRYPTO_STORE_NAME = "matrix-js-sdk:crypto";
const RUST_CRYPTO_STORE_NAME = "matrix-js-sdk::matrix-sdk-crypto";

function log(msg: string): void {
    logger.log(`StorageManager: ${msg}`);
}

function warn(msg: string, ...args: any[]): void {
    logger.warn(`StorageManager: ${msg}`, ...args);
}

function error(msg: string, ...args: any[]): void {
    logger.error(`StorageManager: ${msg}`, ...args);
}

/**
 * Warn (in the logs, captured by rageshakes) that the browser refused to make our storage
 * persistent. Without durable storage the browser may evict IndexedDB — which holds the
 * end-to-end encryption crypto store — under storage pressure, forcing a re-login and
 * recovery-key re-entry. See https://github.com/element-hq/element-web/issues/32198.
 *
 * We deliberately do NOT surface a user-facing dialog/toast here: on a packaged desktop
 * (custom-scheme) build Chromium's durable-storage heuristic commonly returns `false` even
 * in the healthy case, so a per-login warning would be a false-alarm flood. The actual
 * post-eviction user prompt is handled separately by {@link checkConsistency} →
 * StorageEvictedDialog.
 */
function warnPersistenceDenied(): void {
    warn(
        "Persistent storage was not granted. The browser may evict locally stored data " +
            "(including the end-to-end encryption keys in the crypto store) under storage pressure, " +
            "which can force a re-login. See https://github.com/element-hq/element-web/issues/32198.",
    );
}

/**
 * Ask the browser to make our storage persistent (durable), so it is not evicted under
 * storage pressure. Acts on the result: warns when persistence is denied.
 *
 * Invoked on every login *and* session restore, so we first check whether storage is
 * already persistent and short-circuit to avoid re-requesting (some browsers re-prompt).
 *
 * Never rejects, so it is safe to call fire-and-forget.
 *
 * @returns whether storage is persistent after the attempt.
 */
export async function tryPersistStorage(): Promise<boolean> {
    try {
        if (navigator.storage && navigator.storage.persist) {
            // Avoid re-requesting (and possibly re-prompting) when we already have it. A failure
            // to *query* the state must not stop us from *requesting* persistence below.
            try {
                if (navigator.storage.persisted && (await navigator.storage.persisted())) {
                    log("Persistent storage already granted");
                    return true;
                }
            } catch (e) {
                warn("Could not query persisted-storage state; requesting persistence anyway", e);
            }
            const persistent = await navigator.storage.persist();
            log(`Persistent? ${persistent}`);
            if (!persistent) {
                warnPersistenceDenied();
            }
            return persistent;
        } else {
            log("Persistence unsupported");
            return false;
        }
    } catch (e) {
        // A storage-API hiccup must never reject into the fire-and-forget caller.
        error("Failed to request persistent storage", e);
        return false;
    }
}

export async function checkConsistency(): Promise<{
    healthy: boolean;
    cryptoInited: boolean;
    dataInCryptoStore: boolean;
    dataInLocalStorage: boolean;
}> {
    log("Checking storage consistency");
    log(`Local storage supported? ${!!localStorage}`);
    log(`IndexedDB supported? ${!!getIDBFactory()}`);

    let dataInLocalStorage = false;
    let dataInCryptoStore = false;
    let cryptoInited = false;
    let healthy = true;

    if (localStorage) {
        dataInLocalStorage = localStorage.length > 0;
        log(`Local storage contains data? ${dataInLocalStorage}`);

        cryptoInited = !!localStorage.getItem("mx_crypto_initialised");
        log(`Crypto initialised? ${cryptoInited}`);
    } else {
        healthy = false;
        error("Local storage cannot be used on this browser");
    }

    if (getIDBFactory() && localStorage) {
        const results = await checkSyncStore();
        if (!results.healthy) {
            healthy = false;
        }
    } else {
        healthy = false;
        error("Sync store cannot be used on this browser");
    }

    if (getIDBFactory()) {
        const results = await checkCryptoStore();
        dataInCryptoStore = results.exists;
        if (!results.healthy) {
            healthy = false;
        }
    } else {
        healthy = false;
        error("Crypto store cannot be used on this browser");
    }

    if (dataInLocalStorage && cryptoInited && !dataInCryptoStore) {
        healthy = false;
        error(
            "Data exists in local storage and crypto is marked as initialised but no data found in crypto store. " +
                "IndexedDB storage has likely been evicted by the browser!",
        );
    }

    if (healthy) {
        log("Storage consistency checks passed");
    } else {
        error("Storage consistency checks failed");
    }

    return {
        dataInLocalStorage,
        dataInCryptoStore,
        cryptoInited,
        healthy,
    };
}

interface StoreCheck {
    exists: boolean;
    healthy: boolean;
}

async function checkSyncStore(): Promise<StoreCheck> {
    let exists = false;
    try {
        exists = await IndexedDBStore.exists(getIDBFactory()!, SYNC_STORE_NAME);
        log(`Sync store using IndexedDB contains data? ${exists}`);
        return { exists, healthy: true };
    } catch (e) {
        error("Sync store using IndexedDB inaccessible", e);
    }
    log("Sync store using memory only");
    return { exists, healthy: false };
}

async function checkCryptoStore(): Promise<StoreCheck> {
    // check first if there is a rust crypto store
    try {
        const rustDbExists = await IndexedDBCryptoStore.exists(getIDBFactory()!, RUST_CRYPTO_STORE_NAME);
        log(`Rust Crypto store using IndexedDB contains data? ${rustDbExists}`);

        if (rustDbExists) {
            // There was an existing rust database, so consider it healthy.
            return { exists: true, healthy: true };
        } else {
            // No rust store, so let's check if there is a legacy store not yet migrated.
            try {
                const legacyIdbExists = await IndexedDBCryptoStore.existsAndIsNotMigrated(
                    getIDBFactory()!,
                    LEGACY_CRYPTO_STORE_NAME,
                );
                log(`Legacy Crypto store using IndexedDB contains non migrated data? ${legacyIdbExists}`);
                return { exists: legacyIdbExists, healthy: true };
            } catch (e) {
                error("Legacy crypto store using IndexedDB inaccessible", e);
            }

            // No need to check local storage or memory as rust stack doesn't support them.
            // Given that rust stack requires indexeddb, set healthy to false.
            return { exists: false, healthy: false };
        }
    } catch (e) {
        error("Rust crypto store using IndexedDB inaccessible", e);
        return { exists: false, healthy: false };
    }
}

/**
 * Sets whether crypto has ever been successfully
 * initialised on this client.
 * StorageManager uses this to determine whether indexeddb
 * has been wiped by the browser: this flag is saved to localStorage
 * and if it is true and not crypto data is found, an error is
 * presented to the user.
 *
 * @param {boolean} cryptoInited True if crypto has been set up
 */
export function setCryptoInitialised(cryptoInited: boolean): void {
    localStorage.setItem("mx_crypto_initialised", String(cryptoInited));
}

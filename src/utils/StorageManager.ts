/*
Copyright 2019-2021 The Matrix.org Foundation C.I.C.

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

import { LocalStorageCryptoStore, IndexedDBStore, IndexedDBCryptoStore } from "matrix-js-sdk/src/matrix";
import { logger } from "matrix-js-sdk/src/logger";

import SettingsStore from "../settings/SettingsStore";
import { Features } from "../settings/Settings";
import { getIDBFactory } from "./StorageAccess";

const localStorage = window.localStorage;

// The JS SDK will add a prefix of "matrix-js-sdk:" to the sync store name.
const SYNC_STORE_NAME = "riot-web-sync";
const LEGACY_CRYPTO_STORE_NAME = "matrix-js-sdk:crypto";
const RUST_CRYPTO_STORE_NAME = "matrix-js-sdk::matrix-sdk-crypto";

function log(msg: string): void {
    logger.log(`StorageManager: ${msg}`);
}

function error(msg: string, ...args: any[]): void {
    logger.error(`StorageManager: ${msg}`, ...args);
}

export function tryPersistStorage(): void {
    if (navigator.storage && navigator.storage.persist) {
        navigator.storage.persist().then((persistent) => {
            logger.log("StorageManager: Persistent?", persistent);
        });
    } else if (document.requestStorageAccess) {
        // Safari
        document.requestStorageAccess().then(
            () => logger.log("StorageManager: Persistent?", true),
            () => logger.log("StorageManager: Persistent?", false),
        );
    } else {
        logger.log("StorageManager: Persistence unsupported");
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
            "Data exists in local storage and crypto is marked as initialised " +
                " but no data found in crypto store. " +
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
    if (await SettingsStore.getValue(Features.RustCrypto)) {
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
    } else {
        let exists = false;
        // legacy checks
        try {
            exists = await IndexedDBCryptoStore.exists(getIDBFactory()!, LEGACY_CRYPTO_STORE_NAME);
            log(`Crypto store using IndexedDB contains data? ${exists}`);
            return { exists, healthy: true };
        } catch (e) {
            error("Crypto store using IndexedDB inaccessible", e);
        }
        try {
            exists = LocalStorageCryptoStore.exists(localStorage);
            log(`Crypto store using local storage contains data? ${exists}`);
            return { exists, healthy: true };
        } catch (e) {
            error("Crypto store using local storage inaccessible", e);
        }
        log("Crypto store using memory only");
        return { exists, healthy: false };
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

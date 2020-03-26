/*
Copyright 2019 New Vector Ltd

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

import Matrix from 'matrix-js-sdk';
import {LocalStorageCryptoStore} from 'matrix-js-sdk/src/crypto/store/localStorage-crypto-store';
import Analytics from '../Analytics';

const localStorage = window.localStorage;

// just *accessing* indexedDB throws an exception in firefox with
// indexeddb disabled.
let indexedDB;
try {
    indexedDB = window.indexedDB;
} catch (e) {}

// The JS SDK will add a prefix of "matrix-js-sdk:" to the sync store name.
const SYNC_STORE_NAME = "riot-web-sync";
const CRYPTO_STORE_NAME = "matrix-js-sdk:crypto";

function log(msg) {
    console.log(`StorageManager: ${msg}`);
}

function error(msg) {
    console.error(`StorageManager: ${msg}`);
}

function track(action) {
    Analytics.trackEvent("StorageManager", action);
}

export function tryPersistStorage() {
    if (navigator.storage && navigator.storage.persist) {
        navigator.storage.persist().then(persistent => {
            console.log("StorageManager: Persistent?", persistent);
        });
    } else if (document.requestStorageAccess) { // Safari
        document.requestStorageAccess().then(
            () => console.log("StorageManager: Persistent?", true),
            () => console.log("StorageManager: Persistent?", false),
        );
    } else {
        console.log("StorageManager: Persistence unsupported");
    }
}

export async function checkConsistency() {
    log("Checking storage consistency");
    log(`Local storage supported? ${!!localStorage}`);
    log(`IndexedDB supported? ${!!indexedDB}`);

    let dataInLocalStorage = false;
    let dataInCryptoStore = false;
    let cryptoInited = false;
    let healthy = true;

    if (localStorage) {
        dataInLocalStorage = localStorage.length > 0;
        log(`Local storage contains data? ${dataInLocalStorage}`);

        cryptoInited = localStorage.getItem("mx_crypto_initialised");
        log(`Crypto initialised? ${cryptoInited}`);
    } else {
        healthy = false;
        error("Local storage cannot be used on this browser");
        track("Local storage disabled");
    }

    if (indexedDB && localStorage) {
        const results = await checkSyncStore();
        if (!results.healthy) {
            healthy = false;
        }
    } else {
        healthy = false;
        error("Sync store cannot be used on this browser");
        track("Sync store disabled");
    }

    if (indexedDB) {
        const results = await checkCryptoStore();
        dataInCryptoStore = results.exists;
        if (!results.healthy) {
            healthy = false;
        }
    } else {
        healthy = false;
        error("Crypto store cannot be used on this browser");
        track("Crypto store disabled");
    }

    if (dataInLocalStorage && cryptoInited && !dataInCryptoStore) {
        healthy = false;
        error(
            "Data exists in local storage and crypto is marked as initialised " +
            " but no data found in crypto store. " +
            "IndexedDB storage has likely been evicted by the browser!",
        );
        track("Crypto store evicted");
    }

    if (healthy) {
        log("Storage consistency checks passed");
        track("Consistency checks passed");
    } else {
        error("Storage consistency checks failed");
        track("Consistency checks failed");
    }

    return {
        dataInLocalStorage,
        dataInCryptoStore,
        cryptoInited,
        healthy,
    };
}

async function checkSyncStore() {
    let exists = false;
    try {
        exists = await Matrix.IndexedDBStore.exists(
            indexedDB, SYNC_STORE_NAME,
        );
        log(`Sync store using IndexedDB contains data? ${exists}`);
        return { exists, healthy: true };
    } catch (e) {
        error("Sync store using IndexedDB inaccessible", e);
        track("Sync store using IndexedDB inaccessible");
    }
    log("Sync store using memory only");
    return { exists, healthy: false };
}

async function checkCryptoStore() {
    let exists = false;
    try {
        exists = await Matrix.IndexedDBCryptoStore.exists(
            indexedDB, CRYPTO_STORE_NAME,
        );
        log(`Crypto store using IndexedDB contains data? ${exists}`);
        return { exists, healthy: true };
    } catch (e) {
        error("Crypto store using IndexedDB inaccessible", e);
        track("Crypto store using IndexedDB inaccessible");
    }
    try {
        exists = await LocalStorageCryptoStore.exists(localStorage);
        log(`Crypto store using local storage contains data? ${exists}`);
        return { exists, healthy: true };
    } catch (e) {
        error("Crypto store using local storage inaccessible", e);
        track("Crypto store using local storage inaccessible");
    }
    log("Crypto store using memory only");
    return { exists, healthy: false };
}

export function trackStores(client) {
    if (client.store && client.store.on) {
        client.store.on("degraded", () => {
            track("Sync store using IndexedDB degraded to memory");
        });
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
 * @param {bool} cryptoInited True if crypto has been set up
 */
export function setCryptoInitialised(cryptoInited) {
    localStorage.setItem("mx_crypto_initialised", cryptoInited);
}

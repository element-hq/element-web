/*
Copyright 2018 New Vector Ltd

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

const TARGET_ORIGIN = 'vector://vector';
const BATCH_SIZE = 500;
let destFrame;

let initResolver = null;
let getSummaryResolver = null;

function onMessage(e) {
    if (e.origin !== TARGET_ORIGIN) return;

    if (e.data.cmd === 'initOK' && initResolver) {
        initResolver();
        initResolver = null;
    } else if (e.data.cmd === 'summary' && getSummaryResolver) {
        getSummaryResolver(e.data.data);
        getSummaryResolver = null;
    }
}

async function initDestFrame() {
    return new Promise(resolve => {
        initResolver = resolve;
        destFrame.postMessage({
            cmd: 'init', 
        }, TARGET_ORIGIN);
    });
}

async function getSummary() {
    return new Promise(resolve => {
        getSummaryResolver = resolve;
        destFrame.postMessage({
            cmd: 'getSummary', 
        }, TARGET_ORIGIN);
    });
}

async function doMigrate() {
    let accountSent = 0;
    let sessionsSent = 0;
    let inboundGroupSessionsSent = 0;
    let deviceDataSent = 0;
    let roomsSent = 0;
    let localStorageKeysSent = 0;

    if (!window.ipcRenderer) {
        console.error("ipcRenderer not found");
        return;
    }

    if (window.localStorage.getItem('mx_user_id') === null) {
        window.ipcRenderer.send("origin_migration_nodata");
        return;
    }

    destFrame = window.parent.frames.dest;

    await initDestFrame();

    const IndexedDBCryptoStore = window.matrixcs.IndexedDBCryptoStore;

    const cryptoStore = new IndexedDBCryptoStore(window.indexedDB, 'matrix-js-sdk:crypto');

    await cryptoStore.doTxn(
        'readonly', [IndexedDBCryptoStore.STORE_ACCOUNT],
        (txn) => {
            cryptoStore.getAccount(txn, (account) => {
                destFrame.postMessage({
                    cmd: 'storeAccount',
                    data: account,
                }, TARGET_ORIGIN);
                ++accountSent;
            });
        },
    );

    await cryptoStore.doTxn(
        'readonly', [IndexedDBCryptoStore.STORE_SESSIONS],
        (txn) => {
            let sessBatch = [];
            cryptoStore.getAllEndToEndSessions(txn, (sessInfo) => {
                if (sessInfo) {
                    ++sessionsSent;
                    sessBatch.push(sessInfo);
                }
                if (sessBatch.length >= BATCH_SIZE || sessInfo === null) {
                    destFrame.postMessage({
                        cmd: 'storeSessions',
                        data: sessBatch,
                    }, TARGET_ORIGIN);
                    sessBatch = [];
                }
            });
        },
    );

    await cryptoStore.doTxn(
        'readonly', [IndexedDBCryptoStore.STORE_INBOUND_GROUP_SESSIONS],
        (txn) => {
            let sessBatch = [];
            cryptoStore.getAllEndToEndInboundGroupSessions(txn, (sessInfo) => {
                if (sessInfo) {
                    ++inboundGroupSessionsSent;
                    sessBatch.push(sessInfo);
                }
                if (sessBatch.length >= BATCH_SIZE || sessInfo === null) {
                    destFrame.postMessage({
                        cmd: 'storeInboundGroupSessions',
                        data: sessBatch,
                    }, TARGET_ORIGIN);
                    sessBatch = [];
                }
            });
        },
    );

    await cryptoStore.doTxn(
        'readonly', [IndexedDBCryptoStore.STORE_DEVICE_DATA],
        (txn) => {
            cryptoStore.getEndToEndDeviceData(txn, (deviceData) => {
                destFrame.postMessage({
                    cmd: 'storeDeviceData',
                    data: deviceData,
                }, TARGET_ORIGIN);
                ++deviceDataSent;
            });
        },
    );

    await cryptoStore.doTxn(
        'readonly', [IndexedDBCryptoStore.STORE_ROOMS],
        (txn) => {
            cryptoStore.getEndToEndRooms(txn, (rooms) => {
                destFrame.postMessage({
                    cmd: 'storeRooms',
                    data: rooms,
                }, TARGET_ORIGIN);
                ++roomsSent;
            });
        },
    );

    // we don't bother migrating;
    // * sync data (we can just initialsync again)
    // * logs
    // * key requests (worst case they'll just be re-sent)
    // * sessions needing backup (feature isn't available on Electron)

    for (let i = 0; i < window.localStorage.length; ++i) {
        const key = window.localStorage.key(i);
        const val = window.localStorage.getItem(key);
        
        destFrame.postMessage({
            cmd: 'storeLocalStorage',
            data: { key, val },
        }, TARGET_ORIGIN);
        ++localStorageKeysSent;
    }

    const summary = await getSummary();
    let success = false;
    if (
        summary.accountStored === accountSent &&
        summary.sessionsStored === sessionsSent &&
        summary.inboundGroupSessionsStored === inboundGroupSessionsSent &&
        summary.deviceDataStored === deviceDataSent &&
        summary.roomsStored === roomsSent &&
        summary.localStorageKeysStored === localStorageKeysSent
    ) {
        success = true;
        window.localStorage.clear();
        await cryptoStore.deleteAllData();

        // we don't bother migrating them, but also blow away the sync & logs db,
        // otherwise they'll just hang about taking up space
        await new Promise(resolve => {
            const req = window.indexedDB.deleteDatabase('matrix-js-sdk:riot-web-sync');
            req.onsuccess = resolve;
            req.onerror = resolve;
        });
        await new Promise(resolve => {
            const req = window.indexedDB.deleteDatabase('logs');
            req.onsuccess = resolve;
            req.onerror = resolve;
        });
    }

    window.ipcRenderer.send("origin_migration_complete", success, {
        accountSent, sessionsSent, inboundGroupSessionsSent,
        deviceDataSent, roomsSent, localStorageKeysSent,
    }, summary);
}

window.addEventListener('message', onMessage);

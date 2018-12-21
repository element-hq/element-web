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

const SOURCE_ORIGIN = 'file://';

const IndexedDBCryptoStore = window.matrixcs.IndexedDBCryptoStore;
const cryptoStore = new IndexedDBCryptoStore(window.indexedDB, 'matrix-js-sdk:crypto');

let accountStored = 0;
let sessionsStored = 0;
let inboundGroupSessionsStored = 0;
let deviceDataStored = 0;
let roomsStored = 0;
let localStorageKeysStored = 0;

const promises = [];

async function onMessage(e) {
    if (e.origin !== SOURCE_ORIGIN) return;

    const data = e.data.data; // bleh, naming clash
    switch (e.data.cmd) {
        case 'init':
            // start with clean stores before we migrate data in
            window.localStorage.clear();
            await cryptoStore.deleteAllData();

            e.source.postMessage({
                cmd: 'initOK',
            }, SOURCE_ORIGIN);
            break;
        case 'storeAccount':
            promises.push(cryptoStore.doTxn(
                'readwrite', [IndexedDBCryptoStore.STORE_ACCOUNT],
                (txn) => {
                    cryptoStore.storeAccount(txn, data);
                },
            ).then(() => {
                ++accountStored;
            }));
            break;
        case 'storeSessions':
            promises.push(cryptoStore.doTxn(
                'readwrite', [IndexedDBCryptoStore.STORE_SESSIONS],
                (txn) => {
                    for (const sess of data) {
                        cryptoStore.storeEndToEndSession(sess.deviceKey, sess.sessionId, sess, txn);
                    }
                },
            ).then(() => {
                sessionsStored += data.length;
            }));
            break;
        case 'storeInboundGroupSessions':
            promises.push(cryptoStore.doTxn(
                'readwrite', [IndexedDBCryptoStore.STORE_INBOUND_GROUP_SESSIONS],
                (txn) => {
                    for (const sess of data) {
                        cryptoStore.addEndToEndInboundGroupSession(
                            sess.senderKey, sess.sessionId, sess.sessionData, txn,
                        );
                    }
                },
            ).then(() => {
                inboundGroupSessionsStored += data.length;
            }));
            break;
        case 'storeDeviceData':
            promises.push(cryptoStore.doTxn(
                'readwrite', [IndexedDBCryptoStore.STORE_DEVICE_DATA],
                (txn) => {
                    cryptoStore.storeEndToEndDeviceData(data, txn);
                },
            ).then(() => {
                ++deviceDataStored;
            }));
            break;
        case 'storeRooms':
            promises.push(cryptoStore.doTxn(
                'readwrite', [IndexedDBCryptoStore.STORE_ROOMS],
                (txn) => {
                    for (const [roomId, roomInfo] of Object.entries(data)) {
                        cryptoStore.storeEndToEndRoom(roomId, roomInfo, txn);
                    }
                },
            ).then(() => {
                ++roomsStored;
            }));
            break;
        case 'storeLocalStorage':
            window.localStorage.setItem(data.key, data.val);
            ++localStorageKeysStored;
            break;
        case 'getSummary':
            await Promise.all(promises);
            e.source.postMessage({
                cmd: 'summary',
                data: {
                    accountStored,
                    sessionsStored,
                    inboundGroupSessionsStored,
                    deviceDataStored,
                    roomsStored,
                    localStorageKeysStored,
                },
            }, SOURCE_ORIGIN);
            break;
    }
}

window.addEventListener('message', onMessage);


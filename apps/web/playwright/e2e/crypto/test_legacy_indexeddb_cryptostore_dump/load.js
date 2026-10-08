/*
Copyright 2024 New Vector Ltd.
Copyright 2023, 2024 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

/* Browser-side javascript to fetch the indexeddb dump file, and populate indexeddb. */

/** The pickle key corresponding to the data dump. */
const PICKLE_KEY = "+1k2Ppd7HIisUY824v7JtV3/oEE4yX0TqtmNPyhaD7o";

/**
 * Populate an IndexedDB store with the test data from this directory.
 *
 * @param {any} data - IndexedDB dump to import
 * @param {string} name - Name of the IndexedDB database to create.
 */
async function populateStore(data, name) {
    const req = indexedDB.open(name, 11);

    const db = await new Promise((resolve, reject) => {
        req.onupgradeneeded = (ev) => {
            const db = req.result;
            const oldVersion = ev.oldVersion;
            upgradeDatabase(oldVersion, db);
        };

        req.onerror = (ev) => {
            reject(req.error);
        };

        req.onsuccess = () => {
            const db = req.result;
            resolve(db);
        };
    });

    await importData(data, db);

    return db;
}

/**
 * Create the schema for the indexed db store
 *
 * @param {number} oldVersion - The current version of the store.
 * @param {IDBDatabase} db - The indexeddb database.
 */
function upgradeDatabase(oldVersion, db) {
    if (oldVersion < 1) {
        const outgoingRoomKeyRequestsStore = db.createObjectStore("outgoingRoomKeyRequests", { keyPath: "requestId" });
        outgoingRoomKeyRequestsStore.createIndex("session", ["requestBody.room_id", "requestBody.session_id"]);
        outgoingRoomKeyRequestsStore.createIndex("state", "state");
    }

    if (oldVersion < 2) {
        db.createObjectStore("account");
    }

    if (oldVersion < 3) {
        const sessionsStore = db.createObjectStore("sessions", { keyPath: ["deviceKey", "sessionId"] });
        sessionsStore.createIndex("deviceKey", "deviceKey");
    }

    if (oldVersion < 4) {
        db.createObjectStore("inbound_group_sessions", { keyPath: ["senderCurve25519Key", "sessionId"] });
    }

    if (oldVersion < 5) {
        db.createObjectStore("device_data");
    }

    if (oldVersion < 6) {
        db.createObjectStore("rooms");
    }

    if (oldVersion < 7) {
        db.createObjectStore("sessions_needing_backup", { keyPath: ["senderCurve25519Key", "sessionId"] });
    }

    if (oldVersion < 8) {
        db.createObjectStore("inbound_group_sessions_withheld", { keyPath: ["senderCurve25519Key", "sessionId"] });
    }

    if (oldVersion < 9) {
        const problemsStore = db.createObjectStore("session_problems", { keyPath: ["deviceKey", "time"] });
        problemsStore.createIndex("deviceKey", "deviceKey");

        db.createObjectStore("notified_error_devices", { keyPath: ["userId", "deviceId"] });
    }

    if (oldVersion < 10) {
        db.createObjectStore("shared_history_inbound_group_sessions", { keyPath: ["roomId"] });
    }

    if (oldVersion < 11) {
        db.createObjectStore("parked_shared_history", { keyPath: ["roomId"] });
    }
}

/** Do the import of data into the database
 *
 * @param {any} json - The data to import.
 * @param {IDBDatabase} db - The database to import into.
 * @returns {Promise<void>}
 */
async function importData(json, db) {
    for (const [storeName, data] of Object.entries(json)) {
        await new Promise((resolve, reject) => {
            console.log(`Populating ${storeName} with test data`);
            const store = db.transaction(storeName, "readwrite").objectStore(storeName);

            function putEntry(idx) {
                if (idx >= data.length) {
                    resolve(undefined);
                    return;
                }

                const { key, value } = data[idx];
                try {
                    const putReq = store.put(value, key);
                    putReq.onsuccess = (_) => putEntry(idx + 1);
                    putReq.onerror = (_) => reject(putReq.error);
                } catch (e) {
                    throw new Error(
                        `Error populating '${storeName}' with key ${JSON.stringify(key)}, value ${JSON.stringify(
                            value,
                        )}: ${e}`,
                    );
                }
            }

            putEntry(0);
        });
    }
}

function getPickleAdditionalData(userId, deviceId) {
    const additionalData = new Uint8Array(userId.length + deviceId.length + 1);
    for (let i = 0; i < userId.length; i++) {
        additionalData[i] = userId.charCodeAt(i);
    }
    additionalData[userId.length] = 124; // "|"
    for (let i = 0; i < deviceId.length; i++) {
        additionalData[userId.length + 1 + i] = deviceId.charCodeAt(i);
    }
    return additionalData;
}

/** Save an entry to the `matrix-react-sdk` indexeddb database.
 *
 * If `matrix-react-sdk` does not yet exist, it will be created with the correct schema.
 *
 * @param {String} table
 * @param {String} key
 * @param {String} data
 * @returns {Promise<void>}
 */
async function idbSave(table, key, data) {
    const idb = await new Promise((resolve, reject) => {
        const request = indexedDB.open("matrix-react-sdk", 1);
        request.onerror = reject;
        request.onsuccess = () => {
            resolve(request.result);
        };
        request.onupgradeneeded = () => {
            const db = request.result;
            db.createObjectStore("pickleKey");
            db.createObjectStore("account");
        };
    });
    return await new Promise((resolve, reject) => {
        const txn = idb.transaction([table], "readwrite");
        txn.onerror = reject;

        const objectStore = txn.objectStore(table);
        const request = objectStore.put(data, key);
        request.onerror = reject;
        request.onsuccess = resolve;
    });
}

/**
 * Save the pickle key to indexeddb, so that the app can read it.
 *
 * @param {String} userId  - The user's ID (used in the encryption algorithm).
 * @param {String} deviceId  - The user's device ID (ditto).
 * @returns {Promise<void>}
 */
async function savePickleKey(userId, deviceId) {
    const itFunc = function* () {
        const decoded = atob(PICKLE_KEY);
        for (let i = 0; i < decoded.length; ++i) {
            yield decoded.charCodeAt(i);
        }
    };
    const decoded = Uint8Array.from(itFunc());

    const cryptoKey = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
    const iv = new Uint8Array(32);
    crypto.getRandomValues(iv);

    const additionalData = getPickleAdditionalData(userId, deviceId);
    const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData }, cryptoKey, decoded);

    await idbSave("pickleKey", [userId, deviceId], { encrypted, iv, cryptoKey });
}

async function loadDump() {
    const dump = await fetch("dump.json");
    const indexedDbDump = await dump.json();
    await populateStore(indexedDbDump, "matrix-js-sdk:crypto");
    await savePickleKey(window.localStorage.getItem("mx_user_id"), window.localStorage.getItem("mx_device_id"));
    console.log("Test data loaded; redirecting to main app");
    window.location.replace("/");
}

loadDump();

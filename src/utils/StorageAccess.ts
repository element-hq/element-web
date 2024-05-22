/*
Copyright 2019-2021, 2024 The Matrix.org Foundation C.I.C.

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

/**
 * Retrieves the IndexedDB factory object.
 *
 * @returns {IDBFactory | undefined} The IndexedDB factory object if available, or undefined if it is not supported.
 */
export function getIDBFactory(): IDBFactory | undefined {
    // IndexedDB loading is lazy for easier testing.

    // just *accessing* _indexedDB throws an exception in firefox with
    // indexeddb disabled.
    try {
        // `self` is preferred for service workers, which access this file's functions.
        // We check `self` first because `window` returns something which doesn't work for service workers.
        // Note: `self?.indexedDB ?? window.indexedDB` breaks in service workers for unknown reasons.
        return self?.indexedDB ? self.indexedDB : window.indexedDB;
    } catch (e) {}
}

let idb: IDBDatabase | null = null;

async function idbInit(): Promise<void> {
    if (!getIDBFactory()) {
        throw new Error("IndexedDB not available");
    }
    idb = await new Promise((resolve, reject) => {
        const request = getIDBFactory()!.open("matrix-react-sdk", 1);
        request.onerror = reject;
        request.onsuccess = (): void => {
            resolve(request.result);
        };
        request.onupgradeneeded = (): void => {
            const db = request.result;
            db.createObjectStore("pickleKey");
            db.createObjectStore("account");
        };
    });
}

/**
 * Loads an item from an IndexedDB table within the underlying `matrix-react-sdk` database.
 *
 * If IndexedDB access is not supported in the environment, an error is thrown.
 *
 * @param {string} table The name of the object store in IndexedDB.
 * @param {string | string[]} key The key where the data is stored.
 * @returns {Promise<any>} A promise that resolves with the retrieved item from the table.
 */
export async function idbLoad(table: string, key: string | string[]): Promise<any> {
    if (!idb) {
        await idbInit();
    }
    return new Promise((resolve, reject) => {
        const txn = idb!.transaction([table], "readonly");
        txn.onerror = reject;

        const objectStore = txn.objectStore(table);
        const request = objectStore.get(key);
        request.onerror = reject;
        request.onsuccess = (event): void => {
            resolve(request.result);
        };
    });
}

/**
 * Saves data to an IndexedDB table within the underlying `matrix-react-sdk` database.
 *
 * If IndexedDB access is not supported in the environment, an error is thrown.
 *
 * @param {string} table The name of the object store in the IndexedDB.
 * @param {string|string[]} key The key to use for storing the data.
 * @param {*} data The data to be saved.
 * @returns {Promise<void>} A promise that resolves when the data is saved successfully.
 */
export async function idbSave(table: string, key: string | string[], data: any): Promise<void> {
    if (!idb) {
        await idbInit();
    }
    return new Promise((resolve, reject) => {
        const txn = idb!.transaction([table], "readwrite");
        txn.onerror = reject;

        const objectStore = txn.objectStore(table);
        const request = objectStore.put(data, key);
        request.onerror = reject;
        request.onsuccess = (event): void => {
            resolve();
        };
    });
}

/**
 * Deletes a record from an IndexedDB table within the underlying `matrix-react-sdk` database.
 *
 * If IndexedDB access is not supported in the environment, an error is thrown.
 *
 * @param {string} table The name of the object store where the record is stored.
 * @param {string|string[]} key The key of the record to be deleted.
 * @returns {Promise<void>} A Promise that resolves when the record(s) have been successfully deleted.
 */
export async function idbDelete(table: string, key: string | string[]): Promise<void> {
    if (!idb) {
        await idbInit();
    }
    return new Promise((resolve, reject) => {
        const txn = idb!.transaction([table], "readwrite");
        txn.onerror = reject;

        const objectStore = txn.objectStore(table);
        const request = objectStore.delete(key);
        request.onerror = reject;
        request.onsuccess = (): void => {
            resolve();
        };
    });
}

/*
Copyright 2020 The Matrix.org Foundation C.I.C.

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

/* Simple wrapper around IndexedDB.
 */

let idb = null;

async function idbInit(): Promise<void> {
    idb = await new Promise((resolve, reject) => {
        const request = window.indexedDB.open("element", 1);
        request.onerror = reject;
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore: TS thinks target.result doesn't exist
        request.onsuccess = (event) => { resolve(event.target.result); };
        request.onupgradeneeded = (event) => {
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore: TS thinks target.result doesn't exist
            const db = event.target.result;
            db.createObjectStore("pickleKey");
            db.createObjectStore("account");
        };
    });
}

export async function idbLoad(
    table: string,
    key: string | string[],
): Promise<any> {
    if (!idb) {
        await idbInit();
    }
    return new Promise((resolve, reject) => {
        const txn = idb.transaction([table], "readonly");
        txn.onerror = reject;

        const objectStore = txn.objectStore(table);
        const request = objectStore.get(key);
        request.onerror = reject;
        request.onsuccess = (event) => { resolve(request.result); };
    });
}

export async function idbSave(
    table: string,
    key: string | string[],
    data: any,
): Promise<void> {
    if (!idb) {
        await idbInit();
    }
    return new Promise((resolve, reject) => {
        const txn = idb.transaction([table], "readwrite");
        txn.onerror = reject;

        const objectStore = txn.objectStore(table);
        const request = objectStore.put(data, key);
        request.onerror = reject;
        request.onsuccess = (event) => { resolve(); };
    });
}

export async function idbDelete(
    table: string,
    key: string | string[],
): Promise<void> {
    if (!idb) {
        await idbInit();
    }
    return new Promise((resolve, reject) => {
        const txn = idb.transaction([table], "readwrite");
        txn.onerror = reject;

        const objectStore = txn.objectStore(table);
        const request = objectStore.delete(key);
        request.onerror = reject;
        request.onsuccess = (event) => { resolve(); };
    });
}

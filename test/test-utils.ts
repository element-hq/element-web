/*
Copyright 2016-2022 The Matrix.org Foundation C.I.C.

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

export function cleanLocalstorage(): void {
    window.localStorage.clear();
}

export function deleteIndexedDB(dbName: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        if (!window.indexedDB) {
            resolve();
            return;
        }

        const startTime = Date.now();
        console.log(`${startTime}: Removing indexeddb instance: ${dbName}`);
        const req = window.indexedDB.deleteDatabase(dbName);

        req.onblocked = () => {
            console.log(`${Date.now()}: can't yet delete indexeddb ${dbName} because it is open elsewhere`);
        };

        req.onerror = (ev) => {
            reject(new Error(
                `${Date.now()}: unable to delete indexeddb ${dbName}: ${req.error}`,
            ));
        };

        req.onsuccess = () => {
            const now = Date.now();
            console.log(`${now}: Removed indexeddb instance: ${dbName} in ${now-startTime} ms`);
            resolve();
        };
    }).catch((e) => {
        console.error(`${Date.now()}: Error removing indexeddb instance ${dbName}: ${e}`);
        throw e;
    });
}

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

/**
 * Check if an IndexedDB database exists. The only way to do so is to try opening it, so
 * we do that and then delete it did not exist before.
 *
 * @param indexedDB - The `indexedDB` interface
 * @param dbName - The database name to test for
 * @returns Whether the database exists
 */
export function exists(indexedDB: IDBFactory, dbName: string): Promise<boolean> {
    return new Promise<boolean>((resolve, reject) => {
        let exists = true;
        const req = indexedDB.open(dbName);
        req.onupgradeneeded = (): void => {
            // Since we did not provide an explicit version when opening, this event
            // should only fire if the DB did not exist before at any version.
            exists = false;
        };
        req.onblocked = (): void => reject(req.error);
        req.onsuccess = (): void => {
            const db = req.result;
            db.close();
            if (!exists) {
                // The DB did not exist before, but has been created as part of this
                // existence check. Delete it now to restore previous state. Delete can
                // actually take a while to complete in some browsers, so don't wait for
                // it. This won't block future open calls that a store might issue next to
                // properly set up the DB.
                indexedDB.deleteDatabase(dbName);
            }
            resolve(exists);
        };
        req.onerror = (): void => reject(req.error);
    });
}

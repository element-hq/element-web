/*
Copyright 2017 - 2021 The Matrix.org Foundation C.I.C.

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
import {
    MatrixClient,
    createClient,
    ICreateClientOpts,
    MemoryCryptoStore,
    MemoryStore,
    IndexedDBCryptoStore,
    IndexedDBStore,
    LocalStorageCryptoStore,
} from "matrix-js-sdk/src/matrix";

import indexeddbWorkerFactory from "../workers/indexeddbWorkerFactory";

const localStorage = window.localStorage;

// just *accessing* indexedDB throws an exception in firefox with
// indexeddb disabled.
let indexedDB: IDBFactory;
try {
    indexedDB = window.indexedDB;
} catch (e) {}

/**
 * Create a new matrix client, with the persistent stores set up appropriately
 * (using localstorage/indexeddb, etc)
 *
 * @param {Object} opts  options to pass to Matrix.createClient. This will be
 *    extended with `sessionStore` and `store` members.
 *
 * @returns {MatrixClient} the newly-created MatrixClient
 */
export default function createMatrixClient(opts: ICreateClientOpts): MatrixClient {
    const storeOpts: Partial<ICreateClientOpts> = {
        useAuthorizationHeader: true,
    };

    if (indexedDB && localStorage) {
        storeOpts.store = new IndexedDBStore({
            indexedDB: indexedDB,
            dbName: "riot-web-sync",
            localStorage,
            workerFactory: indexeddbWorkerFactory,
        });
    } else if (localStorage) {
        storeOpts.store = new MemoryStore({ localStorage });
    }

    if (indexedDB) {
        storeOpts.cryptoStore = new IndexedDBCryptoStore(indexedDB, "matrix-js-sdk:crypto");
    } else if (localStorage) {
        storeOpts.cryptoStore = new LocalStorageCryptoStore(localStorage);
    } else {
        storeOpts.cryptoStore = new MemoryCryptoStore();
    }

    return createClient({
        ...storeOpts,
        ...opts,
    });
}

/*
Copyright 2017 Vector Creations Ltd

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

const localStorage = window.localStorage;

/**
 * Create a new matrix client, with the persistent stores set up appropriately
 * (using localstorage/indexeddb, etc)
 *
 * @param {Object} opts  options to pass to Matrix.createClient. This will be
 *    extended with `sessionStore` and `store` members.
 *
 * @param {string} indexedDbWorkerScript  Optional URL for a web worker script
 *    for IndexedDB store operations. If not given, indexeddb ops are done on
 *    the main thread.
 *
 * @returns {MatrixClient} the newly-created MatrixClient
 */
export default function createMatrixClient(opts, indexedDbWorkerScript) {
    const storeOpts = {};

    if (localStorage) {
        storeOpts.sessionStore = new Matrix.WebStorageSessionStore(localStorage);
    }
    if (window.indexedDB && localStorage) {
        // FIXME: bodge to remove old database. Remove this after a few weeks.
        window.indexedDB.deleteDatabase("matrix-js-sdk:default");

        storeOpts.store = new Matrix.IndexedDBStore({
            indexedDB: window.indexedDB,
            dbName: "riot-web-sync",
            localStorage: localStorage,
            workerScript: indexedDbWorkerScript,
        });
    }

    opts = Object.assign(storeOpts, opts);

    return Matrix.createClient(opts);
}

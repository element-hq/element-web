/*
Copyright 2019 The Matrix.org Foundation C.I.C.

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

import request from "browser-request";
import queryString from "qs";

import * as matrixcs from "./matrix";

matrixcs.request(function(opts, fn) {
    // We manually fix the query string for browser-request because
    // it doesn't correctly handle cases like ?via=one&via=two. Instead
    // we mimic `request`'s query string interface to make it all work
    // as expected.
    // browser-request will happily take the constructed string as the
    // query string without trying to modify it further.
    opts.qs = queryString.stringify(opts.qs || {}, opts.qsStringifyOptions);
    return request(opts, fn);
});

// just *accessing* indexedDB throws an exception in firefox with
// indexeddb disabled.
let indexedDB;
try {
    indexedDB = global.indexedDB;
} catch (e) {}

// if our browser (appears to) support indexeddb, use an indexeddb crypto store.
if (indexedDB) {
    matrixcs.setCryptoStoreFactory(
        function() {
            return new matrixcs.IndexedDBCryptoStore(
                indexedDB, "matrix-js-sdk:crypto",
            );
        },
    );
}

// We export 3 things to make browserify happy as well as downstream projects.
// It's awkward, but required.
export * from "./matrix";
export default matrixcs; // keep export for browserify package deps
global.matrixcs = matrixcs;

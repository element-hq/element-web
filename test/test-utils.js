"use strict";

var q = require('q');

/**
 * Perform common actions before each test case, e.g. printing the test case
 * name to stdout.
 * @param {Mocha.Context} context  The test context
 */
export function beforeEach(context) {
    var desc = context.currentTest.fullTitle();
    console.log();
    console.log(desc);
    console.log(new Array(1 + desc.length).join("="));

    // some tests store things in localstorage. Improve independence of tests
    // by making sure that they don't inherit any old state.
    window.localStorage.clear();
}

/**
 * returns true if the current environment supports webrtc
 */
export function browserSupportsWebRTC() {
    var n = global.window.navigator;
    return n.getUserMedia || n.webkitGetUserMedia ||
        n.mozGetUserMedia;
}

export function deleteIndexedDB(dbName) {
    return new q.Promise((resolve, reject) => {
        if (!window.indexedDB) {
            resolve();
            return;
        }

        console.log(`${Date.now()}: Removing indexeddb instance: ${dbName}`);
        const req = window.indexedDB.deleteDatabase(dbName);

        req.onblocked = () => {
            console.log(`${Date.now()}: can't yet delete indexeddb ${dbName} because it is open elsewhere`);
        };

        req.onerror = (ev) => {
            reject(new Error(
                `${Date.now()}: unable to delete indexeddb ${dbName}: ${ev.target.error}`,
            ));
        };

        req.onsuccess = () => {
            console.log(`${Date.now()}: Removed indexeddb instance: ${dbName}`);
            resolve();
        };
    }).catch((e) => {
        console.error(`${Date.now()}: Error removing indexeddb instance ${dbName}: ${e}`);
        throw e;
    });
}

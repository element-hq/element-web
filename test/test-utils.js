"use strict";

/**
 * Perform common actions before each test case, e.g. printing the test case
 * name to stdout.
 * @param {Mocha.Context} context  The test context
 */
export function beforeEach(context) {
    const desc = context.currentTest.fullTitle();
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
    const n = global.window.navigator;
    return n.getUserMedia || n.webkitGetUserMedia ||
        n.mozGetUserMedia;
}

export function deleteIndexedDB(dbName) {
    return new Promise((resolve, reject) => {
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
                `${Date.now()}: unable to delete indexeddb ${dbName}: ${ev.target.error}`,
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

export function sleep(ms) {
    return new Promise((resolve) => { setTimeout(resolve, ms); });
}

/*
Copyright 2017 OpenMarket Ltd

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

// This module contains all the code needed to log the console, persist it to disk and submit bug reports. Rationale is as follows:
//  - Monkey-patching the console is preferable to having a log library because we can catch logs by other libraries more easily,
//    without having to all depend on the same log framework / pass the logger around.
//  - We use IndexedDB to persists logs because it has generous disk space limits compared to local storage. IndexedDB does not work
//    in incognito mode, in which case this module will not be able to write logs to disk. However, the logs will still be stored
//    in-memory, so can still be submitted in a bug report should the user wish to: we can also store more logs in-memory than in
//    local storage, which does work in incognito mode. We also need to handle the case where there are 2+ tabs. Each JS runtime
//    generates a random string which serves as the "ID" for that tab/session. These IDs are stored along with the log lines.
//  - Bug reports are sent as a POST over HTTPS: it purposefully does not use Matrix as bug reports may be made when Matrix is
//    not responsive (which may be the cause of the bug). We send the most recent N MB of UTF-8 log data, starting with the most
//    recent, which we know because the "ID"s are actually timestamps. We then purge the remaining logs. We also do this purge
//    on startup to prevent logs from accumulating.

const FLUSH_RATE_MS = 30 * 1000;

// A class which monkey-patches the global console and stores log lines.
class ConsoleLogger {
    constructor() {
        this.logs = "";

        // Monkey-patch console logging
        const consoleFunctionsToLevels = {
            log: "I",
            info: "I",
            warn: "W",
            error: "E",
        };
        Object.keys(consoleFunctionsToLevels).forEach((fnName) => {
            const level = consoleFunctionsToLevels[fnName];
            let originalFn = window.console[fnName].bind(window.console);
            window.console[fnName] = (...args) => {
                this.log(level, ...args);
                originalFn(...args);
            }
        });
    }

    log(level, ...args) {
        // We don't know what locale the user may be running so use ISO strings
        const ts = new Date().toISOString();
        // Some browsers support string formatting which we're not doing here
        // so the lines are a little more ugly but easy to implement / quick to run.
        // Example line:
        // 2017-01-18T11:23:53.214Z W Failed to set badge count: Error setting badge. Message: Too many badges requests in queue.
        const line = `${ts} ${level} ${args.join(' ')}\n`;
        // Using + really is the quickest way in JS
        // http://jsperf.com/concat-vs-plus-vs-join
        this.logs += line;
    }

    /**
     * Retrieve log lines to flush to disk.
     * @return {string} \n delimited log lines to flush.
     */
    flush() {
        // The ConsoleLogger doesn't care how these end up on disk, it just flushes them to the caller.
        const logsToFlush = this.logs;
        this.logs = "";
        return logsToFlush;
    }
}

// A class which stores log lines in an IndexedDB instance.
class IndexedDBLogStore {
    constructor(indexedDB, logger) {
        this.indexedDB = indexedDB;
        this.logger = logger;
        this.id = "instance-" + Date.now();
        this.index = 0;
        this.db = null;
    }

    /**
     * @return {Promise} Resolves when the store is ready.
     */
    connect() {
        let req = this.indexedDB.open("logs");
        return new Promise((resolve, reject) => {
            req.onsuccess = (event) => {
                this.db = event.target.result;
                // Periodically flush logs to local storage / indexeddb
                setInterval(this.flush.bind(this), FLUSH_RATE_MS);
                resolve();
            };

            req.onerror = (event) => {
                const err = "Failed to open log database: " + event.target.errorCode;
                console.error(err);
                reject(new Error(err));
            };

            // First time: Setup the object store
            req.onupgradeneeded = (event) => {
                const db = event.target.result;
                const objectStore = db.createObjectStore("logs", {
                    keyPath: ["id", "index"]
                });
                // Keys in the database look like: [ "instance-148938490", 0 ]
                // Later on we need to query for everything with index=0, and query everything for an instance id.
                // In order to do this, we need to set up indexes on both "id" and "index".
                objectStore.createIndex("index", "index", { unique: false });
                objectStore.createIndex("id", "id", { unique: false });

                objectStore.add(
                    this._generateLogEntry(
                        new Date() + " ::: Log database was created."
                    )
                );
            }
        });
    }

    /**
     * @return {Promise} Resolved when the logs have been flushed.
     */
    flush() {
        if (!this.db) {
            // not connected yet or user rejected access for us to r/w to the db
            return Promise.reject(new Error("No connected database"));
        }
        const lines = this.logger.flush();
        if (lines.length === 0) {
            return Promise.resolve();
        }
        return new Promise((resolve, reject) => {
            let txn = this.db.transaction("logs", "readwrite");
            let objStore = txn.objectStore("logs");
            objStore.add(this._generateLogEntry(lines));
            txn.oncomplete = (event) => {
                resolve();
            };
            txn.onerror = (event) => {
                console.error("Failed to flush logs : " + event.target.errorCode);
                reject(new Error("Failed to write logs: " + event.target.errorCode));
            }
        });
    }

    /**
     * Consume the most recent logs and return them. Older logs which are not returned are deleted at the same time,
     * so this can be called at startup to do house-keeping to keep the logs from growing too large.
     *
     * @param {boolean} clearAll True to clear the most recent logs returned in addition to the
     * older logs. This is desirable when sending bug reports as we do not want to submit the
     * same logs twice. This is not desirable when doing house-keeping at startup in case they
     * want to submit a bug report later.
     * @return {Promise<Object[]>} Resolves to an array of objects. The array is sorted in time (oldest first) based on
     * when the log file was created (the log ID). The objects have said log ID in an "id" field and "lines" which is a
     * big string with all the new-line delimited logs.
     */
    consume(clearAll) {
        const MAX_LOG_SIZE = 1024 * 1024 * 50; // 50 MB
        // To gather all the logs, we first query for every log entry with index "0", this will let us
        // know all the IDs from different tabs/sessions.
        const txn = this.db.transaction("logs", "readonly");
        const objectStore = txn.objectStore("logs");
        return selectQuery(objectStore.index("index"), IDBKeyRange.only(0), (cursor) => cursor.value.id).then((res) => {
            console.log("Instances: ", res);
        });

            // we know each entry has a unique ID, and we know IDs are timestamps, so accumulate all the IDs,
            // ignoring the logs for now, and sort them to work out the correct log ID ordering.

            // Starting with the most recent ID, fetch the logs (all indices) for said ID and accumulate them
            // in order. After fetching ALL the logs for an ID, recheck the total length of the logs to work out
            // if we have exceeded the max size cutoff for "recent" logs.

            // Remove all logs that are older than the cutoff (or the entire logs if clearAll is set).

            // Return the logs that are within the cutoff.
    }

    _generateLogEntry(lines) {
        return {
            id: this.id,
            lines: lines,
            index: this.index++
        };
    }
}

/**
 * Helper method to collect results from a Cursor and promiseify it.
 * @param {ObjectStore|Index} store The store to perform openCursor on.
 * @param {IDBKeyRange=} keyRange Optional key range to apply on the cursor.
 * @param {Function} resultMapper A function which is repeatedly called with a Cursor.
 * Return the data you want to keep.
 * @return {Promise<T[]>} Resolves to an array of whatever you returned from resultMapper.
 */
function selectQuery(store, keyRange, resultMapper) {
    const query = store.openCursor(keyRange);
    return new Promise((resolve, reject) => {
        let results = [];
        query.onerror = (event) => {
            reject(new Error("Query failed: " + event.target.errorCode));
        };
        // collect results
        query.onsuccess = (event) => {
            const cursor = event.target.result;
            if (!cursor) {
                resolve(results);
                return; // end of results
            }
            results.push(resultMapper(cursor));
            cursor.continue();
        }
    });
}


let store = null;
let inited = false;
module.exports = {

    /**
     * Configure rage shaking support for sending bug reports.
     * Modifies globals.
     */
    init: function() {
        if (inited || !window.indexedDB) {
            return;
        }
        store = new IndexedDBLogStore(window.indexedDB, new ConsoleLogger());
        inited = true;
        return store.connect();
    },

    /**
     * Force-flush the logs to storage.
     * @return {Promise} Resolved when the logs have been flushed.
     */
    flush: function() {
        if (!store) {
            return;
        }
        return store.flush();
    },

    /**
     * Send a bug report.
     * @param {string} userText Any additional user input.
     * @return {Promise} Resolved when the bug report is sent.
     */
    sendBugReport: function(userText) {
        return store.consume(true).then((data) => {
            // Send logs grouped by ID
        });
    }
};

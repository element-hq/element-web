/*
Copyright 2024 New Vector Ltd.
Copyright 2019 The Matrix.org Foundation C.I.C.
Copyright 2018 New Vector Ltd
Copyright 2017 OpenMarket Ltd

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// This module contains all the code needed to log the console, persist it to
// disk and submit bug reports. Rationale is as follows:
//  - Monkey-patching the console is preferable to having a log library because
//    we can catch logs by other libraries more easily, without having to all
//    depend on the same log framework / pass the logger around.
//  - We use IndexedDB to persists logs because it has generous disk space
//    limits compared to local storage. IndexedDB does not work in incognito
//    mode, in which case this module will not be able to write logs to disk.
//    However, the logs will still be stored in-memory, so can still be
//    submitted in a bug report should the user wish to: we can also store more
//    logs in-memory than in local storage, which does work in incognito mode.
//    We also need to handle the case where there are 2+ tabs. Each JS runtime
//    generates a random string which serves as the "ID" for that tab/session.
//    These IDs are stored along with the log lines.
//  - Bug reports are sent as a POST over HTTPS: it purposefully does not use
//    Matrix as bug reports may be made when Matrix is not responsive (which may
//    be the cause of the bug). We send the most recent N MB of UTF-8 log data,
//    starting with the most recent, which we know because the "ID"s are
//    actually timestamps. We then purge the remaining logs. We also do this
//    purge on startup to prevent logs from accumulating.

// the frequency with which we flush to indexeddb
import { logger } from "matrix-js-sdk/src/logger";
import { secureRandomString } from "matrix-js-sdk/src/randomstring";

import { getCircularReplacer } from "../utils/JSON";

const FLUSH_RATE_MS = 30 * 1000;

/** the length of log data we keep in indexeddb (and include in the reports), if there are more than 24 hours of logs */
const MAX_LOG_SIZE = 1024 * 1024 * 5; // 5 MB

/** the length of log data we keep in indexeddb (and include in the reports), if there are less than 24 hours of logs */
const MAX_LOG_SIZE_24H = 1024 * 1024 * 100; // 100 MB

type LogFunction = (...args: (Error | DOMException | object | string)[]) => void;
const consoleFunctionsToLevels = {
    log: "I",
    info: "I",
    warn: "W",
    error: "E",
    debug: "D",
} as const;
type LogFunctionName = keyof typeof consoleFunctionsToLevels;

// A class which monkey-patches the global console and stores log lines.
export class ConsoleLogger {
    private logs = "";
    private originalFunctions: { [key in LogFunctionName]?: LogFunction } = {};

    public monkeyPatch(consoleObj: Console): void {
        // Monkey-patch console logging
        (Object.keys(consoleFunctionsToLevels) as LogFunctionName[]).forEach((fnName: LogFunctionName) => {
            const level = consoleFunctionsToLevels[fnName];
            const originalFn = consoleObj[fnName].bind(consoleObj);
            this.originalFunctions[fnName] = originalFn;
            consoleObj[fnName] = (...args) => {
                this.log(level, ...args);
                originalFn(...args);
            };
        });
    }

    public bypassRageshake(fnName: LogFunctionName, ...args: (Error | DOMException | object | string)[]): void {
        this.originalFunctions[fnName]?.(...args);
    }

    public log(level: string, ...args: (Error | DOMException | object | string)[]): void {
        // We don't know what locale the user may be running so use ISO strings
        const ts = new Date().toISOString();

        // Convert objects and errors to helpful things
        args = args.map((arg) => {
            if (arg instanceof DOMException) {
                return arg.message + ` (${arg.name} | ${arg.code})`;
            } else if (arg instanceof Error) {
                return arg.message + (arg.stack ? `\n${arg.stack}` : "");
            } else if (typeof arg === "object") {
                return JSON.stringify(arg, getCircularReplacer());
            } else {
                return arg;
            }
        });

        // Some browsers support string formatting which we're not doing here
        // so the lines are a little more ugly but easy to implement / quick to
        // run.
        // Example line:
        // 2017-01-18T11:23:53.214Z W Failed to set badge count
        // eslint-disable-next-line @typescript-eslint/no-base-to-string
        let line = `${ts} ${level} ${args.join(" ")}\n`;
        // Do some cleanup
        line = line.replace(/token=[a-zA-Z0-9-]+/gm, "token=xxxxx");
        // Using + really is the quickest way in JS
        // http://jsperf.com/concat-vs-plus-vs-join
        this.logs += line;
    }

    /**
     * Retrieve log lines to flush to disk.
     * @param {boolean} keepLogs True to not delete logs after flushing.
     * @return {string} \n delimited log lines to flush.
     */
    public flush(keepLogs?: boolean): string {
        // The ConsoleLogger doesn't care how these end up on disk, it just
        // flushes them to the caller.
        if (keepLogs) {
            return this.logs;
        }
        const logsToFlush = this.logs;
        this.logs = "";
        return logsToFlush;
    }
}

// A class which stores log lines in an IndexedDB instance.
export class IndexedDBLogStore {
    private id: string;
    private index = 0;
    private db: IDBDatabase | null = null;
    private flushPromise: Promise<void> | null = null;
    private flushAgainPromise: Promise<void> | null = null;

    public constructor(
        private indexedDB: IDBFactory,
        private logger: ConsoleLogger,
    ) {
        this.id = "instance-" + secureRandomString(16);
    }

    /**
     * @return {Promise} Resolves when the store is ready.
     */
    public connect(): Promise<void> {
        const req = this.indexedDB.open("logs");
        return new Promise((resolve, reject) => {
            req.onsuccess = () => {
                this.db = req.result;
                // Periodically flush logs to local storage / indexeddb
                window.setInterval(this.flush.bind(this), FLUSH_RATE_MS);
                resolve();
            };

            req.onerror = () => {
                const err = "Failed to open log database: " + req.error?.name;
                logger.error(err);
                reject(new Error(err));
            };

            // First time: Setup the object store
            req.onupgradeneeded = () => {
                const db = req.result;
                const logObjStore = db.createObjectStore("logs", {
                    keyPath: ["id", "index"],
                });
                // Keys in the database look like: [ "instance-148938490", 0 ]
                // Later on we need to query everything based on an instance id.
                // In order to do this, we need to set up indexes "id".
                logObjStore.createIndex("id", "id", { unique: false });

                logObjStore.add(this.generateLogEntry(new Date() + " ::: Log database was created."));

                const lastModifiedStore = db.createObjectStore("logslastmod", {
                    keyPath: "id",
                });
                lastModifiedStore.add(this.generateLastModifiedTime());
            };
        });
    }

    /**
     * Flush logs to disk.
     *
     * There are guards to protect against race conditions in order to ensure
     * that all previous flushes have completed before the most recent flush.
     * Consider without guards:
     *  - A calls flush() periodically.
     *  - B calls flush() and wants to send logs immediately afterwards.
     *  - If B doesn't wait for A's flush to complete, B will be missing the
     *    contents of A's flush.
     * To protect against this, we set 'flushPromise' when a flush is ongoing.
     * Subsequent calls to flush() during this period will chain another flush,
     * then keep returning that same chained flush.
     *
     * This guarantees that we will always eventually do a flush when flush() is
     * called.
     *
     * @return {Promise} Resolved when the logs have been flushed.
     */
    public flush(): Promise<void> {
        // check if a flush() operation is ongoing
        if (this.flushPromise) {
            if (this.flushAgainPromise) {
                // this is the 3rd+ time we've called flush() : return the same promise.
                return this.flushAgainPromise;
            }
            // queue up a flush to occur immediately after the pending one completes.
            this.flushAgainPromise = this.flushPromise
                .then(() => {
                    return this.flush();
                })
                .then(() => {
                    this.flushAgainPromise = null;
                });
            return this.flushAgainPromise;
        }
        // there is no flush promise or there was but it has finished, so do
        // a brand new one, destroying the chain which may have been built up.
        this.flushPromise = new Promise<void>((resolve, reject) => {
            if (!this.db) {
                // not connected yet or user rejected access for us to r/w to the db.
                reject(new Error("No connected database"));
                return;
            }
            const lines = this.logger.flush();
            if (lines.length === 0) {
                resolve();
                return;
            }
            const txn = this.db.transaction(["logs", "logslastmod"], "readwrite");
            const objStore = txn.objectStore("logs");
            txn.oncomplete = (event) => {
                resolve();
            };
            txn.onerror = () => {
                logger.error("Failed to flush logs : ", txn.error);
                reject(new Error("Failed to write logs: " + txn.error?.message));
            };
            objStore.add(this.generateLogEntry(lines));
            const lastModStore = txn.objectStore("logslastmod");
            lastModStore.put(this.generateLastModifiedTime());
        }).then(() => {
            this.flushPromise = null;
        });
        return this.flushPromise;
    }

    /**
     * Consume the most recent logs and return them. Older logs which are not
     * returned are deleted at the same time, so this can be called at startup
     * to do house-keeping to keep the logs from growing too large.
     *
     * @return {Promise<Object[]>} Resolves to an array of objects. The array is
     * sorted in time (oldest first) based on when the log file was created (the
     * log ID). The objects have said log ID in an "id" field and "lines" which
     * is a big string with all the new-line delimited logs.
     */
    public async consume(): Promise<{ lines: string; id: string }[]> {
        const allLogIds = await this.fetchLogIds();
        let removeLogIds: string[] = [];
        const logs: { lines: string; id: string }[] = [];
        let size = 0;
        for (let i = 0; i < allLogIds.length; i++) {
            const instanceId = allLogIds[i];
            const { lines, truncated } = await this.fetchLogs(instanceId, size);

            // always add the returned logs: fetchLogs will truncate once it hits the size limit,
            // so we'll go over the max but only by one fragment's worth.
            logs.push({ lines, id: instanceId });
            size += lines.length;

            // If fetchLogs truncated we'll now be at or over the size limit,
            // in which case we should stop and remove the rest of the log files.
            if (truncated) {
                logger.log(
                    `rageshake: reached size limit while processing instance ${i + 1}/${
                        allLogIds.length
                    } (${instanceId}), with ${size} bytes of logs: will drop further instances`,
                );
                // the remaining log IDs should be removed. If we go out of
                // bounds this is just []
                removeLogIds = allLogIds.slice(i + 1);
                break;
            }
        }
        if (removeLogIds.length > 0) {
            logger.log(`rageshake: removing logs: ${removeLogIds}`);
            // Don't await this because it's non-fatal if we can't clean up
            // logs.
            Promise.all(removeLogIds.map((id) => this.deleteLogs(id))).then(
                () => {
                    logger.log(`Removed ${removeLogIds.length} old logs.`);
                },
                (err) => {
                    logger.error(err);
                },
            );
        }
        return logs;
    }

    /**
     * Fetch all the application instance names from the database.
     */
    private fetchLogIds(): Promise<string[]> {
        const db = this.db;
        if (!db) return Promise.reject("DB unavailable");

        // To gather all the log IDs, query for all records in logslastmod.
        const o = db.transaction("logslastmod", "readonly").objectStore("logslastmod");
        return selectQuery(o, undefined, (cursor) => {
            return {
                id: cursor.value.id,
                ts: cursor.value.ts,
            };
        }).then((res) => {
            // Sort IDs by timestamp (newest first)
            return res
                .sort((a, b) => {
                    return b.ts - a.ts;
                })
                .map((a) => a.id);
        });
    }

    /**
     * Fetch logs for a given application instance from the database, stopping once we hit the size limit.
     *
     * @param id - Application instance to fetch logs for.
     * @param sizeSoFar - Amount of logs we have already retrieved from other instances.
     *
     * @returns An object with the properties:
     *  * `lines`: the concatenated logs for this ID
     *  * `truncated`: whether the output was truncated due to hitting the size limit.
     */
    private fetchLogs(
        id: string,
        sizeSoFar: number,
    ): Promise<{
        lines: string;
        truncated: boolean;
    }> {
        const db = this.db;
        if (!db) return Promise.reject("DB unavailable");

        const objectStore = db.transaction("logs", "readonly").objectStore("logs");

        /** Determine whether we should stop collecting logs after this batch.
         *
         * @param sizeSoFar - The total amount of logs collected so far.
         * @param logBatchTimestamp - The timestamp of the most recent batch of logs collected.
         *
         * @returns `true` if we should stop after this batch.
         */
        function shouldTruncateAfterLogBatch(sizeSoFar: number, logBatchTimestamp: number): boolean {
            // First check if we have exceeded the absolute limit
            if (sizeSoFar >= MAX_LOG_SIZE_24H) {
                return true;
            }

            // Otherwise, check if the most recent batch is more than 24H old, and we have exceeded the limit for logs over 24H
            if (Date.now() - logBatchTimestamp >= 24 * 3600 * 1000 && sizeSoFar >= MAX_LOG_SIZE) {
                return true;
            }

            // Otherwise, we're good.
            return false;
        }

        return new Promise((resolve, reject) => {
            const query = objectStore.index("id").openCursor(IDBKeyRange.only(id), "prev");
            let lines = "";
            query.onerror = () => {
                reject(new Error("Query failed: " + query.error?.message));
            };
            query.onsuccess = () => {
                const cursor = query.result;
                if (!cursor) {
                    // end of results
                    resolve({ lines, truncated: false });
                    return;
                }
                const newLines = cursor.value.lines;
                // The query returns log chunks in reverse time order, so prepend this new chunk to the buffer.
                lines = newLines + lines;
                sizeSoFar += newLines.length;

                // If we have now exceeded the size limit, stop.
                if (shouldTruncateAfterLogBatch(sizeSoFar, cursor.value.ts ?? 0)) {
                    resolve({ lines, truncated: true });
                } else {
                    cursor.continue();
                }
            };
        });
    }

    /**
     * Delete logs for a given application instance.
     *
     * @param id - Application instance to delete logs for.
     */
    private deleteLogs(id: string): Promise<void> {
        const db = this.db;
        if (!db) return Promise.reject("DB unavailable");

        return new Promise<void>((resolve, reject) => {
            const txn = db.transaction(["logs", "logslastmod"], "readwrite");
            const o = txn.objectStore("logs");
            // only load the key path, not the data which may be huge
            const query = o.index("id").openKeyCursor(IDBKeyRange.only(id));
            query.onsuccess = () => {
                const cursor = query.result;
                if (!cursor) {
                    return;
                }
                o.delete(cursor.primaryKey);
                cursor.continue();
            };
            txn.oncomplete = () => {
                resolve();
            };
            txn.onerror = () => {
                reject(new Error("Failed to delete logs for " + `'${id}' : ${query.error?.message}`));
            };
            // delete last modified entries
            const lastModStore = txn.objectStore("logslastmod");
            lastModStore.delete(id);
        });
    }

    /** Generate the object to be stored in the `logs` store */
    private generateLogEntry(lines: string): { id: string; lines: string; index: number; ts: number } {
        return {
            id: this.id,
            lines: lines,
            index: this.index++,
            /** The timestamp at which the line was *flushed* (not necessarily when it was written). */
            ts: Date.now(),
        };
    }

    private generateLastModifiedTime(): { id: string; ts: number } {
        return {
            id: this.id,
            ts: Date.now(),
        };
    }
}

/**
 * Helper method to collect results from a Cursor and promiseify it.
 * @param {ObjectStore|Index} store The store to perform openCursor on.
 * @param {IDBKeyRange=} keyRange Optional key range to apply on the cursor.
 * @param {Function} resultMapper A function which is repeatedly called with a
 * Cursor.
 * Return the data you want to keep.
 * @return {Promise<T[]>} Resolves to an array of whatever you returned from
 * resultMapper.
 */
function selectQuery<T>(
    store: IDBIndex | IDBObjectStore,
    keyRange: IDBKeyRange | undefined,
    resultMapper: (cursor: IDBCursorWithValue) => T,
): Promise<T[]> {
    const query = store.openCursor(keyRange);
    return new Promise((resolve, reject) => {
        const results: T[] = [];
        query.onerror = () => {
            reject(new Error("Query failed: " + query.error?.message));
        };
        // collect results
        query.onsuccess = () => {
            const cursor = query.result;
            if (!cursor) {
                resolve(results);
                return; // end of results
            }
            results.push(resultMapper(cursor));
            cursor.continue();
        };
    });
}

/**
 * Configure rage shaking support for sending bug reports.
 * Modifies globals.
 * @param {boolean} setUpPersistence When true (default), the persistence will
 * be set up immediately for the logs.
 * @return {Promise} Resolves when set up.
 */
export function init(setUpPersistence = true): Promise<void> {
    if (global.mx_rage_initPromise) {
        return global.mx_rage_initPromise;
    }
    global.mx_rage_logger = new ConsoleLogger();
    global.mx_rage_logger.monkeyPatch(window.console);

    // log unhandled rejections in the rageshake
    window.addEventListener("unhandledrejection", (event) => {
        global.mx_rage_logger.log("error", `Unhandled promise rejection: ${event.reason}`);
    });

    if (setUpPersistence) {
        return tryInitStorage();
    }

    global.mx_rage_initPromise = Promise.resolve();
    return global.mx_rage_initPromise;
}

/**
 * Try to start up the rageshake storage for logs. If not possible (client unsupported)
 * then this no-ops.
 * @return {Promise} Resolves when complete.
 */
export function tryInitStorage(): Promise<void> {
    if (global.mx_rage_initStoragePromise) {
        return global.mx_rage_initStoragePromise;
    }

    logger.log("Configuring rageshake persistence...");

    // just *accessing* indexedDB throws an exception in firefox with
    // indexeddb disabled.
    let indexedDB;
    try {
        indexedDB = window.indexedDB;
    } catch {}

    if (indexedDB) {
        global.mx_rage_store = new IndexedDBLogStore(indexedDB, global.mx_rage_logger);
        global.mx_rage_initStoragePromise = global.mx_rage_store.connect();

        // Fire off a task in the background which will clean up old logs in the store
        global.mx_rage_initStoragePromise.then(() => {
            global.mx_rage_store.consume().catch((e) => {
                logger.error("Error cleaning up rageshake store", e);
            });
        });

        return global.mx_rage_initStoragePromise;
    }
    global.mx_rage_initStoragePromise = Promise.resolve();
    return global.mx_rage_initStoragePromise;
}

export function flush(): void {
    if (!global.mx_rage_store) {
        return;
    }
    global.mx_rage_store.flush();
}

/**
 * Clean up old logs.
 *
 * @deprecated There is no need to call this explicitly: it will be done as a side-effect of {@link tryInitStorage},
 * or {@link init} with `setUpPersistence: true`.
 *
 * @return {Promise} Resolves if cleaned logs.
 */
export async function cleanup(): Promise<void> {
    if (!global.mx_rage_store) {
        return;
    }
    await global.mx_rage_store.consume();
}

/**
 * Get a recent snapshot of the logs, ready for attaching to a bug report
 *
 * @return {Array<{lines: string, id, string}>}  list of log data
 */
export async function getLogsForReport(): Promise<{ lines: string; id: string }[]> {
    if (!global.mx_rage_logger) {
        throw new Error("No console logger, did you forget to call init()?");
    }
    // If in incognito mode, store is null, but we still want bug report
    // sending to work going off the in-memory console logs.
    if (global.mx_rage_store) {
        // flush most recent logs
        await global.mx_rage_store.flush();
        return global.mx_rage_store.consume();
    } else {
        return [
            {
                lines: global.mx_rage_logger.flush(true),
                id: "-",
            },
        ];
    }
}

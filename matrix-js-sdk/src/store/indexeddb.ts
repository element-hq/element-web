/*
Copyright 2017 - 2021 Vector Creations Ltd

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

/* eslint-disable @babel/no-invalid-this */

import { MemoryStore, IOpts as IBaseOpts } from "./memory";
import { LocalIndexedDBStoreBackend } from "./indexeddb-local-backend";
import { RemoteIndexedDBStoreBackend } from "./indexeddb-remote-backend";
import { User } from "../models/user";
import { IEvent, MatrixEvent } from "../models/event";
import { logger } from "../logger";
import { ISavedSync } from "./index";
import { IIndexedDBBackend } from "./indexeddb-backend";
import { ISyncResponse } from "../sync-accumulator";
import { TypedEventEmitter } from "../models/typed-event-emitter";
import { IStateEventWithRoomId } from "../@types/search";
import { IndexedToDeviceBatch, ToDeviceBatchWithTxnId } from "../models/ToDeviceMessage";
import { IStoredClientOpts } from "../client";

/**
 * This is an internal module. See {@link IndexedDBStore} for the public class.
 */

// If this value is too small we'll be writing very often which will cause
// noticeable stop-the-world pauses. If this value is too big we'll be writing
// so infrequently that the /sync size gets bigger on reload. Writing more
// often does not affect the length of the pause since the entire /sync
// response is persisted each time.
const WRITE_DELAY_MS = 1000 * 60 * 5; // once every 5 minutes

interface IOpts extends IBaseOpts {
    /** The Indexed DB interface e.g. `window.indexedDB` */
    indexedDB: IDBFactory;
    /** Optional database name. The same name must be used to open the same database. */
    dbName?: string;
    /** Optional factory to spin up a Worker to execute the IDB transactions within. */
    workerFactory?: () => Worker;
}

type EventHandlerMap = {
    // Fired when an IDB command fails on a degradable path, and the store falls back to MemoryStore
    // This signals the potential for data volatility.
    degraded: (e: Error) => void;
    // Fired when the IndexedDB gets closed unexpectedly, for example, if the underlying storage is removed or
    // if the user clears the database in the browser's history preferences.
    closed: () => void;
};

export class IndexedDBStore extends MemoryStore {
    public static exists(indexedDB: IDBFactory, dbName: string): Promise<boolean> {
        return LocalIndexedDBStoreBackend.exists(indexedDB, dbName);
    }

    /**
     * The backend instance.
     * Call through to this API if you need to perform specific indexeddb actions like deleting the database.
     */
    public readonly backend: IIndexedDBBackend;

    private startedUp = false;
    private syncTs = 0;
    // Records the last-modified-time of each user at the last point we saved
    // the database, such that we can derive the set if users that have been
    // modified since we last saved.
    private userModifiedMap: Record<string, number> = {}; // user_id : timestamp
    private emitter = new TypedEventEmitter<keyof EventHandlerMap, EventHandlerMap>();

    /**
     * Construct a new Indexed Database store, which extends MemoryStore.
     *
     * This store functions like a MemoryStore except it periodically persists
     * the contents of the store to an IndexedDB backend.
     *
     * All data is still kept in-memory but can be loaded from disk by calling
     * `startup()`. This can make startup times quicker as a complete
     * sync from the server is not required. This does not reduce memory usage as all
     * the data is eagerly fetched when `startup()` is called.
     * ```
     * let opts = { indexedDB: window.indexedDB, localStorage: window.localStorage };
     * let store = new IndexedDBStore(opts);
     * await store.startup(); // load from indexed db
     * let client = sdk.createClient({
     *     store: store,
     * });
     * client.startClient();
     * client.on("sync", function(state, prevState, data) {
     *     if (state === "PREPARED") {
     *         console.log("Started up, now with go faster stripes!");
     *     }
     * });
     * ```
     *
     * @param opts - Options object.
     */
    public constructor(opts: IOpts) {
        super(opts);

        if (!opts.indexedDB) {
            throw new Error("Missing required option: indexedDB");
        }

        if (opts.workerFactory) {
            this.backend = new RemoteIndexedDBStoreBackend(opts.workerFactory, opts.dbName);
        } else {
            this.backend = new LocalIndexedDBStoreBackend(opts.indexedDB, opts.dbName);
        }
    }

    public on = this.emitter.on.bind(this.emitter);

    /**
     * @returns Resolved when loaded from indexed db.
     */
    public startup(): Promise<void> {
        if (this.startedUp) {
            logger.log(`IndexedDBStore.startup: already started`);
            return Promise.resolve();
        }

        logger.log(`IndexedDBStore.startup: connecting to backend`);
        return this.backend
            .connect(this.onClose)
            .then(() => {
                logger.log(`IndexedDBStore.startup: loading presence events`);
                return this.backend.getUserPresenceEvents();
            })
            .then((userPresenceEvents) => {
                logger.log(`IndexedDBStore.startup: processing presence events`);
                userPresenceEvents.forEach(([userId, rawEvent]) => {
                    const u = new User(userId);
                    if (rawEvent) {
                        u.setPresenceEvent(new MatrixEvent(rawEvent));
                    }
                    this.userModifiedMap[u.userId] = u.getLastModifiedTime();
                    this.storeUser(u);
                });
                this.startedUp = true;
            });
    }

    /*
     * Close the database and destroy any associated workers
     */
    public destroy(): Promise<void> {
        return this.backend.destroy();
    }

    private onClose = (): void => {
        this.emitter.emit("closed");
    };

    /**
     * @returns Promise which resolves with a sync response to restore the
     * client state to where it was at the last save, or null if there
     * is no saved sync data.
     */
    public getSavedSync = this.degradable((): Promise<ISavedSync | null> => {
        return this.backend.getSavedSync();
    }, "getSavedSync");

    /** @returns whether or not the database was newly created in this session. */
    public isNewlyCreated = this.degradable((): Promise<boolean> => {
        return this.backend.isNewlyCreated();
    }, "isNewlyCreated");

    /**
     * @returns If there is a saved sync, the nextBatch token
     * for this sync, otherwise null.
     */
    public getSavedSyncToken = this.degradable((): Promise<string | null> => {
        return this.backend.getNextBatchToken();
    }, "getSavedSyncToken");

    /**
     * Delete all data from this store.
     * @returns Promise which resolves if the data was deleted from the database.
     */
    public deleteAllData = this.degradable((): Promise<void> => {
        super.deleteAllData();
        return this.backend.clearDatabase().then(
            () => {
                logger.log("Deleted indexeddb data.");
            },
            (err) => {
                logger.error(`Failed to delete indexeddb data: ${err}`);
                throw err;
            },
        );
    });

    /**
     * Whether this store would like to save its data
     * Note that obviously whether the store wants to save or
     * not could change between calling this function and calling
     * save().
     *
     * @returns True if calling save() will actually save
     *     (at the time this function is called).
     */
    public wantsSave(): boolean {
        const now = Date.now();
        return now - this.syncTs > WRITE_DELAY_MS;
    }

    /**
     * Possibly write data to the database.
     *
     * @param force - True to force a save to happen
     * @returns Promise resolves after the write completes
     *     (or immediately if no write is performed)
     */
    public save(force = false): Promise<void> {
        if (force || this.wantsSave()) {
            return this.reallySave();
        }
        return Promise.resolve();
    }

    private reallySave = this.degradable((): Promise<void> => {
        this.syncTs = Date.now(); // set now to guard against multi-writes

        // work out changed users (this doesn't handle deletions but you
        // can't 'delete' users as they are just presence events).
        const userTuples: [userId: string, presenceEvent: Partial<IEvent>][] = [];
        for (const u of this.getUsers()) {
            if (this.userModifiedMap[u.userId] === u.getLastModifiedTime()) continue;
            if (!u.events.presence) continue;

            userTuples.push([u.userId, u.events.presence.event]);

            // note that we've saved this version of the user
            this.userModifiedMap[u.userId] = u.getLastModifiedTime();
        }

        return this.backend.syncToDatabase(userTuples);
    });

    public setSyncData = this.degradable((syncData: ISyncResponse): Promise<void> => {
        return this.backend.setSyncData(syncData);
    }, "setSyncData");

    /**
     * Returns the out-of-band membership events for this room that
     * were previously loaded.
     * @returns the events, potentially an empty array if OOB loading didn't yield any new members
     * @returns in case the members for this room haven't been stored yet
     */
    public getOutOfBandMembers = this.degradable((roomId: string): Promise<IStateEventWithRoomId[] | null> => {
        return this.backend.getOutOfBandMembers(roomId);
    }, "getOutOfBandMembers");

    /**
     * Stores the out-of-band membership events for this room. Note that
     * it still makes sense to store an empty array as the OOB status for the room is
     * marked as fetched, and getOutOfBandMembers will return an empty array instead of null
     * @param membershipEvents - the membership events to store
     * @returns when all members have been stored
     */
    public setOutOfBandMembers = this.degradable(
        (roomId: string, membershipEvents: IStateEventWithRoomId[]): Promise<void> => {
            super.setOutOfBandMembers(roomId, membershipEvents);
            return this.backend.setOutOfBandMembers(roomId, membershipEvents);
        },
        "setOutOfBandMembers",
    );

    public clearOutOfBandMembers = this.degradable((roomId: string) => {
        super.clearOutOfBandMembers(roomId);
        return this.backend.clearOutOfBandMembers(roomId);
    }, "clearOutOfBandMembers");

    public getClientOptions = this.degradable((): Promise<IStoredClientOpts | undefined> => {
        return this.backend.getClientOptions();
    }, "getClientOptions");

    public storeClientOptions = this.degradable((options: IStoredClientOpts): Promise<void> => {
        super.storeClientOptions(options);
        return this.backend.storeClientOptions(options);
    }, "storeClientOptions");

    /**
     * All member functions of `IndexedDBStore` that access the backend use this wrapper to
     * watch for failures after initial store startup, including `QuotaExceededError` as
     * free disk space changes, etc.
     *
     * When IndexedDB fails via any of these paths, we degrade this back to a `MemoryStore`
     * in place so that the current operation and all future ones are in-memory only.
     *
     * @param func - The degradable work to do.
     * @param fallback - The method name for fallback.
     * @returns A wrapped member function.
     */
    private degradable<A extends Array<any>, R = void>(
        func: DegradableFn<A, R>,
        fallback?: keyof MemoryStore,
    ): DegradableFn<A, R> {
        const fallbackFn = fallback ? (super[fallback] as Function) : null;

        return async (...args) => {
            try {
                return await func.call(this, ...args);
            } catch (e) {
                logger.error("IndexedDBStore failure, degrading to MemoryStore", e);
                this.emitter.emit("degraded", e as Error);
                try {
                    // We try to delete IndexedDB after degrading since this store is only a
                    // cache (the app will still function correctly without the data).
                    // It's possible that deleting repair IndexedDB for the next app load,
                    // potentially by making a little more space available.
                    logger.log("IndexedDBStore trying to delete degraded data");
                    await this.backend.clearDatabase();
                    logger.log("IndexedDBStore delete after degrading succeeded");
                } catch (e) {
                    logger.warn("IndexedDBStore delete after degrading failed", e);
                }
                // Degrade the store from being an instance of `IndexedDBStore` to instead be
                // an instance of `MemoryStore` so that future API calls use the memory path
                // directly and skip IndexedDB entirely. This should be safe as
                // `IndexedDBStore` already extends from `MemoryStore`, so we are making the
                // store become its parent type in a way. The mutator methods of
                // `IndexedDBStore` also maintain the state that `MemoryStore` uses (many are
                // not overridden at all).
                if (fallbackFn) {
                    return fallbackFn.call(this, ...args);
                }
            }
        };
    }

    // XXX: ideally these would be stored in indexeddb as part of the room but,
    // we don't store rooms as such and instead accumulate entire sync responses atm.
    public async getPendingEvents(roomId: string): Promise<Partial<IEvent>[]> {
        if (!this.localStorage) return super.getPendingEvents(roomId);

        const serialized = this.localStorage.getItem(pendingEventsKey(roomId));
        if (serialized) {
            try {
                return JSON.parse(serialized);
            } catch (e) {
                logger.error("Could not parse persisted pending events", e);
            }
        }
        return [];
    }

    public async setPendingEvents(roomId: string, events: Partial<IEvent>[]): Promise<void> {
        if (!this.localStorage) return super.setPendingEvents(roomId, events);

        if (events.length > 0) {
            this.localStorage.setItem(pendingEventsKey(roomId), JSON.stringify(events));
        } else {
            this.localStorage.removeItem(pendingEventsKey(roomId));
        }
    }

    public saveToDeviceBatches(batches: ToDeviceBatchWithTxnId[]): Promise<void> {
        return this.backend.saveToDeviceBatches(batches);
    }

    public getOldestToDeviceBatch(): Promise<IndexedToDeviceBatch | null> {
        return this.backend.getOldestToDeviceBatch();
    }

    public removeToDeviceBatch(id: number): Promise<void> {
        return this.backend.removeToDeviceBatch(id);
    }
}

/**
 * @param roomId - ID of the current room
 * @returns Storage key to retrieve pending events
 */
function pendingEventsKey(roomId: string): string {
    return `mx_pending_events_${roomId}`;
}

type DegradableFn<A extends Array<any>, T> = (...args: A) => Promise<T>;

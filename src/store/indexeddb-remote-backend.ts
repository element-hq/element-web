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

import { logger } from "../logger";
import { defer, IDeferred } from "../utils";
import { ISavedSync } from "./index";
import { IStoredClientOpts } from "../client";
import { IStateEventWithRoomId, ISyncResponse } from "../matrix";
import { IIndexedDBBackend, UserTuple } from "./indexeddb-backend";
import { IndexedToDeviceBatch, ToDeviceBatchWithTxnId } from "../models/ToDeviceMessage";

export class RemoteIndexedDBStoreBackend implements IIndexedDBBackend {
    private worker?: Worker;
    private nextSeq = 0;
    // The currently in-flight requests to the actual backend
    private inFlight: Record<number, IDeferred<any>> = {}; // seq: promise
    // Once we start connecting, we keep the promise and re-use it
    // if we try to connect again
    private startPromise?: Promise<void>;
    // Callback for when the IndexedDB gets closed unexpectedly
    private onClose?(): void;

    /**
     * An IndexedDB store backend where the actual backend sits in a web
     * worker.
     *
     * Construct a new Indexed Database store backend. This requires a call to
     * `connect()` before this store can be used.
     * @param workerFactory - Factory which produces a Worker
     * @param dbName - Optional database name. The same name must be used
     * to open the same database.
     */
    public constructor(private readonly workerFactory: () => Worker, private readonly dbName?: string) {}

    /**
     * Attempt to connect to the database. This can fail if the user does not
     * grant permission.
     * @returns Promise which resolves if successfully connected.
     */
    public connect(onClose?: () => void): Promise<void> {
        this.onClose = onClose;
        return this.ensureStarted().then(() => this.doCmd("connect"));
    }

    /**
     * Clear the entire database. This should be used when logging out of a client
     * to prevent mixing data between accounts.
     * @returns Resolved when the database is cleared.
     */
    public clearDatabase(): Promise<void> {
        return this.ensureStarted().then(() => this.doCmd("clearDatabase"));
    }

    /** @returns whether or not the database was newly created in this session. */
    public isNewlyCreated(): Promise<boolean> {
        return this.doCmd("isNewlyCreated");
    }

    /**
     * @returns Promise which resolves with a sync response to restore the
     * client state to where it was at the last save, or null if there
     * is no saved sync data.
     */
    public getSavedSync(): Promise<ISavedSync> {
        return this.doCmd("getSavedSync");
    }

    public getNextBatchToken(): Promise<string> {
        return this.doCmd("getNextBatchToken");
    }

    public setSyncData(syncData: ISyncResponse): Promise<void> {
        return this.doCmd("setSyncData", [syncData]);
    }

    public syncToDatabase(userTuples: UserTuple[]): Promise<void> {
        return this.doCmd("syncToDatabase", [userTuples]);
    }

    /**
     * Returns the out-of-band membership events for this room that
     * were previously loaded.
     * @returns the events, potentially an empty array if OOB loading didn't yield any new members
     * @returns in case the members for this room haven't been stored yet
     */
    public getOutOfBandMembers(roomId: string): Promise<IStateEventWithRoomId[] | null> {
        return this.doCmd("getOutOfBandMembers", [roomId]);
    }

    /**
     * Stores the out-of-band membership events for this room. Note that
     * it still makes sense to store an empty array as the OOB status for the room is
     * marked as fetched, and getOutOfBandMembers will return an empty array instead of null
     * @param membershipEvents - the membership events to store
     * @returns when all members have been stored
     */
    public setOutOfBandMembers(roomId: string, membershipEvents: IStateEventWithRoomId[]): Promise<void> {
        return this.doCmd("setOutOfBandMembers", [roomId, membershipEvents]);
    }

    public clearOutOfBandMembers(roomId: string): Promise<void> {
        return this.doCmd("clearOutOfBandMembers", [roomId]);
    }

    public getClientOptions(): Promise<IStoredClientOpts | undefined> {
        return this.doCmd("getClientOptions");
    }

    public storeClientOptions(options: IStoredClientOpts): Promise<void> {
        return this.doCmd("storeClientOptions", [options]);
    }

    /**
     * Load all user presence events from the database. This is not cached.
     * @returns A list of presence events in their raw form.
     */
    public getUserPresenceEvents(): Promise<UserTuple[]> {
        return this.doCmd("getUserPresenceEvents");
    }

    public async saveToDeviceBatches(batches: ToDeviceBatchWithTxnId[]): Promise<void> {
        return this.doCmd("saveToDeviceBatches", [batches]);
    }

    public async getOldestToDeviceBatch(): Promise<IndexedToDeviceBatch | null> {
        return this.doCmd("getOldestToDeviceBatch");
    }

    public async removeToDeviceBatch(id: number): Promise<void> {
        return this.doCmd("removeToDeviceBatch", [id]);
    }

    private ensureStarted(): Promise<void> {
        if (!this.startPromise) {
            this.worker = this.workerFactory();
            this.worker.onmessage = this.onWorkerMessage;

            // tell the worker the db name.
            this.startPromise = this.doCmd("setupWorker", [this.dbName]).then(() => {
                logger.log("IndexedDB worker is ready");
            });
        }
        return this.startPromise;
    }

    private doCmd<T>(command: string, args?: any): Promise<T> {
        // wrap in a q so if the postMessage throws,
        // the promise automatically gets rejected
        return Promise.resolve().then(() => {
            const seq = this.nextSeq++;
            const def = defer<T>();

            this.inFlight[seq] = def;

            this.worker?.postMessage({ command, seq, args });

            return def.promise;
        });
    }

    private onWorkerMessage = (ev: MessageEvent): void => {
        const msg = ev.data;

        if (msg.command == "closed") {
            this.onClose?.();
        } else if (msg.command == "cmd_success" || msg.command == "cmd_fail") {
            if (msg.seq === undefined) {
                logger.error("Got reply from worker with no seq");
                return;
            }

            const def = this.inFlight[msg.seq];
            if (def === undefined) {
                logger.error("Got reply for unknown seq " + msg.seq);
                return;
            }
            delete this.inFlight[msg.seq];

            if (msg.command == "cmd_success") {
                def.resolve(msg.result);
            } else {
                const error = new Error(msg.error.message);
                error.name = msg.error.name;
                def.reject(error);
            }
        } else {
            logger.warn("Unrecognised message from worker: ", msg);
        }
    };

    /*
     * Destroy the web worker
     */
    public async destroy(): Promise<void> {
        this.worker?.terminate();
    }
}

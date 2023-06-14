/*
Copyright 2022 The Matrix.org Foundation C.I.C.

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

import "fake-indexeddb/auto";
import "jest-localstorage-mock";

import { IndexedDBStore, IStateEventWithRoomId, MemoryStore } from "../../../src";
import { emitPromise } from "../../test-utils/test-utils";
import { LocalIndexedDBStoreBackend } from "../../../src/store/indexeddb-local-backend";
import { defer } from "../../../src/utils";

describe("IndexedDBStore", () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    const roomId = "!room:id";
    it("should degrade to MemoryStore on IDB errors", async () => {
        const store = new IndexedDBStore({
            indexedDB: indexedDB,
            dbName: "database",
            localStorage,
        });
        await store.startup();

        const member1: IStateEventWithRoomId = {
            room_id: roomId,
            event_id: "!ev1:id",
            sender: "@user1:id",
            state_key: "@user1:id",
            type: "m.room.member",
            origin_server_ts: 123,
            content: {},
        };
        const member2: IStateEventWithRoomId = {
            room_id: roomId,
            event_id: "!ev2:id",
            sender: "@user2:id",
            state_key: "@user2:id",
            type: "m.room.member",
            origin_server_ts: 123,
            content: {},
        };

        expect(await store.getOutOfBandMembers(roomId)).toBe(null);
        await store.setOutOfBandMembers(roomId, [member1]);
        expect(await store.getOutOfBandMembers(roomId)).toHaveLength(1);

        // Simulate a broken IDB
        (store.backend as LocalIndexedDBStoreBackend)["db"]!.transaction = (): IDBTransaction => {
            const err = new Error(
                "Failed to execute 'transaction' on 'IDBDatabase': " + "The database connection is closing.",
            );
            err.name = "InvalidStateError";
            throw err;
        };

        expect(await store.getOutOfBandMembers(roomId)).toHaveLength(1);
        await Promise.all([
            emitPromise(store["emitter"], "degraded"),
            store.setOutOfBandMembers(roomId, [member1, member2]),
        ]);
        expect(await store.getOutOfBandMembers(roomId)).toHaveLength(2);
    });

    it("should use MemoryStore methods for pending events if no localStorage", async () => {
        jest.spyOn(MemoryStore.prototype, "setPendingEvents");
        jest.spyOn(MemoryStore.prototype, "getPendingEvents");

        const store = new IndexedDBStore({
            indexedDB: indexedDB,
            dbName: "database",
            localStorage: undefined,
        });

        const events = [{ type: "test" }];
        await store.setPendingEvents(roomId, events);
        expect(MemoryStore.prototype.setPendingEvents).toHaveBeenCalledWith(roomId, events);
        await expect(store.getPendingEvents(roomId)).resolves.toEqual(events);
        expect(MemoryStore.prototype.getPendingEvents).toHaveBeenCalledWith(roomId);
    });

    it("should persist pending events to localStorage if available", async () => {
        jest.spyOn(MemoryStore.prototype, "setPendingEvents");
        jest.spyOn(MemoryStore.prototype, "getPendingEvents");

        const store = new IndexedDBStore({
            indexedDB: indexedDB,
            dbName: "database",
            localStorage,
        });

        await expect(store.getPendingEvents(roomId)).resolves.toEqual([]);
        const events = [{ type: "test" }];
        await store.setPendingEvents(roomId, events);
        expect(MemoryStore.prototype.setPendingEvents).not.toHaveBeenCalled();
        await expect(store.getPendingEvents(roomId)).resolves.toEqual(events);
        expect(MemoryStore.prototype.getPendingEvents).not.toHaveBeenCalled();
        expect(localStorage.getItem("mx_pending_events_" + roomId)).toBe(JSON.stringify(events));
        await store.setPendingEvents(roomId, []);
        expect(localStorage.getItem("mx_pending_events_" + roomId)).toBeNull();
    });

    it("should resolve isNewlyCreated to true if no database existed initially", async () => {
        const store = new IndexedDBStore({
            indexedDB,
            dbName: "db1",
            localStorage,
        });
        await store.startup();

        await expect(store.isNewlyCreated()).resolves.toBeTruthy();
    });

    it("should resolve isNewlyCreated to false if database existed already", async () => {
        let store = new IndexedDBStore({
            indexedDB,
            dbName: "db2",
            localStorage,
        });
        await store.startup();

        store = new IndexedDBStore({
            indexedDB,
            dbName: "db2",
            localStorage,
        });
        await store.startup();

        await expect(store.isNewlyCreated()).resolves.toBeFalsy();
    });

    it("should resolve isNewlyCreated to false if database existed already but needs upgrade", async () => {
        const deferred = defer<Event>();
        // seed db3 to Version 1 so it forces a migration
        const req = indexedDB.open("matrix-js-sdk:db3", 1);
        req.onupgradeneeded = () => {
            const db = req.result;
            db.createObjectStore("users", { keyPath: ["userId"] });
            db.createObjectStore("accountData", { keyPath: ["type"] });
            db.createObjectStore("sync", { keyPath: ["clobber"] });
        };
        req.onsuccess = deferred.resolve;
        await deferred.promise;
        req.result.close();

        const store = new IndexedDBStore({
            indexedDB,
            dbName: "db3",
            localStorage,
        });
        await store.startup();

        await expect(store.isNewlyCreated()).resolves.toBeFalsy();
    });

    it("should emit 'closed' if database is unexpectedly closed", async () => {
        const store = new IndexedDBStore({
            indexedDB: indexedDB,
            dbName: "database",
            localStorage,
        });
        await store.startup();

        const deferred = defer<void>();
        store.on("closed", deferred.resolve);

        // @ts-ignore - private field access
        (store.backend as LocalIndexedDBStoreBackend).db!.onclose!({} as Event);
        await deferred.promise;
    });

    it("should use remote backend if workerFactory passed", async () => {
        const deferred = defer<void>();
        class MockWorker {
            postMessage(data: any) {
                if (data.command === "setupWorker") {
                    deferred.resolve();
                }
            }
        }

        const store = new IndexedDBStore({
            indexedDB: indexedDB,
            dbName: "database",
            localStorage,
            workerFactory: () => new MockWorker() as Worker,
        });
        store.startup();
        await deferred.promise;
    });

    it("remote worker should pass closed event", async () => {
        const worker = new (class MockWorker {
            postMessage(data: any) {}
        })() as Worker;

        const store = new IndexedDBStore({
            indexedDB: indexedDB,
            dbName: "database",
            localStorage,
            workerFactory: () => worker,
        });
        store.startup();

        const deferred = defer<void>();
        store.on("closed", deferred.resolve);
        (worker as any).onmessage({ data: { command: "closed" } });
        await deferred.promise;
    });

    it("remote worker should pass command failures", async () => {
        const worker = new (class MockWorker {
            private onmessage!: (data: any) => void;
            postMessage(data: any) {
                if (data.command === "setupWorker" || data.command === "connect") {
                    this.onmessage({
                        data: {
                            command: "cmd_success",
                            seq: data.seq,
                        },
                    });
                    return;
                }

                this.onmessage({
                    data: {
                        command: "cmd_fail",
                        seq: data.seq,
                        error: new Error("Test"),
                    },
                });
            }
        })() as unknown as Worker;

        const store = new IndexedDBStore({
            indexedDB: indexedDB,
            dbName: "database",
            localStorage,
            workerFactory: () => worker,
        });
        await expect(store.startup()).rejects.toThrow("Test");
    });

    it("remote worker should terminate upon destroy call", async () => {
        const terminate = jest.fn();
        const worker = new (class MockWorker {
            private onmessage!: (data: any) => void;
            postMessage(data: any) {
                this.onmessage({
                    data: {
                        command: "cmd_success",
                        seq: data.seq,
                        result: [],
                    },
                });
            }
            public terminate = terminate;
        })() as unknown as Worker;

        const store = new IndexedDBStore({
            indexedDB: indexedDB,
            dbName: "database",
            localStorage,
            workerFactory: () => worker,
        });
        await store.startup();
        await expect(store.destroy()).resolves;
        expect(terminate).toHaveBeenCalled();
    });
});

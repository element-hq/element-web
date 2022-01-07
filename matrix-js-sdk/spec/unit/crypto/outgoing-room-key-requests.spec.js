/*
Copyright 2020 The Matrix.org Foundation C.I.C.

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
    IndexedDBCryptoStore,
} from '../../../src/crypto/store/indexeddb-crypto-store';
import { MemoryCryptoStore } from '../../../src/crypto/store/memory-crypto-store';
import { RoomKeyRequestState } from '../../../src/crypto/OutgoingRoomKeyRequestManager';

import 'fake-indexeddb/auto';
import 'jest-localstorage-mock';

const requests = [
    {
        requestId: "A",
        requestBody: { session_id: "A", room_id: "A" },
        state: RoomKeyRequestState.Sent,
    },
    {
        requestId: "B",
        requestBody: { session_id: "B", room_id: "B" },
        state: RoomKeyRequestState.Sent,
    },
    {
        requestId: "C",
        requestBody: { session_id: "C", room_id: "C" },
        state: RoomKeyRequestState.Unsent,
    },
];

describe.each([
    ["IndexedDBCryptoStore",
     () => new IndexedDBCryptoStore(global.indexedDB, "tests")],
    ["LocalStorageCryptoStore",
     () => new IndexedDBCryptoStore(undefined, "tests")],
    ["MemoryCryptoStore", () => {
        const store = new IndexedDBCryptoStore(undefined, "tests");
        store._backend = new MemoryCryptoStore();
        store._backendPromise = Promise.resolve(store._backend);
        return store;
    }],
])("Outgoing room key requests [%s]", function(name, dbFactory) {
    let store;

    beforeAll(async () => {
        store = dbFactory();
        await store.startup();
        await Promise.all(requests.map((request) =>
            store.getOrAddOutgoingRoomKeyRequest(request),
        ));
    });

    it("getAllOutgoingRoomKeyRequestsByState retrieves all entries in a given state",
    async () => {
        const r = await
            store.getAllOutgoingRoomKeyRequestsByState(RoomKeyRequestState.Sent);
        expect(r).toHaveLength(2);
        requests.filter((e) => e.state === RoomKeyRequestState.Sent).forEach((e) => {
            expect(r).toContainEqual(e);
        });
    });

    test("getOutgoingRoomKeyRequestByState retrieves any entry in a given state",
    async () => {
        const r =
            await store.getOutgoingRoomKeyRequestByState([RoomKeyRequestState.Sent]);
        expect(r).not.toBeNull();
        expect(r).not.toBeUndefined();
        expect(r.state).toEqual(RoomKeyRequestState.Sent);
        expect(requests).toContainEqual(r);
    });
});

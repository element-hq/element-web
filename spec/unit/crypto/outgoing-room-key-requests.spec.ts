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

import { CryptoStore } from "../../../src/crypto/store/base";
import { IndexedDBCryptoStore } from "../../../src/crypto/store/indexeddb-crypto-store";
import { LocalStorageCryptoStore } from "../../../src/crypto/store/localStorage-crypto-store";
import { MemoryCryptoStore } from "../../../src/crypto/store/memory-crypto-store";
import { RoomKeyRequestState } from "../../../src/crypto/OutgoingRoomKeyRequestManager";

import "fake-indexeddb/auto";
import "jest-localstorage-mock";

const requests = [
    {
        requestId: "A",
        requestBody: { session_id: "A", room_id: "A", sender_key: "A", algorithm: "m.megolm.v1.aes-sha2" },
        state: RoomKeyRequestState.Sent,
        recipients: [
            { userId: "@alice:example.com", deviceId: "*" },
            { userId: "@becca:example.com", deviceId: "foobarbaz" },
        ],
    },
    {
        requestId: "B",
        requestBody: { session_id: "B", room_id: "B", sender_key: "B", algorithm: "m.megolm.v1.aes-sha2" },
        state: RoomKeyRequestState.Sent,
        recipients: [
            { userId: "@alice:example.com", deviceId: "*" },
            { userId: "@carrie:example.com", deviceId: "barbazquux" },
        ],
    },
    {
        requestId: "C",
        requestBody: { session_id: "C", room_id: "C", sender_key: "B", algorithm: "m.megolm.v1.aes-sha2" },
        state: RoomKeyRequestState.Unsent,
        recipients: [{ userId: "@becca:example.com", deviceId: "foobarbaz" }],
    },
];

describe.each([
    ["IndexedDBCryptoStore", () => new IndexedDBCryptoStore(global.indexedDB, "tests")],
    ["LocalStorageCryptoStore", () => new LocalStorageCryptoStore(localStorage)],
    ["MemoryCryptoStore", () => new MemoryCryptoStore()],
])("Outgoing room key requests [%s]", function (name, dbFactory) {
    let store: CryptoStore;

    beforeAll(async () => {
        store = dbFactory();
        await store.startup();
        await Promise.all(requests.map((request) => store.getOrAddOutgoingRoomKeyRequest(request)));
    });

    it("getAllOutgoingRoomKeyRequestsByState retrieves all entries in a given state", async () => {
        const r = await store.getAllOutgoingRoomKeyRequestsByState(RoomKeyRequestState.Sent);
        expect(r).toHaveLength(2);
        requests
            .filter((e) => e.state === RoomKeyRequestState.Sent)
            .forEach((e) => {
                expect(r).toContainEqual(e);
            });
    });

    it("getOutgoingRoomKeyRequestsByTarget retrieves all entries with a given target", async () => {
        const r = await store.getOutgoingRoomKeyRequestsByTarget("@becca:example.com", "foobarbaz", [
            RoomKeyRequestState.Sent,
        ]);
        expect(r).toHaveLength(1);
        expect(r[0]).toEqual(requests[0]);
    });

    test("getOutgoingRoomKeyRequestByState retrieves any entry in a given state", async () => {
        const r = await store.getOutgoingRoomKeyRequestByState([RoomKeyRequestState.Sent]);
        expect(r).not.toBeNull();
        expect(r).not.toBeUndefined();
        expect(r!.state).toEqual(RoomKeyRequestState.Sent);
        expect(requests).toContainEqual(r);
    });
});

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

import { MatrixEvent, MemoryStore } from "../../../src";

describe("MemoryStore", () => {
    const event1 = new MatrixEvent({ type: "event1-type", content: { test: 1 } });
    const event2 = new MatrixEvent({ type: "event2-type", content: { test: 1 } });
    const event3 = new MatrixEvent({ type: "event3-type", content: { test: 1 } });
    const event4 = new MatrixEvent({ type: "event4-type", content: { test: 1 } });
    const event4Updated = new MatrixEvent({ type: "event4-type", content: { test: 2 } });
    const event1Empty = new MatrixEvent({ type: "event1-type", content: {} });

    describe("account data", () => {
        it("sets account data events correctly", () => {
            const store = new MemoryStore();
            store.storeAccountDataEvents([event1, event2]);
            expect(store.getAccountData(event1.getType())).toEqual(event1);
            expect(store.getAccountData(event2.getType())).toEqual(event2);
        });

        it("returns undefined when no account data event exists for type", () => {
            const store = new MemoryStore();
            expect(store.getAccountData("my-event-type")).toEqual(undefined);
        });

        it("updates account data events correctly", () => {
            const store = new MemoryStore();
            // init store with event1, event2
            store.storeAccountDataEvents([event1, event2, event4]);
            // remove event1, add event3
            store.storeAccountDataEvents([event1Empty, event3, event4Updated]);
            // removed
            expect(store.getAccountData(event1.getType())).toEqual(undefined);
            // not removed
            expect(store.getAccountData(event2.getType())).toEqual(event2);
            // added
            expect(store.getAccountData(event3.getType())).toEqual(event3);
            // updated
            expect(store.getAccountData(event4.getType())).toEqual(event4Updated);
        });

        it("removes all account data from state on deleteAllData", async () => {
            const store = new MemoryStore();
            store.storeAccountDataEvents([event1, event2]);
            await store.deleteAllData();

            // empty object
            expect(store.accountData).toEqual(new Map());
        });
    });
});

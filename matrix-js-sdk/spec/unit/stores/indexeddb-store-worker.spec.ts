/*
Copyright 2023 The Matrix.org Foundation C.I.C.

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

import { LocalIndexedDBStoreBackend } from "../../../src/store/indexeddb-local-backend";
import { IndexedDBStoreWorker } from "../../../src/store/indexeddb-store-worker";
import { defer } from "../../../src/utils";

function setupWorker(worker: IndexedDBStoreWorker): void {
    worker.onMessage({ data: { command: "setupWorker", args: [] } } as any);
    worker.onMessage({ data: { command: "connect", seq: 1 } } as any);
}

describe("IndexedDBStore Worker", () => {
    it("should pass 'closed' event via postMessage", async () => {
        const deferred = defer<void>();
        const postMessage = jest.fn().mockImplementation(({ seq, command }) => {
            if (seq === 1 && command === "cmd_success") {
                deferred.resolve();
            }
        });
        const worker = new IndexedDBStoreWorker(postMessage);
        setupWorker(worker);

        await deferred.promise;

        // @ts-ignore - private field access
        (worker.backend as LocalIndexedDBStoreBackend).db!.onclose!({} as Event);
        expect(postMessage).toHaveBeenCalledWith({
            command: "closed",
        });
    });
});

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

import { WorkerManager } from "../src/WorkerManager";

describe("WorkerManager", () => {
    it("should generate consecutive sequence numbers for each call", () => {
        const postMessage = jest.fn();
        const manager = new WorkerManager(jest.fn(() => ({ postMessage } as unknown as Worker)));

        manager.call({ data: "One" });
        manager.call({ data: "Two" });
        manager.call({ data: "Three" });

        const one = postMessage.mock.calls.find((c) => c[0].data === "One")!;
        const two = postMessage.mock.calls.find((c) => c[0].data === "Two")!;
        const three = postMessage.mock.calls.find((c) => c[0].data === "Three")!;

        expect(one[0].seq).toBe(0);
        expect(two[0].seq).toBe(1);
        expect(three[0].seq).toBe(2);
    });

    it("should support resolving out of order", async () => {
        const postMessage = jest.fn();
        const worker = { postMessage } as unknown as Worker;
        const manager = new WorkerManager(jest.fn(() => worker));

        const oneProm = manager.call({ data: "One" });
        const twoProm = manager.call({ data: "Two" });
        const threeProm = manager.call({ data: "Three" });

        const one = postMessage.mock.calls.find((c) => c[0].data === "One")![0].seq;
        const two = postMessage.mock.calls.find((c) => c[0].data === "Two")![0].seq;
        const three = postMessage.mock.calls.find((c) => c[0].data === "Three")![0].seq;

        worker.onmessage!({ data: { seq: one, data: 1 } } as MessageEvent);
        await expect(oneProm).resolves.toEqual(expect.objectContaining({ data: 1 }));

        worker.onmessage!({ data: { seq: three, data: 3 } } as MessageEvent);
        await expect(threeProm).resolves.toEqual(expect.objectContaining({ data: 3 }));

        worker.onmessage!({ data: { seq: two, data: 2 } } as MessageEvent);
        await expect(twoProm).resolves.toEqual(expect.objectContaining({ data: 2 }));
    });
});

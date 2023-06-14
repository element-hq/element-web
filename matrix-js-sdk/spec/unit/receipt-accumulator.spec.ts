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

import { ReceiptType } from "../../src/@types/read_receipts";
import { ReceiptAccumulator } from "../../src/receipt-accumulator";

const roomId = "!foo:bar";

describe("ReceiptAccumulator", function () {
    /*
     * Note: at the time of writing, the ReceiptAccumulator uses the order of
     * events from sync as the determinant of which one is most recent. This
     * is correct, but inconsistent with other areas of the code, since we
     * don't persist this order, so in other places we are forced to use the
     * timestamp of events and hope that this matches up.
     *
     * The tests in this file provide ts values that are consistent with the
     * sync order, so they should still pass if we change to using ts to
     * determine order.
     *
     * Ideally, we would keep track of sync order so we can use it everywhere.
     * This would mean we are consistent with how the homeserver sees receipts
     * and notifications.
     */

    it("Discards previous unthreaded receipts for the same user", () => {
        const acc = new ReceiptAccumulator();

        const receipt1 = newReceipt("$event1", ReceiptType.Read, "@alice:localhost", 1);
        const receipt2 = newReceipt("$event2", ReceiptType.Read, "@alice:localhost", 2);

        acc.consumeEphemeralEvents([receipt1, receipt2]);

        const newEvent = acc.buildAccumulatedReceiptEvent(roomId);
        expect(newEvent).toEqual(newReceipt("$event2", ReceiptType.Read, "@alice:localhost", 2));
    });

    it("Discards previous threaded receipts for the same user in the same thread", () => {
        const acc = new ReceiptAccumulator();

        const receipt1 = newReceipt("$event1", ReceiptType.Read, "@alice:localhost", 1, "thread1");
        const receipt2 = newReceipt("$event2", ReceiptType.Read, "@alice:localhost", 2, "thread1");

        acc.consumeEphemeralEvents([receipt1, receipt2]);

        const newEvent = acc.buildAccumulatedReceiptEvent(roomId);
        expect(newEvent).toEqual(newReceipt("$event2", ReceiptType.Read, "@alice:localhost", 2, "thread1"));
    });

    it("Collects multiple receipts for the same user if they are in different threads", () => {
        const acc = new ReceiptAccumulator();

        const receipt1 = newReceipt("$event1", ReceiptType.Read, "@alice:localhost", 1, "thread1");
        const receipt2 = newReceipt("$event2", ReceiptType.Read, "@alice:localhost", 2, "thread2");

        acc.consumeEphemeralEvents([receipt1, receipt2]);

        const newEvent = acc.buildAccumulatedReceiptEvent(roomId);
        expect(newEvent).toEqual(
            newMultiReceipt([
                ["$event1", ReceiptType.Read, "@alice:localhost", 1, "thread1"],
                ["$event2", ReceiptType.Read, "@alice:localhost", 2, "thread2"],
            ]),
        );
    });

    it("Collects multiple receipts for different users", () => {
        const acc = new ReceiptAccumulator();

        const receipt1 = newReceipt("$event1", ReceiptType.Read, "@alice:localhost", 1, "thread1");
        const receipt2 = newReceipt("$event2", ReceiptType.Read, "@bobby:localhost", 2, "thread1");

        acc.consumeEphemeralEvents([receipt1, receipt2]);

        const newEvent = acc.buildAccumulatedReceiptEvent(roomId);
        expect(newEvent).toEqual(
            newMultiReceipt([
                ["$event1", ReceiptType.Read, "@alice:localhost", 1, "thread1"],
                ["$event2", ReceiptType.Read, "@bobby:localhost", 2, "thread1"],
            ]),
        );
    });

    it("Collects last receipt for various users and threads", () => {
        const acc = new ReceiptAccumulator();

        // Below, if ts=1, this receipt is going to be superceded by another
        // with ts=2
        const receipts = [
            newReceipt("$event1", ReceiptType.Read, "@alice:localhost", 1),
            newReceipt("$event2", ReceiptType.Read, "@bobby:localhost", 1, "thread1"),
            newReceipt("$event3", ReceiptType.Read, "@alice:localhost", 1, "thread1"),
            newReceipt("$event4", ReceiptType.Read, "@bobby:localhost", 1),
            newReceipt("$event5", ReceiptType.Read, "@bobby:localhost", 2),
            newReceipt("$event6", ReceiptType.Read, "@alice:localhost", 2),
            newReceipt("$event7", ReceiptType.Read, "@bobby:localhost", 2, "thread1"),
            newReceipt("$event8", ReceiptType.Read, "@bobby:localhost", 1, "thread2"),
            newReceipt("$event9", ReceiptType.Read, "@bobby:localhost", 2, "thread2"),
            newReceipt("$eventA", ReceiptType.Read, "@alice:localhost", 2, "thread1"),
            newReceipt("$eventB", ReceiptType.Read, "@alice:localhost", 1, "thread2"),
            newReceipt("$eventC", ReceiptType.Read, "@alice:localhost", 2, "thread2"),
        ];

        acc.consumeEphemeralEvents(receipts);
        const newEvent = acc.buildAccumulatedReceiptEvent(roomId);

        // Only the ts=2 receipts make it through
        expect(newEvent).toEqual(
            newMultiReceipt([
                ["$event5", ReceiptType.Read, "@bobby:localhost", 2, undefined],
                ["$event6", ReceiptType.Read, "@alice:localhost", 2, undefined],
                ["$event7", ReceiptType.Read, "@bobby:localhost", 2, "thread1"],
                ["$event9", ReceiptType.Read, "@bobby:localhost", 2, "thread2"],
                ["$eventA", ReceiptType.Read, "@alice:localhost", 2, "thread1"],
                ["$eventC", ReceiptType.Read, "@alice:localhost", 2, "thread2"],
            ]),
        );
    });

    it("Keeps main thread receipts even when an unthreaded receipt came later", () => {
        const acc = new ReceiptAccumulator();

        // Given receipts for the special thread "main" and also unthreaded
        // receipts (which have no thread id).
        const receipt1 = newReceipt("$event1", ReceiptType.Read, "@alice:localhost", 1, "main");
        const receipt2 = newReceipt("$event2", ReceiptType.Read, "@alice:localhost", 2);

        // When we collect them
        acc.consumeEphemeralEvents([receipt1, receipt2]);
        const newEvent = acc.buildAccumulatedReceiptEvent(roomId);

        // We preserve both: thread:main and unthreaded receipts are different
        // things, with different meanings.
        expect(newEvent).toEqual(
            newMultiReceipt([
                ["$event1", ReceiptType.Read, "@alice:localhost", 1, "main"],
                ["$event2", ReceiptType.Read, "@alice:localhost", 2, undefined],
            ]),
        );
    });

    it("Keeps unthreaded receipts even when a main thread receipt came later", () => {
        const acc = new ReceiptAccumulator();

        // Given receipts for the special thread "main" and also unthreaded
        // receipts (which have no thread id).
        const receipt1 = newReceipt("$event1", ReceiptType.Read, "@alice:localhost", 1);
        const receipt2 = newReceipt("$event2", ReceiptType.Read, "@alice:localhost", 2, "main");

        // When we collect them
        acc.consumeEphemeralEvents([receipt1, receipt2]);
        const newEvent = acc.buildAccumulatedReceiptEvent(roomId);

        // We preserve both: thread:main and unthreaded receipts are different
        // things, with different meanings.
        expect(newEvent).toEqual(
            newMultiReceipt([
                ["$event1", ReceiptType.Read, "@alice:localhost", 1, undefined],
                ["$event2", ReceiptType.Read, "@alice:localhost", 2, "main"],
            ]),
        );
    });
});

const newReceipt = (
    eventId: string,
    receiptType: ReceiptType,
    userId: string,
    ts: number,
    threadId: string | undefined = undefined,
) => {
    return {
        type: "m.receipt",
        room_id: roomId,
        content: {
            [eventId]: {
                [receiptType]: {
                    [userId]: { ts, thread_id: threadId },
                },
            },
        },
    };
};

const newMultiReceipt = (infoArray: Array<[string, ReceiptType, string, number, string | undefined]>) => {
    return {
        type: "m.receipt",
        room_id: roomId,
        content: Object.fromEntries(
            infoArray.map(([eventId, receiptType, userId, ts, threadId]) => {
                return [
                    eventId,
                    {
                        [receiptType]: {
                            [userId]: { ts, thread_id: threadId },
                        },
                    },
                ];
            }),
        ),
    };
};

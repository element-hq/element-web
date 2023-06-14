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

import { IMinimalEvent } from "./sync-accumulator";
import { EventType } from "./@types/event";
import { isSupportedReceiptType, MapWithDefault, recursiveMapToObject } from "./utils";
import { IContent } from "./models/event";
import { ReceiptContent, ReceiptType } from "./@types/read_receipts";

interface AccumulatedReceipt {
    data: IMinimalEvent;
    type: ReceiptType;
    eventId: string;
}

/**
 * Summarises the read receipts within a room. Used by the sync accumulator.
 *
 * Given receipts for users, picks the most recently-received one and provides
 * the results in a new fake receipt event returned from
 * buildAccumulatedReceiptEvent().
 *
 * Handles unthreaded receipts and receipts in each thread separately, so the
 * returned event contains the most recently received unthreaded receipt, and
 * the most recently received receipt in each thread.
 */
export class ReceiptAccumulator {
    /** user_id -\> most-recently-received unthreaded receipt */
    private unthreadedReadReceipts: Map<string, AccumulatedReceipt> = new Map();

    /** thread_id -\> user_id -\> most-recently-received receipt for this thread */
    private threadedReadReceipts: MapWithDefault<string, Map<string, AccumulatedReceipt>> = new MapWithDefault(
        () => new Map(),
    );

    /**
     * Provide an unthreaded receipt for this user. Overwrites any other
     * unthreaded receipt we have for this user.
     */
    private setUnthreaded(userId: string, receipt: AccumulatedReceipt): void {
        this.unthreadedReadReceipts.set(userId, receipt);
    }

    /**
     * Provide a receipt for this user in this thread. Overwrites any other
     * receipt we have for this user in this thread.
     */
    private setThreaded(threadId: string, userId: string, receipt: AccumulatedReceipt): void {
        this.threadedReadReceipts.getOrCreate(threadId).set(userId, receipt);
    }

    /**
     * @returns an iterator of pairs of [userId, AccumulatedReceipt] - all the
     *          most recently-received unthreaded receipts for each user.
     */
    private allUnthreaded(): IterableIterator<[string, AccumulatedReceipt]> {
        return this.unthreadedReadReceipts.entries();
    }

    /**
     * @returns an iterator of pairs of [userId, AccumulatedReceipt] - all the
     *          most recently-received threaded receipts for each user, in all
     *          threads.
     */
    private *allThreaded(): IterableIterator<[string, AccumulatedReceipt]> {
        for (const receiptsForThread of this.threadedReadReceipts.values()) {
            for (const e of receiptsForThread.entries()) {
                yield e;
            }
        }
    }

    /**
     * Given a list of ephemeral events, find the receipts and store the
     * relevant ones to be returned later from buildAccumulatedReceiptEvent().
     */
    public consumeEphemeralEvents(events: IMinimalEvent[] | undefined): void {
        events?.forEach((e) => {
            if (e.type !== EventType.Receipt || !e.content) {
                // This means we'll drop unknown ephemeral events but that
                // seems okay.
                return;
            }

            // Handle m.receipt events. They clobber based on:
            //   (user_id, receipt_type)
            // but they are keyed in the event as:
            //   content:{ $event_id: { $receipt_type: { $user_id: {json} }}}
            // so store them in the former so we can accumulate receipt deltas
            // quickly and efficiently (we expect a lot of them). Fold the
            // receipt type into the key name since we only have 1 at the
            // moment (m.read) and nested JSON objects are slower and more
            // of a hassle to work with. We'll inflate this back out when
            // getJSON() is called.
            Object.keys(e.content).forEach((eventId) => {
                Object.entries<ReceiptContent>(e.content[eventId]).forEach(([key, value]) => {
                    if (!isSupportedReceiptType(key)) return;

                    for (const userId of Object.keys(value)) {
                        const data = e.content[eventId][key][userId];

                        const receipt = {
                            data: e.content[eventId][key][userId],
                            type: key as ReceiptType,
                            eventId,
                        };

                        // In a world that supports threads, read receipts normally have
                        // a `thread_id` which is either the thread they belong in or
                        // `MAIN_ROOM_TIMELINE`, so we normally use `setThreaded(...)`
                        // here. The `MAIN_ROOM_TIMELINE` is just treated as another
                        // thread.
                        //
                        // We still encounter read receipts that are "unthreaded"
                        // (missing the `thread_id` property). These come from clients
                        // that don't support threads, and from threaded clients that
                        // are doing a "Mark room as read" operation. Unthreaded
                        // receipts mark everything "before" them as read, in all
                        // threads, where "before" means in Sync Order i.e. the order
                        // the events were received from the homeserver in a sync.
                        // [Note: we have some bugs where we use timestamp order instead
                        // of Sync Order, because we don't correctly remember the Sync
                        // Order. See #3325.]
                        //
                        // Calling the wrong method will cause incorrect behavior like
                        // messages re-appearing as "new" when you already read them
                        // previously.
                        if (!data.thread_id) {
                            this.setUnthreaded(userId, receipt);
                        } else {
                            this.setThreaded(data.thread_id, userId, receipt);
                        }
                    }
                });
            });
        });
    }

    /**
     * Build a receipt event that contains all relevant information for this
     * room, taking the most recently received receipt for each user in an
     * unthreaded context, and in each thread.
     */
    public buildAccumulatedReceiptEvent(roomId: string): IMinimalEvent | null {
        const receiptEvent: IMinimalEvent = {
            type: EventType.Receipt,
            room_id: roomId,
            content: {
                // $event_id: { "m.read": { $user_id: $json } }
            } as IContent,
        };

        const receiptEventContent: MapWithDefault<
            string,
            MapWithDefault<ReceiptType, Map<string, object>>
        > = new MapWithDefault(() => new MapWithDefault(() => new Map()));

        for (const [userId, receiptData] of this.allUnthreaded()) {
            receiptEventContent
                .getOrCreate(receiptData.eventId)
                .getOrCreate(receiptData.type)
                .set(userId, receiptData.data);
        }

        for (const [userId, receiptData] of this.allThreaded()) {
            receiptEventContent
                .getOrCreate(receiptData.eventId)
                .getOrCreate(receiptData.type)
                .set(userId, receiptData.data);
        }

        receiptEvent.content = recursiveMapToObject(receiptEventContent);

        return receiptEventContent.size > 0 ? receiptEvent : null;
    }
}

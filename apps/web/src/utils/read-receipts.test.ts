/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { describe, it, expect, beforeEach, vi } from "vitest";
import { EventType, MatrixEvent, ReceiptType, Room, type MatrixClient } from "matrix-js-sdk/src/matrix";
import { createTestClient, mkMessage } from "test-utils";

import type { IReadReceiptProps } from "../components/views/rooms/EventTile";
import { getReadReceiptsByShownEvent, getReadReceiptsForEvent, type ShownReadReceipt } from "./read-receipts";

const ROOM_ID = "!room:example.org";
const ME = "@alice:example.org";
const BOB = "@bob:example.org";
const CAROL = "@carol:example.org";

describe("which message each read receipt is drawn beside", () => {
    let client: MatrixClient;
    let room: Room;

    const message = (id: string): MatrixEvent => mkMessage({ room: ROOM_ID, user: BOB, msg: id, event: true, id });

    /** Record `userId` having read `eventId`, as a receipt arriving from sync would. */
    const receiveReceipt = (eventId: string, userId: string, ts: number, type = ReceiptType.Read): void => {
        room.addReceipt(
            new MatrixEvent({
                type: EventType.Receipt,
                content: { [eventId]: { [type]: { [userId]: { ts } } } },
            }),
        );
    };

    const receiptsFor = (event: MatrixEvent): IReadReceiptProps[] =>
        getReadReceiptsForEvent(event, room, room, client, ME);

    const receiptsByShownEvent = (
        events: MatrixEvent[],
        isShown: (event: MatrixEvent, index: number) => boolean = () => true,
        previous: ReadonlyMap<string, ShownReadReceipt> = new Map(),
    ): ReturnType<typeof getReadReceiptsByShownEvent> =>
        getReadReceiptsByShownEvent(events, isShown, receiptsFor, previous);

    /** Whose receipts are drawn beside an event. Every shown event gets an entry, empty when nobody has read it. */
    const usersOn = (result: ReturnType<typeof receiptsByShownEvent>, eventId: string): string[] | undefined =>
        result.receiptsByEvent.get(eventId)?.map((r) => r.userId);

    beforeEach(() => {
        client = createTestClient();
        room = new Room(ROOM_ID, client, ME);
    });

    describe("getReadReceiptsForEvent", () => {
        it("returns other users' read receipts with their profile and time", () => {
            const event = message("$a");
            receiveReceipt("$a", BOB, 1000);

            expect(receiptsFor(event)).toEqual([{ userId: BOB, roomMember: room.getMember(BOB), ts: 1000 }]);
        });

        it("counts private read receipts too", () => {
            const event = message("$a");
            receiveReceipt("$a", BOB, 1000, ReceiptType.ReadPrivate);

            expect(receiptsFor(event).map((r) => r.userId)).toEqual([BOB]);
        });

        it("leaves out our own receipt and those of ignored users", () => {
            const event = message("$a");
            vi.mocked(client.isUserIgnored).mockImplementation((userId) => userId === CAROL);
            receiveReceipt("$a", ME, 1000);
            receiveReceipt("$a", CAROL, 1000);

            expect(receiptsFor(event)).toEqual([]);
        });
    });

    describe("getReadReceiptsByShownEvent", () => {
        it("draws a receipt beside the event it is for", () => {
            const events = [message("$a"), message("$b")];
            receiveReceipt("$a", BOB, 1000);

            const result = receiptsByShownEvent(events);

            expect(usersOn(result, "$a")).toEqual([BOB]);
            expect(usersOn(result, "$b")).toEqual([]);
        });

        it("folds a receipt on a hidden event into the last shown event before it", () => {
            const events = [message("$a"), message("$hidden"), message("$b")];
            receiveReceipt("$hidden", BOB, 1000);

            const result = receiptsByShownEvent(events, (event) => event.getId() !== "$hidden");

            expect(usersOn(result, "$a")).toEqual([BOB]);
        });

        it("drops a receipt on a hidden event with nothing shown before it", () => {
            const events = [message("$hidden"), message("$a")];
            receiveReceipt("$hidden", BOB, 1000);

            const result = receiptsByShownEvent(events, (event) => event.getId() !== "$hidden");

            expect([...result.receiptsByEvent.values()].flat()).toEqual([]);
        });

        it("orders an event's receipts most recent first", () => {
            const events = [message("$a")];
            receiveReceipt("$a", CAROL, 1000);
            receiveReceipt("$a", BOB, 2000);

            expect(usersOn(receiptsByShownEvent(events), "$a")).toEqual([BOB, CAROL]);
        });

        it("keeps a user where they were last drawn when their receipt has moved onto an event we do not hold", () => {
            const events = [message("$a"), message("$b")];
            receiveReceipt("$b", BOB, 1000);
            const first = receiptsByShownEvent(events);

            receiveReceipt("$not-loaded", BOB, 2000);
            const second = receiptsByShownEvent(events, undefined, first.receiptsByUserId);

            expect(usersOn(second, "$b")).toEqual([BOB]);
            expect(second.receiptsByUserId.get(BOB)?.lastShownEventId).toBe("$b");
        });

        it("moves a user once their receipt is on an event we hold", () => {
            const events = [message("$a"), message("$b")];
            receiveReceipt("$a", BOB, 1000);
            const first = receiptsByShownEvent(events);

            receiveReceipt("$b", BOB, 2000);
            const second = receiptsByShownEvent(events, undefined, first.receiptsByUserId);

            expect(usersOn(second, "$a")).toEqual([]);
            expect(usersOn(second, "$b")).toEqual([BOB]);
        });
    });
});

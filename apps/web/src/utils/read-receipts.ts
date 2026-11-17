/*
Copyright 2024 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type MatrixEvent, type MatrixClient, type Room, type Thread } from "matrix-js-sdk/src/matrix";
import { isSupportedReceiptType } from "matrix-js-sdk/src/utils";

import type { IReadReceiptProps } from "../components/views/rooms/EventTile";

/**
 * Determines if a read receipt update event includes the client's own user.
 * @param event The event to check.
 * @param client The client to check against.
 * @returns True if the read receipt update includes the client, false otherwise.
 */
export function readReceiptChangeIsFor(event: MatrixEvent, client: MatrixClient): boolean {
    const myUserId = client.getUserId()!;
    for (const eventId of Object.keys(event.getContent())) {
        for (const [receiptType, receipt] of Object.entries(event.getContent()[eventId])) {
            if (!isSupportedReceiptType(receiptType)) continue;

            if (Object.keys(receipt || {}).includes(myUserId)) return true;
        }
    }
    return false;
}

/** Where a user's receipt was drawn: beside which shown event, and the receipt itself. */
export interface ShownReadReceipt {
    lastShownEventId: string;
    receipt: IReadReceiptProps;
}

/** Other users' receipts to draw, by shown event, plus where each user ended up (see {@link getReadReceiptsByShownEvent}). */
export interface ReadReceiptsByShownEvent {
    receiptsByEvent: Map<string, IReadReceiptProps[]>;
    receiptsByUserId: Map<string, ShownReadReceipt>;
}

/**
 * The read receipts to draw beside an event: other users' read receipts on it, leaving out our
 * own and those of users we ignore.
 *
 * @param event The event whose receipts are wanted.
 * @param receiptSource Where the receipts are stored: the room, or the thread being shown.
 * @param room The room, for the members' profiles.
 * @param client The client, for the ignore list.
 * @param myUserId Our own user id, whose receipt is never drawn.
 */
export function getReadReceiptsForEvent(
    event: MatrixEvent,
    receiptSource: Room | Thread,
    room: Room,
    client: MatrixClient,
    myUserId: string | null,
): IReadReceiptProps[] {
    const receipts: IReadReceiptProps[] = [];
    receiptSource.getReceiptsForEvent(event).forEach((r) => {
        if (!r.userId || !isSupportedReceiptType(r.type) || r.userId === myUserId) {
            return; // ignore non-read receipts and receipts from self.
        }
        if (client.isUserIgnored(r.userId)) {
            return; // ignore ignored users
        }
        const member = room.getMember(r.userId);
        receipts.push({
            userId: r.userId,
            roomMember: member,
            ts: r.data ? r.data.ts : 0,
        });
    });
    return receipts;
}

/**
 * Works out which read receipts should be drawn beside which shown event. If a hidden event has
 * read receipts, they are folded into the receipts of the last shown event before it. Each event's
 * receipts are sorted most recent first.
 *
 * @param events The timeline's events, oldest first.
 * @param isShown Whether the event at this position gets a row of its own.
 * @param getReceipts The receipts to draw for an event, usually {@link getReadReceiptsForEvent}; null for none.
 * @param previousByUserId `receiptsByUserId` from the previous call, used to recover receipts
 *     that would otherwise be lost; see the comment in the function body.
 */
export function getReadReceiptsByShownEvent(
    events: readonly MatrixEvent[],
    isShown: (event: MatrixEvent, index: number) => boolean,
    getReceipts: (event: MatrixEvent) => IReadReceiptProps[] | null,
    previousByUserId: ReadonlyMap<string, ShownReadReceipt>,
): ReadReceiptsByShownEvent {
    const receiptsByEvent: Map<string, IReadReceiptProps[]> = new Map();
    const receiptsByUserId: Map<string, ShownReadReceipt> = new Map();

    let lastShownEventId: string | undefined;
    for (let i = 0; i < events.length; i++) {
        const event = events[i];
        if (isShown(event, i)) {
            lastShownEventId = event.getId();
        }
        if (!lastShownEventId) {
            continue;
        }

        const existingReceipts = receiptsByEvent.get(lastShownEventId) || [];
        const newReceipts = getReceipts(event);
        if (!newReceipts) continue;
        receiptsByEvent.set(lastShownEventId, existingReceipts.concat(newReceipts));

        // Record these receipts along with their last shown event ID for
        // each associated user ID.
        for (const receipt of newReceipts) {
            receiptsByUserId.set(receipt.userId, {
                lastShownEventId,
                receipt,
            });
        }
    }

    // It's possible in some cases (for example, when a read receipt
    // advances before we have paginated in the new event that it's marking
    // received) that we can temporarily not have a matching event for
    // someone which had one in the last. By looking through our previous
    // mapping of receipts by user ID, we can cover recover any receipts
    // that would have been lost by using the same event ID from last time.
    for (const [userId, { lastShownEventId, receipt }] of previousByUserId) {
        if (receiptsByUserId.get(userId)) {
            continue;
        }
        const existingReceipts = receiptsByEvent.get(lastShownEventId) || [];
        receiptsByEvent.set(lastShownEventId, existingReceipts.concat(receipt));
        receiptsByUserId.set(userId, { lastShownEventId, receipt });
    }

    // After grouping receipts by shown events, do another pass to sort each
    // receipt list.
    for (const receipts of receiptsByEvent.values()) {
        receipts.sort((r1, r2) => {
            return r2.ts - r1.ts;
        });
    }

    return { receiptsByEvent, receiptsByUserId };
}

/**
 * Whether two lists of receipts for one message draw the same: the same readers in the same order,
 * with the same timestamps and the same room members. Members are compared by reference: one
 * appearing (members lazy-loading) counts as a change, but a profile change does not, since the
 * SDK updates the member in place and both lists then hold the same, already-changed object.
 */
export function readReceiptsEqual(
    a: readonly IReadReceiptProps[] | null | undefined,
    b: readonly IReadReceiptProps[] | null | undefined,
): boolean {
    if (a === b) return true;
    if (!a || !b || a.length !== b.length) return false;
    return a.every((ra, i) => {
        const rb = b[i];
        return ra.userId === rb.userId && ra.ts === rb.ts && ra.roomMember === rb.roomMember;
    });
}

/**
 * The receipts just worked out, keeping the previous list for each message whose receipts draw the same
 * (see {@link readReceiptsEqual}), so only the tiles whose receipts moved get new props. When no
 * message's receipts changed, `previous` itself is returned.
 */
export function reuseUnchangedReadReceipts(
    previous: ReadonlyMap<string, IReadReceiptProps[]>,
    next: ReadonlyMap<string, IReadReceiptProps[]>,
): ReadonlyMap<string, IReadReceiptProps[]> {
    let changed = previous.size !== next.size;
    const result = new Map<string, IReadReceiptProps[]>();
    for (const [eventId, receipts] of next) {
        const previousReceipts = previous.get(eventId);
        if (previousReceipts && readReceiptsEqual(previousReceipts, receipts)) {
            result.set(eventId, previousReceipts);
        } else {
            result.set(eventId, receipts);
            changed = true;
        }
    }
    return changed ? result : previous;
}

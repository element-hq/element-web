/*
Copyright 2015 - 2023 The Matrix.org Foundation C.I.C.

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

import { Room } from "matrix-js-sdk/src/models/room";
import { Thread } from "matrix-js-sdk/src/models/thread";
import { MatrixEvent } from "matrix-js-sdk/src/models/event";
import { EventType } from "matrix-js-sdk/src/@types/event";
import { M_BEACON } from "matrix-js-sdk/src/@types/beacon";
import { logger } from "matrix-js-sdk/src/logger";
import { MatrixClient } from "matrix-js-sdk/src/matrix";

import shouldHideEvent from "./shouldHideEvent";
import { haveRendererForEvent } from "./events/EventTileFactory";
import SettingsStore from "./settings/SettingsStore";

/**
 * Returns true if this event arriving in a room should affect the room's
 * count of unread messages
 *
 * @param client The Matrix Client instance of the logged-in user
 * @param {Object} ev The event
 * @returns {boolean} True if the given event should affect the unread message count
 */
export function eventTriggersUnreadCount(client: MatrixClient, ev: MatrixEvent): boolean {
    if (ev.getSender() === client.getSafeUserId()) {
        return false;
    }

    switch (ev.getType()) {
        case EventType.RoomMember:
        case EventType.RoomThirdPartyInvite:
        case EventType.CallAnswer:
        case EventType.CallHangup:
        case EventType.RoomCanonicalAlias:
        case EventType.RoomServerAcl:
        case M_BEACON.name:
        case M_BEACON.altName:
            return false;
    }

    if (ev.isRedacted()) return false;
    return haveRendererForEvent(ev, false /* hidden messages should never trigger unread counts anyways */);
}

export function doesRoomHaveUnreadMessages(room: Room): boolean {
    if (SettingsStore.getValue("feature_sliding_sync")) {
        // TODO: https://github.com/vector-im/element-web/issues/23207
        // Sliding Sync doesn't support unread indicator dots (yet...)
        return false;
    }

    for (const timeline of [room, ...room.getThreads()]) {
        // If the current timeline has unread messages, we're done.
        if (doesRoomOrThreadHaveUnreadMessages(timeline)) {
            return true;
        }
    }
    // If we got here then no timelines were found with unread messages.
    return false;
}

export function doesRoomOrThreadHaveUnreadMessages(roomOrThread: Room | Thread): boolean {
    // NOTE: this shares logic with hasUserReadEvent in
    // matrix-js-sdk/src/models/read-receipt.ts. They are not combined (yet)
    // because hasUserReadEvent is focussed on a single event, and this is
    // focussed on the whole room/thread.

    // If there are no messages yet in the timeline then it isn't fully initialised
    // and cannot be unread.
    if (!roomOrThread || roomOrThread.timeline.length === 0) {
        return false;
    }

    const myUserId = roomOrThread.client.getSafeUserId();

    // as we don't send RRs for our own messages, make sure we special case that
    // if *we* sent the last message into the room, we consider it not unread!
    // Should fix: https://github.com/vector-im/element-web/issues/3263
    //             https://github.com/vector-im/element-web/issues/2427
    // ...and possibly some of the others at
    //             https://github.com/vector-im/element-web/issues/3363
    if (roomOrThread.timeline[roomOrThread.timeline.length - 1]?.getSender() === myUserId) {
        return false;
    }

    const readUpToId = roomOrThread.getEventReadUpTo(myUserId);
    const hasReceipt = makeHasReceipt(roomOrThread, readUpToId, myUserId);

    // Loop through messages, starting with the most recent...
    for (let i = roomOrThread.timeline.length - 1; i >= 0; --i) {
        const ev = roomOrThread.timeline[i];

        if (hasReceipt(ev)) {
            // If we've read up to this event, there's nothing more recent
            // that counts and we can stop looking because the user's read
            // this and everything before.
            return false;
        } else if (isImportantEvent(roomOrThread.client, ev)) {
            // We've found a message that counts before we hit
            // the user's read receipt, so this room is definitely unread.
            return true;
        }
    }

    // If we got here, we didn't find a message was important but didn't find
    // the user's read receipt either, so we guess and say that the room is
    // unread on the theory that false positives are better than false
    // negatives here.
    logger.warn("Falling back to unread room because of no read receipt or counting message found", {
        roomOrThreadId: roomOrThread.roomId,
        readUpToId,
    });
    return true;
}

/**
 * Given this event does not have a receipt, is it important enough to make
 * this room unread?
 */
function isImportantEvent(client: MatrixClient, event: MatrixEvent): boolean {
    return !shouldHideEvent(event) && eventTriggersUnreadCount(client, event);
}

/**
 * @returns a function that tells us whether a given event matches our read
 *          receipt.
 *
 * We have the ID of an event based on a read receipt. If we can find the
 * corresponding event, then it's easy - our returned function just decides
 * whether the receipt refers to the event we are asking about.
 *
 * If we can't find the event, we guess by saying of the receipt's timestamp is
 * after this event's timestamp, then it's probably saying this event is read.
 */
function makeHasReceipt(
    roomOrThread: Room | Thread,
    readUpToId: string | null,
    myUserId: string,
): (event: MatrixEvent) => boolean {
    // get the most recent read receipt sent by our account.
    // N.B. this is NOT a read marker (RM, aka "read up to marker"),
    // despite the name of the method :((
    const readEvent = readUpToId ? roomOrThread.findEventById(readUpToId) : null;

    if (readEvent) {
        // If we found an event matching our receipt, then it's easy: this event
        // has a receipt if its ID is the same as the one in the receipt.
        return (ev) => ev.getId() == readUpToId;
    } else {
        // If we didn't, we have to guess by saying if this event is before the
        // receipt's ts, then it we pretend it has a receipt.
        const receipt = roomOrThread.getReadReceiptForUserId(myUserId);
        if (receipt) {
            const receiptTimestamp = receipt.data.ts;
            return (ev) => ev.getTs() < receiptTimestamp;
        } else {
            return (_ev) => false;
        }
    }
}

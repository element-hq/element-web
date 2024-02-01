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

import { M_BEACON, Room, Thread, MatrixEvent, EventType, MatrixClient } from "matrix-js-sdk/src/matrix";
import { logger } from "matrix-js-sdk/src/logger";

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
    return haveRendererForEvent(ev, client, false /* hidden messages should never trigger unread counts anyways */);
}

export function doesRoomHaveUnreadMessages(room: Room, includeThreads: boolean): boolean {
    if (SettingsStore.getValue("feature_sliding_sync")) {
        // TODO: https://github.com/vector-im/element-web/issues/23207
        // Sliding Sync doesn't support unread indicator dots (yet...)
        return false;
    }

    const toCheck: Array<Room | Thread> = [room];
    if (includeThreads) {
        toCheck.push(...room.getThreads());
    }

    for (const withTimeline of toCheck) {
        if (doesTimelineHaveUnreadMessages(room, withTimeline.timeline)) {
            // We found an unread, so the room is unread
            return true;
        }
    }

    // If we got here then no timelines were found with unread messages.
    return false;
}

function doesTimelineHaveUnreadMessages(room: Room, timeline: Array<MatrixEvent>): boolean {
    // The room is a space, let's ignore it
    if (room.isSpaceRoom()) return false;

    const myUserId = room.client.getSafeUserId();
    const latestImportantEventId = findLatestImportantEvent(room.client, timeline)?.getId();
    if (latestImportantEventId) {
        return !room.hasUserReadEvent(myUserId, latestImportantEventId);
    } else {
        // We couldn't find an important event to check - check the unimportant ones.
        const earliestUnimportantEventId = timeline.at(0)?.getId();
        if (!earliestUnimportantEventId) {
            // There are no events in this timeline - it is uninitialised, so we
            // consider it read
            return false;
        } else if (room.hasUserReadEvent(myUserId, earliestUnimportantEventId)) {
            // Some of the unimportant events are read, and there are no
            // important ones after them, so we've read everything.
            return false;
        } else {
            // We have events. and none of them are read.  We must guess that
            // the timeline is unread, because there could be older unread
            // important events that we don't have loaded.
            logger.warn("Falling back to unread room because of no read receipt or counting message found", {
                roomId: room.roomId,
                earliestUnimportantEventId: earliestUnimportantEventId,
            });
            return true;
        }
    }
}

export function doesRoomOrThreadHaveUnreadMessages(roomOrThread: Room | Thread): boolean {
    const room = roomOrThread instanceof Thread ? roomOrThread.room : roomOrThread;
    const events = roomOrThread instanceof Thread ? roomOrThread.timeline : room.getLiveTimeline().getEvents();
    return doesTimelineHaveUnreadMessages(room, events);
}

/**
 * Look backwards through the timeline and find the last event that is
 * "important" in the sense of isImportantEvent.
 *
 * @returns the latest important event, or null if none were found
 */
function findLatestImportantEvent(client: MatrixClient, timeline: Array<MatrixEvent>): MatrixEvent | null {
    for (let index = timeline.length - 1; index >= 0; index--) {
        const event = timeline[index];
        if (isImportantEvent(client, event)) {
            return event;
        }
    }
    return null;
}

/**
 * Given this event does not have a receipt, is it important enough to make
 * this room unread?
 */
function isImportantEvent(client: MatrixClient, event: MatrixEvent): boolean {
    return !shouldHideEvent(event) && eventTriggersUnreadCount(client, event);
}

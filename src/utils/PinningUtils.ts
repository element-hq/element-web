/*
Copyright 2024 New Vector Ltd.
Copyright 2017 Travis Ralston

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {
    type MatrixEvent,
    EventType,
    M_POLL_START,
    type MatrixClient,
    EventTimeline,
    type Room,
    type EmptyObject,
} from "matrix-js-sdk/src/matrix";

import { isContentActionable } from "./EventUtils";
import { ReadPinsEventId } from "../components/views/right_panel/types";

export default class PinningUtils {
    /**
     * Event types that may be pinned.
     */
    public static readonly PINNABLE_EVENT_TYPES: (EventType | string)[] = [
        EventType.RoomMessage,
        M_POLL_START.name,
        M_POLL_START.altName,
    ];

    /**
     * Determines if the given event can be pinned.
     * This is a simple check to see if the event is of a type that can be pinned.
     * @param {MatrixEvent} event The event to check.
     * @return {boolean} True if the event may be pinned, false otherwise.
     */
    public static isPinnable(event: MatrixEvent): boolean {
        if (event.isRedacted()) return false;
        return PinningUtils.isUnpinnable(event);
    }

    /**
     * Determines if the given event may be unpinned.
     * @param {MatrixEvent} event The event to check.
     * @return {boolean} True if the event may be unpinned, false otherwise.
     */
    public static isUnpinnable(event: MatrixEvent): boolean {
        if (!event) return false;
        if (event.isRedacted()) return true;
        return this.PINNABLE_EVENT_TYPES.includes(event.getType());
    }

    /**
     * Determines if the given event is pinned.
     * @param matrixClient
     * @param mxEvent
     */
    public static isPinned(matrixClient: MatrixClient, mxEvent: MatrixEvent): boolean {
        const room = matrixClient.getRoom(mxEvent.getRoomId());
        if (!room) return false;

        const pinnedEvent = room
            .getLiveTimeline()
            .getState(EventTimeline.FORWARDS)
            ?.getStateEvents(EventType.RoomPinnedEvents, "");
        if (!pinnedEvent) return false;
        const content = pinnedEvent.getContent();
        return content.pinned && Array.isArray(content.pinned) && content.pinned.includes(mxEvent.getId());
    }

    /**
     * Determines if the given event may be pinned by the current user.
     * This checks if the user has the necessary permissions to pin or unpin the event, and if the event is pinnable.
     * @param matrixClient
     * @param mxEvent
     */
    public static canPin(matrixClient: MatrixClient, mxEvent: MatrixEvent): boolean {
        if (!isContentActionable(mxEvent)) return false;

        const room = matrixClient.getRoom(mxEvent.getRoomId());
        if (!room) return false;

        return PinningUtils.userHasPinOrUnpinPermission(matrixClient, room) && PinningUtils.isPinnable(mxEvent);
    }

    /**
     * Determines if the given event may be unpinned by the current user.
     * This checks if the user has the necessary permissions to pin or unpin the event, and if the event is unpinnable.
     * @param matrixClient
     * @param mxEvent
     */
    public static canUnpin(matrixClient: MatrixClient, mxEvent: MatrixEvent): boolean {
        const room = matrixClient.getRoom(mxEvent.getRoomId());
        if (!room) return false;

        return PinningUtils.userHasPinOrUnpinPermission(matrixClient, room) && PinningUtils.isUnpinnable(mxEvent);
    }

    /**
     * Determines if the current user has permission to pin or unpin events in the given room.
     * @param matrixClient
     * @param room
     */
    public static userHasPinOrUnpinPermission(matrixClient: MatrixClient, room: Room): boolean {
        return Boolean(
            room
                .getLiveTimeline()
                .getState(EventTimeline.FORWARDS)
                ?.mayClientSendStateEvent(EventType.RoomPinnedEvents, matrixClient),
        );
    }

    /**
     * Pin or unpin the given event.
     * @param matrixClient
     * @param mxEvent
     */
    public static async pinOrUnpinEvent(matrixClient: MatrixClient, mxEvent: MatrixEvent): Promise<void> {
        const room = matrixClient.getRoom(mxEvent.getRoomId());
        if (!room) return;

        const eventId = mxEvent.getId();
        if (!eventId) return;

        // Get the current pinned events of the room
        const pinnedIds: Array<string> =
            room
                .getLiveTimeline()
                .getState(EventTimeline.FORWARDS)
                ?.getStateEvents(EventType.RoomPinnedEvents, "")
                ?.getContent().pinned || [];

        let roomAccountDataPromise: Promise<EmptyObject | void> = Promise.resolve();
        // If the event is already pinned, unpin it
        if (pinnedIds.includes(eventId)) {
            pinnedIds.splice(pinnedIds.indexOf(eventId), 1);
        } else {
            // Otherwise, pin it
            pinnedIds.push(eventId);
            // We don't want to wait for the roomAccountDataPromise to resolve before sending the state event
            roomAccountDataPromise = matrixClient.setRoomAccountData(room.roomId, ReadPinsEventId, {
                event_ids: [...(room.getAccountData(ReadPinsEventId)?.getContent()?.event_ids || []), eventId],
            });
        }
        await Promise.all([
            matrixClient.sendStateEvent(room.roomId, EventType.RoomPinnedEvents, { pinned: pinnedIds }, ""),
            roomAccountDataPromise,
        ]);
    }

    /**
     * Unpin all events in the given room.
     * @param matrixClient
     * @param roomId
     */
    public static async unpinAllEvents(matrixClient: MatrixClient, roomId: string): Promise<void> {
        await matrixClient.sendStateEvent(roomId, EventType.RoomPinnedEvents, { pinned: [] }, "");
    }
}

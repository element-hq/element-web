/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import {
    MatrixEventEvent,
    NotificationCountType,
    PendingEventOrdering,
    Room,
    RoomEvent,
} from "matrix-js-sdk/src/matrix";

import type { MatrixClient } from "matrix-js-sdk/src/matrix";
import { mkEvent, stubClient } from "../../../test-utils/test-utils";
import { UnreadNotificationBadgeViewModel } from "../../../../src/viewmodels/room/notification-badge/UnreadNotificationBadgeViewModel";

describe("UnreadNotificationBadgeViewModel", () => {
    let client: MatrixClient;
    let room: Room;
    const trackedRoomEvents = [
        RoomEvent.UnreadNotifications,
        RoomEvent.Receipt,
        RoomEvent.Timeline,
        RoomEvent.Redaction,
        RoomEvent.LocalEchoUpdated,
        RoomEvent.MyMembership,
    ];

    beforeEach(() => {
        client = stubClient();
        room = new Room("!room:example.org", client, "@user:example.org", {
            pendingEventOrdering: PendingEventOrdering.Detached,
        });
    });

    function setUnreads(greys: number, reds: number): void {
        room.setUnreadNotificationCount(NotificationCountType.Total, greys);
        room.setUnreadNotificationCount(NotificationCountType.Highlight, reds);
    }

    it("computes the initial snapshot from unread state", () => {
        setUnreads(12, 0);

        const vm = new UnreadNotificationBadgeViewModel({ room });

        expect(vm.getSnapshot()).toMatchObject({
            shouldRender: true,
            isVisible: true,
            isNotification: true,
            isHighlight: false,
            badgeType: "badge_2char",
            symbol: "12",
        });

        vm.dispose();
    });

    it("updates when the room unread state changes", () => {
        const vm = new UnreadNotificationBadgeViewModel({ room });
        const listener = jest.fn();
        vm.subscribe(listener);

        setUnreads(0, 2);

        expect(vm.getSnapshot()).toMatchObject({
            isHighlight: true,
            symbol: "2",
        });
        expect(listener).toHaveBeenCalled();

        vm.dispose();
    });

    it("re-evaluates the unread state when an event of the room is decrypted", () => {
        const mkDecryptedEvent = (roomId: string) =>
            mkEvent({ event: true, type: "m.room.message", user: "@alice:example.org", room: roomId, content: {} });
        const vm = new UnreadNotificationBadgeViewModel({ room });
        const listener = jest.fn();
        vm.subscribe(listener);

        // A decryption in another room must not disturb this one
        client.emit(MatrixEventEvent.Decrypted, mkDecryptedEvent("!other:example.org"));
        expect(listener).not.toHaveBeenCalled();

        room.getRoomUnreadNotificationCount = jest
            .fn()
            .mockImplementation((type: NotificationCountType) => (type === NotificationCountType.Total ? 3 : 0));
        client.emit(MatrixEventEvent.Decrypted, mkDecryptedEvent(room.roomId));

        expect(vm.getSnapshot()).toMatchObject({ isNotification: true, symbol: "3" });
        expect(listener).toHaveBeenCalled();

        vm.dispose();
    });

    it("skips unchanged force-dot setter updates", () => {
        setUnreads(1, 0);
        const vm = new UnreadNotificationBadgeViewModel({ room, forceDot: false });
        const listener = jest.fn();
        vm.subscribe(listener);

        vm.setForceDot(false);

        expect(listener).not.toHaveBeenCalled();

        vm.setForceDot(true);

        expect(listener).toHaveBeenCalledTimes(1);
        expect(vm.getSnapshot().badgeType).toBe("dot");

        vm.dispose();
    });

    it("moves room event listeners when the room changes", () => {
        const nextRoom = new Room("!next:example.org", client, "@user:example.org", {
            pendingEventOrdering: PendingEventOrdering.Detached,
        });
        const initialRoomListenerCounts = new Map(
            trackedRoomEvents.map((eventName) => [eventName, room.listenerCount(eventName)]),
        );
        const initialNextRoomListenerCounts = new Map(
            trackedRoomEvents.map((eventName) => [eventName, nextRoom.listenerCount(eventName)]),
        );
        const vm = new UnreadNotificationBadgeViewModel({ room });

        for (const eventName of trackedRoomEvents) {
            expect(room.listenerCount(eventName)).toBe(initialRoomListenerCounts.get(eventName)! + 1);
        }

        vm.setRoom(nextRoom);

        for (const eventName of trackedRoomEvents) {
            expect(room.listenerCount(eventName)).toBe(initialRoomListenerCounts.get(eventName));
            expect(nextRoom.listenerCount(eventName)).toBe(initialNextRoomListenerCounts.get(eventName)! + 1);
        }

        vm.dispose();
        for (const eventName of trackedRoomEvents) {
            expect(nextRoom.listenerCount(eventName)).toBe(initialNextRoomListenerCounts.get(eventName));
        }
    });
});

/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

// @vitest-environment happy-dom

import {
    EventStatus,
    MatrixEventEvent,
    NotificationCountType,
    PendingEventOrdering,
    Room,
    RoomEvent,
} from "matrix-js-sdk/src/matrix";
import { KnownMembership } from "matrix-js-sdk/src/types";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkEvent, mkMessage, muteRoom, stubClient } from "test-utils";
import { mkThread } from "test-utils/threads";

import type { MatrixClient } from "matrix-js-sdk/src/matrix";
import * as RoomNotifs from "../../../RoomNotifs";
import { NotificationLevel } from "../../../stores/notifications/NotificationLevel";
import { UnreadNotificationBadgeViewModel } from "./UnreadNotificationBadgeViewModel";

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

    afterEach(() => {
        vi.restoreAllMocks();
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
        const listener = vi.fn();
        vm.subscribe(listener);

        setUnreads(0, 2);

        expect(vm.getSnapshot()).toMatchObject({
            isHighlight: true,
            symbol: "2",
        });
        expect(listener).toHaveBeenCalled();

        vm.dispose();
    });

    it("updates when the thread unread state changes", () => {
        const { rootEvent } = mkThread({
            room,
            client,
            authorId: client.getUserId()!,
            participantUserIds: [client.getUserId()!],
        });
        const threadId = rootEvent.getId()!;
        room.setThreadUnreadNotificationCount(threadId, NotificationCountType.Total, 1);

        const vm = new UnreadNotificationBadgeViewModel({ room, threadId });
        expect(vm.getSnapshot()).toMatchObject({
            shouldRender: true,
            isNotification: true,
            isHighlight: false,
            symbol: "1",
        });

        room.setThreadUnreadNotificationCount(threadId, NotificationCountType.Highlight, 1);

        expect(vm.getSnapshot()).toMatchObject({
            isHighlight: true,
            symbol: "1",
        });
        vm.dispose();
    });

    it("does not render when there are no unread notifications", () => {
        const vm = new UnreadNotificationBadgeViewModel({ room });

        expect(vm.getSnapshot().shouldRender).toBe(false);
        vm.dispose();
    });

    it("renders a warning for unsent messages", () => {
        const event = mkMessage({
            room: room.roomId,
            user: "@alice:example.org",
            msg: "Hello world!",
            event: true,
        });
        event.status = EventStatus.NOT_SENT;
        room.addPendingEvent(event, "123");

        const vm = new UnreadNotificationBadgeViewModel({ room });

        expect(vm.getSnapshot()).toMatchObject({
            shouldRender: true,
            symbol: "!",
            isHighlight: true,
        });
        vm.dispose();
    });

    it("renders a warning for invites", () => {
        room.updateMyMembership(KnownMembership.Invite);

        const vm = new UnreadNotificationBadgeViewModel({ room });

        expect(vm.getSnapshot()).toMatchObject({
            shouldRender: true,
            symbol: "!",
            isHighlight: true,
        });
        vm.dispose();
    });

    it("does not render for muted rooms", () => {
        muteRoom(room);
        setUnreads(1, 0);

        const vm = new UnreadNotificationBadgeViewModel({ room });

        expect(vm.getSnapshot().shouldRender).toBe(false);
        vm.dispose();
    });

    it("renders a dot for activity-level unread messages", () => {
        vi.spyOn(RoomNotifs, "determineUnreadState").mockReturnValue({
            level: NotificationLevel.Activity,
            symbol: null,
            count: 0,
            invited: false,
        });

        const vm = new UnreadNotificationBadgeViewModel({ room });

        expect(vm.getSnapshot()).toMatchObject({
            shouldRender: true,
            isVisible: true,
            badgeType: "dot",
            isNotification: false,
            isHighlight: false,
        });
        vm.dispose();
    });

    it("re-evaluates the unread state when an event of the room is decrypted", () => {
        const mkDecryptedEvent = (roomId: string) =>
            mkEvent({ event: true, type: "m.room.message", user: "@alice:example.org", room: roomId, content: {} });
        const vm = new UnreadNotificationBadgeViewModel({ room });
        const listener = vi.fn();
        vm.subscribe(listener);

        client.emit(MatrixEventEvent.Decrypted, mkDecryptedEvent("!other:example.org"));
        expect(listener).not.toHaveBeenCalled();

        room.getRoomUnreadNotificationCount = vi
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
        const listener = vi.fn();
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

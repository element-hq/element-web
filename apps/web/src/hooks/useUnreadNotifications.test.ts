/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { describe, it, expect, beforeEach, vi } from "vitest";
import { act, renderHook } from "test-utils-rtl";
import {
    EventStatus,
    MatrixEventEvent,
    NotificationCountType,
    PendingEventOrdering,
    Room,
} from "matrix-js-sdk/src/matrix";
import { KnownMembership } from "matrix-js-sdk/src/types";
import { type MatrixClient } from "matrix-js-sdk/src/matrix";
import { mkEvent, muteRoom, stubClient } from "test-utils";

import { useUnreadNotifications } from "./useUnreadNotifications";
import { NotificationLevel } from "../stores/notifications/NotificationLevel";

describe("useUnreadNotifications", () => {
    let client: MatrixClient;
    let room: Room;

    beforeEach(() => {
        client = stubClient();
        room = new Room("!room:example.org", client, "@user:example.org", {
            pendingEventOrdering: PendingEventOrdering.Detached,
        });
    });

    function setUnreads(greys: number, reds: number): void {
        room.setUnreadNotificationCount(NotificationCountType.Highlight, reds);
        room.setUnreadNotificationCount(NotificationCountType.Total, greys);
    }

    it("shows nothing by default", async () => {
        const { result } = renderHook(() => useUnreadNotifications(room));
        const { level, symbol, count } = result.current;

        expect(symbol).toBe(null);
        expect(level).toBe(NotificationLevel.None);
        expect(count).toBe(0);
    });

    it("indicates if there are unsent messages", async () => {
        const event = mkEvent({
            event: true,
            type: "m.message",
            user: "@user:example.org",
            content: {},
        });
        event.status = EventStatus.NOT_SENT;
        room.addPendingEvent(event, "txn");

        const { result } = renderHook(() => useUnreadNotifications(room));
        const { level, symbol, count } = result.current;

        expect(symbol).toBe("!");
        expect(level).toBe(NotificationLevel.Unsent);
        expect(count).toBeGreaterThan(0);
    });

    it("indicates the user has been invited to a channel", async () => {
        room.updateMyMembership(KnownMembership.Invite);

        const { result } = renderHook(() => useUnreadNotifications(room));
        const { level, symbol, count } = result.current;

        expect(symbol).toBe("!");
        expect(level).toBe(NotificationLevel.Highlight);
        expect(count).toBeGreaterThan(0);
    });

    it("shows nothing for muted channels", async () => {
        setUnreads(999, 999);
        muteRoom(room);

        const { result } = renderHook(() => useUnreadNotifications(room));
        const { level, count } = result.current;

        expect(level).toBe(NotificationLevel.None);
        expect(count).toBe(0);
    });

    it("uses the correct number of unreads", async () => {
        setUnreads(999, 0);

        const { result } = renderHook(() => useUnreadNotifications(room));
        const { level, count } = result.current;

        expect(level).toBe(NotificationLevel.Notification);
        expect(count).toBe(999);
    });

    it("uses the correct number of highlights", async () => {
        setUnreads(0, 888);

        const { result } = renderHook(() => useUnreadNotifications(room));
        const { level, count } = result.current;

        expect(level).toBe(NotificationLevel.Highlight);
        expect(count).toBe(888);
    });

    it("re-evaluates the unread state when an event of the room is decrypted", async () => {
        const mkDecryptedEvent = (roomId: string) =>
            mkEvent({ event: true, type: "m.room.message", user: "@alice:example.org", room: roomId, content: {} });

        const { result } = renderHook(() => useUnreadNotifications(room));
        expect(result.current.level).toBe(NotificationLevel.None);

        room.getRoomUnreadNotificationCount = vi
            .fn()
            .mockImplementation((type: NotificationCountType) => (type === NotificationCountType.Total ? 1 : 0));

        // A decryption in another room must not disturb this one
        act(() => {
            client.emit(MatrixEventEvent.Decrypted, mkDecryptedEvent("!other:example.org"));
        });
        expect(result.current.level).toBe(NotificationLevel.None);

        act(() => {
            client.emit(MatrixEventEvent.Decrypted, mkDecryptedEvent(room.roomId));
        });
        expect(result.current.level).toBe(NotificationLevel.Notification);
    });
});

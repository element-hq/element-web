/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { renderHook } from "jest-matrix-react";
import { EventStatus, NotificationCountType, PendingEventOrdering, Room } from "matrix-js-sdk/src/matrix";
import { KnownMembership } from "matrix-js-sdk/src/types";

import type { MatrixClient } from "matrix-js-sdk/src/matrix";
import { useUnreadNotifications } from "../../../src/hooks/useUnreadNotifications";
import { NotificationLevel } from "../../../src/stores/notifications/NotificationLevel";
import { mkEvent, muteRoom, stubClient } from "../../test-utils";

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
});

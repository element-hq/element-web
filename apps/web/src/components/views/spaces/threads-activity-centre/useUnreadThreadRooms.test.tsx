/*
 * Copyright 2024 New Vector Ltd.
 * Copyright 2024 The Matrix.org Foundation C.I.C.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

// @vitest-environment happy-dom

import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import React from "react";
import { renderHook, act } from "test-utils-rtl";
import { stubClient } from "test-utils";
import { populateThread } from "test-utils/threads";
import {
    type MatrixClient,
    MatrixEventEvent,
    NotificationCountType,
    PendingEventOrdering,
    Room,
} from "matrix-js-sdk/src/matrix";

import MatrixClientContext from "../../../../contexts/MatrixClientContext";
import { NotificationLevel } from "../../../../stores/notifications/NotificationLevel";
import { useUnreadThreadRooms } from "./useUnreadThreadRooms";
import SettingsStore from "../../../../settings/SettingsStore";

describe("useUnreadThreadRooms", () => {
    let client: MatrixClient;
    let room: Room;

    beforeEach(() => {
        client = stubClient();
        client.supportsThreads = () => true;
        room = new Room("!room1:example.org", client, "@fee:bar", {
            pendingEventOrdering: PendingEventOrdering.Detached,
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("has no notifications with no rooms", async () => {
        const { result } = renderHook(() => useUnreadThreadRooms(false));
        const { greatestNotificationLevel, rooms } = result.current;

        expect(greatestNotificationLevel).toBe(NotificationLevel.None);
        expect(rooms.length).toEqual(0);
    });

    it("an activity notification is ignored by default", async () => {
        const notifThreadInfo = await populateThread({
            room: room,
            client: client,
            authorId: "@foo:bar",
            participantUserIds: ["@fee:bar"],
        });
        room.setThreadUnreadNotificationCount(notifThreadInfo.thread.id, NotificationCountType.Total, 0);

        client.getVisibleRooms = vi.fn().mockReturnValue([room]);

        const wrapper = ({ children }: { children: React.ReactNode }) => (
            <MatrixClientContext.Provider value={client}>{children}</MatrixClientContext.Provider>
        );

        const { result } = renderHook(() => useUnreadThreadRooms(true), { wrapper });
        const { greatestNotificationLevel, rooms } = result.current;

        expect(greatestNotificationLevel).toBe(NotificationLevel.None);
        expect(rooms.length).toEqual(0);
    });

    it("an activity notification is displayed with the setting enabled", async () => {
        vi.spyOn(SettingsStore, "getValue").mockReturnValue(false);

        const notifThreadInfo = await populateThread({
            room: room,
            client: client,
            authorId: "@foo:bar",
            participantUserIds: ["@fee:bar"],
        });
        room.setThreadUnreadNotificationCount(notifThreadInfo.thread.id, NotificationCountType.Total, 0);

        client.getVisibleRooms = vi.fn().mockReturnValue([room]);

        const wrapper = ({ children }: { children: React.ReactNode }) => (
            <MatrixClientContext.Provider value={client}>{children}</MatrixClientContext.Provider>
        );

        const { result } = renderHook(() => useUnreadThreadRooms(true), { wrapper });
        const { greatestNotificationLevel, rooms } = result.current;

        expect(greatestNotificationLevel).toBe(NotificationLevel.Activity);
        expect(rooms.length).toEqual(1);
    });

    it("a notification and a highlight summarise to a highlight", async () => {
        const notifThreadInfo = await populateThread({
            room: room,
            client: client,
            authorId: "@foo:bar",
            participantUserIds: ["@fee:bar"],
        });
        room.setThreadUnreadNotificationCount(notifThreadInfo.thread.id, NotificationCountType.Total, 1);

        const highlightThreadInfo = await populateThread({
            room: room,
            client: client,
            authorId: "@foo:bar",
            participantUserIds: ["@fee:bar"],
        });
        room.setThreadUnreadNotificationCount(highlightThreadInfo.thread.id, NotificationCountType.Highlight, 1);

        client.getVisibleRooms = vi.fn().mockReturnValue([room]);

        const wrapper = ({ children }: { children: React.ReactNode }) => (
            <MatrixClientContext.Provider value={client}>{children}</MatrixClientContext.Provider>
        );

        const { result } = renderHook(() => useUnreadThreadRooms(true), { wrapper });
        const { greatestNotificationLevel, rooms } = result.current;

        expect(greatestNotificationLevel).toBe(NotificationLevel.Highlight);
        expect(rooms.length).toEqual(1);
    });

    describe("updates", () => {
        beforeEach(() => {
            vi.useFakeTimers();
        });

        afterEach(() => {
            vi.useRealTimers();
        });

        it("updates on decryption within 1s", async () => {
            const notifThreadInfo = await populateThread({
                room: room,
                client: client,
                authorId: "@foo:bar",
                participantUserIds: ["@fee:bar"],
            });
            room.setThreadUnreadNotificationCount(notifThreadInfo.thread.id, NotificationCountType.Total, 0);

            client.getVisibleRooms = vi.fn().mockReturnValue([room]);

            const wrapper = ({ children }: { children: React.ReactNode }) => (
                <MatrixClientContext.Provider value={client}>{children}</MatrixClientContext.Provider>
            );

            const { result } = renderHook(() => useUnreadThreadRooms(true), { wrapper });

            expect(result.current.greatestNotificationLevel).toBe(NotificationLevel.None);

            act(() => {
                room.setThreadUnreadNotificationCount(notifThreadInfo.thread.id, NotificationCountType.Highlight, 1);
                client.emit(MatrixEventEvent.Decrypted, notifThreadInfo.thread.events[0]);

                vi.advanceTimersByTime(1000);
            });

            expect(result.current.greatestNotificationLevel).toBe(NotificationLevel.Highlight);
        });
    });
});

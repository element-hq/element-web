/*
 * Copyright 2024 New Vector Ltd.
 * Copyright 2024 The Matrix.org Foundation C.I.C.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";
import {
    type MatrixClient,
    MatrixEventEvent,
    NotificationCountType,
    PendingEventOrdering,
    Room,
} from "matrix-js-sdk/src/matrix";
import { renderHook, act } from "jest-matrix-react";

import MatrixClientContext from "../../../../../src/contexts/MatrixClientContext";
import { muteRoom, stubClient } from "../../../../test-utils";
import { populateThread } from "../../../../test-utils/threads";
import { NotificationLevel } from "../../../../../src/stores/notifications/NotificationLevel";
import { useUnreadThreadRooms } from "../../../../../src/components/views/spaces/threads-activity-centre/useUnreadThreadRooms";
import SettingsStore from "../../../../../src/settings/SettingsStore";

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
        jest.restoreAllMocks();
    });

    it("has no notifications with no rooms", async () => {
        const { result } = renderHook(() => useUnreadThreadRooms(false));
        const { greatestNotificationLevel, rooms } = result.current;

        expect(greatestNotificationLevel).toBe(NotificationLevel.None);
        expect(rooms.length).toEqual(0);
    });

    it("an Other-threads activity-only thread is hidden when settingTACOnlyNotifs is on", async () => {
        // Setting on → drop activity-only entries from Other threads.
        jest.spyOn(SettingsStore, "getValue").mockReturnValue(true);

        const notifThreadInfo = await populateThread({
            room: room,
            client: client,
            authorId: "@foo:bar",
            participantUserIds: ["@fee:bar"],
        });
        room.setThreadUnreadNotificationCount(notifThreadInfo.thread.id, NotificationCountType.Total, 0);

        client.getVisibleRooms = jest.fn().mockReturnValue([room]);

        const wrapper = ({ children }: { children: React.ReactNode }) => (
            <MatrixClientContext.Provider value={client}>{children}</MatrixClientContext.Provider>
        );

        const { result } = renderHook(() => useUnreadThreadRooms(true), { wrapper });
        const { greatestNotificationLevel, rooms, otherThreads } = result.current;

        expect(otherThreads.length).toEqual(0);
        expect(greatestNotificationLevel).toBe(NotificationLevel.None);
        expect(rooms.length).toEqual(0);
    });

    it("an Other-threads activity-only thread is displayed when settingTACOnlyNotifs is off", async () => {
        jest.spyOn(SettingsStore, "getValue").mockReturnValue(false);

        const notifThreadInfo = await populateThread({
            room: room,
            client: client,
            authorId: "@foo:bar",
            participantUserIds: ["@fee:bar"],
        });
        room.setThreadUnreadNotificationCount(notifThreadInfo.thread.id, NotificationCountType.Total, 0);

        client.getVisibleRooms = jest.fn().mockReturnValue([room]);

        const wrapper = ({ children }: { children: React.ReactNode }) => (
            <MatrixClientContext.Provider value={client}>{children}</MatrixClientContext.Provider>
        );

        const { result } = renderHook(() => useUnreadThreadRooms(true), { wrapper });
        const { greatestNotificationLevel, rooms, otherThreads } = result.current;

        expect(otherThreads.length).toEqual(1);
        expect(greatestNotificationLevel).toBe(NotificationLevel.Activity);
        expect(rooms.length).toEqual(1);
    });

    it("a participated activity-only thread stays in My threads even when settingTACOnlyNotifs is on", async () => {
        // Setting on → "Other threads" loses activity entries, but "My threads" must keep them.
        jest.spyOn(SettingsStore, "getValue").mockReturnValue(true);

        const threadInfo = await populateThread({
            room: room,
            client: client,
            authorId: "@foo:bar",
            participantUserIds: ["@fee:bar"],
        });
        room.setThreadUnreadNotificationCount(threadInfo.thread.id, NotificationCountType.Total, 0);

        // Server flag: the current user participated in this thread.
        jest.spyOn(threadInfo.thread, "hasCurrentUserParticipated", "get").mockReturnValue(true);

        client.getVisibleRooms = jest.fn().mockReturnValue([room]);

        const wrapper = ({ children }: { children: React.ReactNode }) => (
            <MatrixClientContext.Provider value={client}>{children}</MatrixClientContext.Provider>
        );

        const { result } = renderHook(() => useUnreadThreadRooms(true), { wrapper });
        const { greatestNotificationLevel, rooms, participatingThreads, otherThreads } = result.current;

        expect(participatingThreads.length).toEqual(1);
        expect(otherThreads.length).toEqual(0);
        expect(greatestNotificationLevel).toBe(NotificationLevel.Activity);
        expect(rooms.length).toEqual(1);
    });

    it("the setting only filters Other threads, not My threads", async () => {
        // Setting on → only Other-threads activity is dropped, My threads keeps both.
        jest.spyOn(SettingsStore, "getValue").mockReturnValue(true);

        // Participated activity-only thread (should stay in My threads).
        const mineInfo = await populateThread({
            room: room,
            client: client,
            authorId: "@foo:bar",
            participantUserIds: ["@fee:bar"],
        });
        room.setThreadUnreadNotificationCount(mineInfo.thread.id, NotificationCountType.Total, 0);
        jest.spyOn(mineInfo.thread, "hasCurrentUserParticipated", "get").mockReturnValue(true);

        // Non-participated activity-only thread (should be dropped from Other threads).
        const otherInfo = await populateThread({
            room: room,
            client: client,
            authorId: "@foo:bar",
            participantUserIds: ["@fee:bar"],
        });
        room.setThreadUnreadNotificationCount(otherInfo.thread.id, NotificationCountType.Total, 0);
        jest.spyOn(otherInfo.thread, "hasCurrentUserParticipated", "get").mockReturnValue(false);

        client.getVisibleRooms = jest.fn().mockReturnValue([room]);

        const wrapper = ({ children }: { children: React.ReactNode }) => (
            <MatrixClientContext.Provider value={client}>{children}</MatrixClientContext.Provider>
        );

        const { result } = renderHook(() => useUnreadThreadRooms(true), { wrapper });
        const { participatingThreads, otherThreads } = result.current;

        expect(participatingThreads.length).toEqual(1);
        expect(otherThreads.length).toEqual(0);
    });

    it("a participated thread in a muted room still appears in My threads", async () => {
        // Bug fix: the previous doesRoomHaveUnreadThreads() pre-filter short-circuited
        // muted rooms, hiding participated threads that should always be relevant.
        muteRoom(room);

        const threadInfo = await populateThread({
            room: room,
            client: client,
            authorId: "@foo:bar",
            participantUserIds: ["@fee:bar"],
        });
        room.setThreadUnreadNotificationCount(threadInfo.thread.id, NotificationCountType.Total, 1);
        jest.spyOn(threadInfo.thread, "hasCurrentUserParticipated", "get").mockReturnValue(true);

        client.getVisibleRooms = jest.fn().mockReturnValue([room]);

        const wrapper = ({ children }: { children: React.ReactNode }) => (
            <MatrixClientContext.Provider value={client}>{children}</MatrixClientContext.Provider>
        );

        const { result } = renderHook(() => useUnreadThreadRooms(true), { wrapper });
        const { participatingThreads, otherThreads } = result.current;

        expect(participatingThreads.length).toEqual(1);
        expect(otherThreads.length).toEqual(0);
    });

    it("a non-participated thread in a muted room does not appear in Other threads", async () => {
        // Mute should still hide background noise in Other threads (preserves the
        // existing rationale for the room-level mute check).
        muteRoom(room);

        const threadInfo = await populateThread({
            room: room,
            client: client,
            authorId: "@foo:bar",
            participantUserIds: ["@fee:bar"],
        });
        // Server count > 0 to make sure setting-based filter wouldn't drop it on its own.
        room.setThreadUnreadNotificationCount(threadInfo.thread.id, NotificationCountType.Total, 1);
        jest.spyOn(threadInfo.thread, "hasCurrentUserParticipated", "get").mockReturnValue(false);

        client.getVisibleRooms = jest.fn().mockReturnValue([room]);

        const wrapper = ({ children }: { children: React.ReactNode }) => (
            <MatrixClientContext.Provider value={client}>{children}</MatrixClientContext.Provider>
        );

        const { result } = renderHook(() => useUnreadThreadRooms(true), { wrapper });
        const { participatingThreads, otherThreads } = result.current;

        expect(participatingThreads.length).toEqual(0);
        expect(otherThreads.length).toEqual(0);
    });

    it("a server-highlight thread surfaces in My threads even without local timeline activity", async () => {
        // Bug fix: the previous doesRoomHaveUnreadThreads() pre-filter required the
        // local timeline to detect unread. A server-pushed highlight (mention/keyword)
        // on a thread with no locally-visible unread events was missed.
        const threadInfo = await populateThread({
            room: room,
            client: client,
            authorId: "@foo:bar",
            participantUserIds: ["@fee:bar"],
        });
        // Server-pushed highlight; user did not participate yet.
        room.setThreadUnreadNotificationCount(threadInfo.thread.id, NotificationCountType.Highlight, 1);
        jest.spyOn(threadInfo.thread, "hasCurrentUserParticipated", "get").mockReturnValue(false);

        client.getVisibleRooms = jest.fn().mockReturnValue([room]);

        const wrapper = ({ children }: { children: React.ReactNode }) => (
            <MatrixClientContext.Provider value={client}>{children}</MatrixClientContext.Provider>
        );

        const { result } = renderHook(() => useUnreadThreadRooms(true), { wrapper });
        const { participatingThreads, otherThreads, greatestNotificationLevel } = result.current;

        // Highlight makes the thread relevant to the user → My threads, not Other.
        expect(participatingThreads.length).toEqual(1);
        expect(participatingThreads[0].notificationLevel).toEqual(NotificationLevel.Highlight);
        expect(otherThreads.length).toEqual(0);
        expect(greatestNotificationLevel).toEqual(NotificationLevel.Highlight);
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

        client.getVisibleRooms = jest.fn().mockReturnValue([room]);

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
            jest.useFakeTimers();
        });

        afterEach(() => {
            jest.useRealTimers();
        });

        it("updates on decryption within 1s", async () => {
            // Setting on so the activity-only initial state is suppressed; we want to verify
            // the hook recomputes when decryption raises the level to Highlight.
            jest.spyOn(SettingsStore, "getValue").mockReturnValue(true);

            const notifThreadInfo = await populateThread({
                room: room,
                client: client,
                authorId: "@foo:bar",
                participantUserIds: ["@fee:bar"],
            });
            room.setThreadUnreadNotificationCount(notifThreadInfo.thread.id, NotificationCountType.Total, 0);

            client.getVisibleRooms = jest.fn().mockReturnValue([room]);

            const wrapper = ({ children }: { children: React.ReactNode }) => (
                <MatrixClientContext.Provider value={client}>{children}</MatrixClientContext.Provider>
            );

            const { result } = renderHook(() => useUnreadThreadRooms(true), { wrapper });

            expect(result.current.greatestNotificationLevel).toBe(NotificationLevel.None);

            act(() => {
                room.setThreadUnreadNotificationCount(notifThreadInfo.thread.id, NotificationCountType.Highlight, 1);
                client.emit(MatrixEventEvent.Decrypted, notifThreadInfo.thread.events[0]);

                jest.advanceTimersByTime(1000);
            });

            expect(result.current.greatestNotificationLevel).toBe(NotificationLevel.Highlight);
        });
    });
});

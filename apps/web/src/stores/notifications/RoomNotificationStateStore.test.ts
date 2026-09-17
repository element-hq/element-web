/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { ClientEvent, type MatrixClient, Room, RoomEvent, SyncState } from "matrix-js-sdk/src/matrix";
import { KnownMembership } from "matrix-js-sdk/src/types";
import { createTestClient, setupAsyncStoreWithClient } from "test-utils";

import { RoomNotificationStateStore, UPDATE_STATUS_INDICATOR } from "./RoomNotificationStateStore";
import { NotificationLevel } from "./NotificationLevel";
import { DefaultTagID } from "../room-list-v3/skip-list/tag";
import * as RoomNotifs from "../../RoomNotifs";
import SettingsStore from "../../settings/SettingsStore";
import { MatrixDispatcher } from "../../dispatcher/dispatcher";

describe("RoomNotificationStateStore", function () {
    let store: RoomNotificationStateStore;
    let client: MatrixClient;
    let dis: MatrixDispatcher;

    beforeEach(() => {
        client = createTestClient();
        dis = new MatrixDispatcher();
        store = RoomNotificationStateStore.testInstance(dis);
        store.emit = vi.fn();
        setupAsyncStoreWithClient(store, client);
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    it("Emits no event when a room has no unreads", async () => {
        // Given a room with 0 unread messages
        const room = fakeRoom(0);

        // When we sync and the room is visible
        vi.mocked(client.getVisibleRooms).mockReturnValue([room]);
        client.emit(ClientEvent.Sync, SyncState.Syncing, SyncState.Syncing);

        // Then we emit an event from the store
        expect(store.emit).not.toHaveBeenCalled();
    });

    it("Emits an event when a room has unreads", async () => {
        // Given a room with 2 unread messages
        const room = fakeRoom(2);

        // When we sync and the room is visible
        vi.mocked(client.getVisibleRooms).mockReturnValue([room]);
        client.emit(ClientEvent.Sync, SyncState.Syncing, SyncState.Syncing);

        // Then we emit an event from the store
        expect(store.emit).toHaveBeenCalledWith(UPDATE_STATUS_INDICATOR, expect.anything(), "SYNCING");
    });

    it("Emits an event when a room state updates without a sync", async () => {
        vi.useFakeTimers();
        try {
            // Given a synced, fully read room
            const room = fakeRoom(0);
            vi.mocked(client.getVisibleRooms).mockReturnValue([room]);
            client.emit(ClientEvent.Sync, SyncState.Syncing, SyncState.Syncing);
            expect(store.emit).not.toHaveBeenCalled();

            // When the room turns unread without any sync completing
            vi.mocked(room.getUnreadNotificationCount).mockReturnValue(2);
            vi.mocked(room.getRoomUnreadNotificationCount).mockReturnValue(2);
            room.emit(RoomEvent.UnreadNotifications, {});
            vi.advanceTimersByTime(100);

            // Then the summary catches up without waiting for the next sync response
            expect(store.emit).toHaveBeenCalledWith(UPDATE_STATUS_INDICATOR, expect.anything(), "SYNCING");
        } finally {
            vi.useRealTimers();
        }
    });

    it("Reports the client as still offline when a room state updates during an outage", async () => {
        vi.useFakeTimers();
        try {
            // Given a synced, fully read room and a client which has since lost its connection
            const room = fakeRoom(0);
            vi.mocked(client.getVisibleRooms).mockReturnValue([room]);
            client.emit(ClientEvent.Sync, SyncState.Syncing, SyncState.Syncing);
            vi.mocked(client.getSyncState).mockReturnValue(SyncState.Error);

            // When the room turns unread while the connection is still down
            vi.mocked(room.getUnreadNotificationCount).mockReturnValue(2);
            vi.mocked(room.getRoomUnreadNotificationCount).mockReturnValue(2);
            room.emit(RoomEvent.UnreadNotifications, {});
            vi.advanceTimersByTime(100);

            // Then the update carries the real sync state, so nothing tells the app it is back online
            expect(store.emit).toHaveBeenCalledWith(UPDATE_STATUS_INDICATOR, expect.anything(), "ERROR");
        } finally {
            vi.useRealTimers();
        }
    });

    describe("low priority rooms", () => {
        afterEach(() => {
            vi.restoreAllMocks();
        });

        it("Leaves a low priority room out of the global state while it only has activity", async () => {
            // Given a joined low priority room whose only news is activity
            const room = fakeRoom(0);
            room.tags = { [DefaultTagID.LowPriority]: {} };
            room.getMyMembership = vi.fn().mockReturnValue(KnownMembership.Join);
            vi.spyOn(RoomNotifs, "determineUnreadState").mockReturnValue({
                level: NotificationLevel.Activity,
                symbol: null,
                count: 0,
                invited: false,
            });

            // When we sync and the room is visible
            vi.mocked(client.getVisibleRooms).mockReturnValue([room]);
            client.emit(ClientEvent.Sync, SyncState.Syncing, SyncState.Syncing);

            // Then the summary stays quiet, matching what the space badges show
            expect(store.emit).not.toHaveBeenCalled();
        });

        it("Counts a low priority room once it actually notifies", async () => {
            // Given a joined low priority room with 2 notifying messages
            const room = fakeRoom(2);
            room.tags = { [DefaultTagID.LowPriority]: {} };
            room.getMyMembership = vi.fn().mockReturnValue(KnownMembership.Join);

            // When we sync and the room is visible
            vi.mocked(client.getVisibleRooms).mockReturnValue([room]);
            client.emit(ClientEvent.Sync, SyncState.Syncing, SyncState.Syncing);

            // Then the summary still reports it
            expect(store.emit).toHaveBeenCalledWith(UPDATE_STATUS_INDICATOR, expect.anything(), "SYNCING");
        });

        it("Keeps activity from a room that is not low priority", async () => {
            // Given a joined, untagged room whose only news is activity
            const room = fakeRoom(0);
            room.getMyMembership = vi.fn().mockReturnValue(KnownMembership.Join);
            vi.spyOn(RoomNotifs, "determineUnreadState").mockReturnValue({
                level: NotificationLevel.Activity,
                symbol: null,
                count: 0,
                invited: false,
            });

            // When we sync and the room is visible
            vi.mocked(client.getVisibleRooms).mockReturnValue([room]);
            client.emit(ClientEvent.Sync, SyncState.Syncing, SyncState.Syncing);

            // Then the summary reports the activity as before
            expect(store.emit).toHaveBeenCalledWith(UPDATE_STATUS_INDICATOR, expect.anything(), "SYNCING");
        });
    });

    it("Emits an event when a feature flag changes notification state", async () => {
        // Given we have synced already
        let room = fakeRoom(0);
        vi.mocked(store.emit).mockReset();
        vi.mocked(client.getVisibleRooms).mockReturnValue([room]);
        client.emit(ClientEvent.Sync, SyncState.Syncing, SyncState.Syncing);
        expect(store.emit).not.toHaveBeenCalled();

        // When we update the feature flag and it makes us have a notification
        room = fakeRoom(2);
        vi.mocked(client.getVisibleRooms).mockReturnValue([room]);
        vi.spyOn(SettingsStore, "getValue").mockReturnValue(true);
        store.emitUpdateIfStateChanged(SyncState.Syncing, false);

        // Then we get notified
        expect(store.emit).toHaveBeenCalledWith(UPDATE_STATUS_INDICATOR, expect.anything(), "SYNCING");
    });

    describe("If the feature_dynamic_room_predecessors is not enabled", () => {
        beforeEach(() => {
            // Turn off feature_dynamic_room_predecessors setting
            vi.spyOn(SettingsStore, "getValue").mockReturnValue(false);
        });

        it("Passes the dynamic predecessor flag to getVisibleRooms", async () => {
            // When we sync
            vi.mocked(client.getVisibleRooms).mockReturnValue([]);
            client.emit(ClientEvent.Sync, SyncState.Syncing, SyncState.Syncing);

            // Then we check visible rooms, using the dynamic predecessor flag
            expect(client.getVisibleRooms).toHaveBeenCalledWith(false);
            expect(client.getVisibleRooms).not.toHaveBeenCalledWith(true);
        });
    });

    describe("If the feature_dynamic_room_predecessors is enabled", () => {
        beforeEach(() => {
            // Turn on feature_dynamic_room_predecessors setting
            vi.spyOn(SettingsStore, "getValue").mockImplementation(
                (settingName) => settingName === "feature_dynamic_room_predecessors",
            );
        });

        it("Passes the dynamic predecessor flag to getVisibleRooms", async () => {
            // When we sync
            vi.mocked(client.getVisibleRooms).mockReturnValue([]);
            client.emit(ClientEvent.Sync, SyncState.Syncing, SyncState.Syncing);

            // Then we check visible rooms, using the dynamic predecessor flag
            expect(client.getVisibleRooms).toHaveBeenCalledWith(true);
            expect(client.getVisibleRooms).not.toHaveBeenCalledWith(false);
        });
    });

    let roomIdx = 0;

    function fakeRoom(numUnreads: number): Room {
        roomIdx++;
        const ret = new Room(`room${roomIdx}`, client, "@user:example.com");
        ret.getPendingEvents = vi.fn().mockReturnValue([]);
        ret.isSpaceRoom = vi.fn().mockReturnValue(false);
        ret.getUnreadNotificationCount = vi.fn().mockReturnValue(numUnreads);
        ret.getRoomUnreadNotificationCount = vi.fn().mockReturnValue(numUnreads);
        return ret;
    }
});

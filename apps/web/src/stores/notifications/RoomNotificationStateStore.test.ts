/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { vi, describe, it, expect, beforeEach } from "vitest";
import { ClientEvent, type MatrixClient, Room, SyncState } from "matrix-js-sdk/src/matrix";
import { createTestClient, setupAsyncStoreWithClient } from "test-utils";

import { RoomNotificationStateStore, UPDATE_STATUS_INDICATOR } from "./RoomNotificationStateStore";
import SettingsStore from "../../settings/SettingsStore";
import { MatrixDispatcher } from "../../dispatcher/dispatcher";

describe("RoomNotificationStateStore", function () {
    let store: RoomNotificationStateStore;
    let client: MatrixClient;
    let dis: MatrixDispatcher;

    beforeEach(() => {
        client = createTestClient();
        dis = new MatrixDispatcher();
        vi.resetAllMocks();
        store = RoomNotificationStateStore.testInstance(dis);
        store.emit = vi.fn();
        setupAsyncStoreWithClient(store, client);
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

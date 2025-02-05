/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { mocked } from "jest-mock";
import { ClientEvent, type MatrixClient, Room, SyncState } from "matrix-js-sdk/src/matrix";

import { createTestClient, setupAsyncStoreWithClient } from "../../test-utils";
import {
    RoomNotificationStateStore,
    UPDATE_STATUS_INDICATOR,
} from "../../../src/stores/notifications/RoomNotificationStateStore";
import SettingsStore from "../../../src/settings/SettingsStore";
import { MatrixDispatcher } from "../../../src/dispatcher/dispatcher";

describe("RoomNotificationStateStore", function () {
    let store: RoomNotificationStateStore;
    let client: MatrixClient;
    let dis: MatrixDispatcher;

    beforeEach(() => {
        client = createTestClient();
        dis = new MatrixDispatcher();
        jest.resetAllMocks();
        store = RoomNotificationStateStore.testInstance(dis);
        store.emit = jest.fn();
        setupAsyncStoreWithClient(store, client);
    });

    it("Emits no event when a room has no unreads", async () => {
        // Given a room with 0 unread messages
        const room = fakeRoom(0);

        // When we sync and the room is visible
        mocked(client.getVisibleRooms).mockReturnValue([room]);
        client.emit(ClientEvent.Sync, SyncState.Syncing, SyncState.Syncing);

        // Then we emit an event from the store
        expect(store.emit).not.toHaveBeenCalled();
    });

    it("Emits an event when a room has unreads", async () => {
        // Given a room with 2 unread messages
        const room = fakeRoom(2);

        // When we sync and the room is visible
        mocked(client.getVisibleRooms).mockReturnValue([room]);
        client.emit(ClientEvent.Sync, SyncState.Syncing, SyncState.Syncing);

        // Then we emit an event from the store
        expect(store.emit).toHaveBeenCalledWith(UPDATE_STATUS_INDICATOR, expect.anything(), "SYNCING");
    });

    it("Emits an event when a feature flag changes notification state", async () => {
        // Given we have synced already
        let room = fakeRoom(0);
        mocked(store.emit).mockReset();
        mocked(client.getVisibleRooms).mockReturnValue([room]);
        client.emit(ClientEvent.Sync, SyncState.Syncing, SyncState.Syncing);
        expect(store.emit).not.toHaveBeenCalled();

        // When we update the feature flag and it makes us have a notification
        room = fakeRoom(2);
        mocked(client.getVisibleRooms).mockReturnValue([room]);
        jest.spyOn(SettingsStore, "getValue").mockReturnValue(true);
        store.emitUpdateIfStateChanged(SyncState.Syncing, false);

        // Then we get notified
        expect(store.emit).toHaveBeenCalledWith(UPDATE_STATUS_INDICATOR, expect.anything(), "SYNCING");
    });

    describe("If the feature_dynamic_room_predecessors is not enabled", () => {
        beforeEach(() => {
            // Turn off feature_dynamic_room_predecessors setting
            jest.spyOn(SettingsStore, "getValue").mockReturnValue(false);
        });

        it("Passes the dynamic predecessor flag to getVisibleRooms", async () => {
            // When we sync
            mocked(client.getVisibleRooms).mockReturnValue([]);
            client.emit(ClientEvent.Sync, SyncState.Syncing, SyncState.Syncing);

            // Then we check visible rooms, using the dynamic predecessor flag
            expect(client.getVisibleRooms).toHaveBeenCalledWith(false);
            expect(client.getVisibleRooms).not.toHaveBeenCalledWith(true);
        });
    });

    describe("If the feature_dynamic_room_predecessors is enabled", () => {
        beforeEach(() => {
            // Turn on feature_dynamic_room_predecessors setting
            jest.spyOn(SettingsStore, "getValue").mockImplementation(
                (settingName) => settingName === "feature_dynamic_room_predecessors",
            );
        });

        it("Passes the dynamic predecessor flag to getVisibleRooms", async () => {
            // When we sync
            mocked(client.getVisibleRooms).mockReturnValue([]);
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
        ret.getPendingEvents = jest.fn().mockReturnValue([]);
        ret.isSpaceRoom = jest.fn().mockReturnValue(false);
        ret.getUnreadNotificationCount = jest.fn().mockReturnValue(numUnreads);
        ret.getRoomUnreadNotificationCount = jest.fn().mockReturnValue(numUnreads);
        return ret;
    }
});

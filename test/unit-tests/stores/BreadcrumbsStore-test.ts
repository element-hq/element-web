/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { mocked } from "jest-mock";
import { type MatrixClient, Room } from "matrix-js-sdk/src/matrix";

import { createTestClient, flushPromises, setupAsyncStoreWithClient } from "../../test-utils";
import SettingsStore from "../../../src/settings/SettingsStore";
import { BreadcrumbsStore } from "../../../src/stores/BreadcrumbsStore";
import { Action } from "../../../src/dispatcher/actions";
import defaultDispatcher from "../../../src/dispatcher/dispatcher";

describe("BreadcrumbsStore", () => {
    let store: BreadcrumbsStore;
    const client: MatrixClient = createTestClient();

    beforeEach(() => {
        jest.resetAllMocks();
        store = BreadcrumbsStore.instance;
        setupAsyncStoreWithClient(store, client);
        jest.spyOn(SettingsStore, "setValue").mockImplementation(() => Promise.resolve());
        jest.spyOn(SettingsStore, "getValue").mockReturnValue(false);
    });

    it("does not meet room requirements if there are not enough rooms", () => {
        // We don't have enough rooms, so we don't meet requirements
        mocked(client.getVisibleRooms).mockReturnValue(fakeRooms(2));
        expect(store.meetsRoomRequirement).toBe(false);
    });

    it("meets room requirements if there are enough rooms", () => {
        // We do have enough rooms to show breadcrumbs
        mocked(client.getVisibleRooms).mockReturnValue(fakeRooms(25));
        expect(store.meetsRoomRequirement).toBe(true);
    });

    describe("And the feature_dynamic_room_predecessors is enabled", () => {
        beforeEach(() => {
            // Turn on feature_dynamic_room_predecessors setting
            jest.spyOn(SettingsStore, "getValue").mockImplementation(
                (settingName) => settingName === "feature_dynamic_room_predecessors",
            );
        });

        it("passes through the dynamic room precessors flag", () => {
            mocked(client.getVisibleRooms).mockReturnValue(fakeRooms(25));
            expect(store.meetsRoomRequirement).toBeTruthy();
            expect(client.getVisibleRooms).toHaveBeenCalledWith(true);
        });
    });

    describe("And the feature_dynamic_room_predecessors is not enabled", () => {
        it("passes through the dynamic room precessors flag", () => {
            mocked(client.getVisibleRooms).mockReturnValue(fakeRooms(25));
            expect(store.meetsRoomRequirement).toBeTruthy();
            expect(client.getVisibleRooms).toHaveBeenCalledWith(false);
        });
    });

    describe("If the feature_dynamic_room_predecessors is not enabled", () => {
        beforeEach(() => {
            jest.spyOn(SettingsStore, "getValue").mockReturnValue(false);
        });

        it("Appends a room when you join", async () => {
            // Sanity: no rooms initially
            expect(store.rooms).toEqual([]);

            // Given a room
            const room = fakeRoom();
            mocked(client.getRoom).mockReturnValue(room);
            mocked(client.getRoomUpgradeHistory).mockReturnValue([]);

            // When we hear that we have joined it
            await dispatchJoinRoom(room.roomId);

            // It is stored in the store's room list
            expect(store.rooms.map((r) => r.roomId)).toEqual([room.roomId]);
        });

        it("Replaces the old room when a newer one joins", async () => {
            // Given an old room and a new room
            const oldRoom = fakeRoom();
            const newRoom = fakeRoom();
            mocked(client.getRoom).mockImplementation((roomId) => {
                if (roomId === oldRoom.roomId) return oldRoom;
                return newRoom;
            });
            // Where the new one is a predecessor of the old one
            mocked(client.getRoomUpgradeHistory).mockReturnValue([oldRoom, newRoom]);

            // When we hear that we joined the old room, then the new one
            await dispatchJoinRoom(oldRoom.roomId);
            await dispatchJoinRoom(newRoom.roomId);

            // The store only has the new one
            expect(store.rooms.map((r) => r.roomId)).toEqual([newRoom.roomId]);
        });

        it("Passes through the dynamic predecessor setting", async () => {
            // Given a room
            const room = fakeRoom();
            mocked(client.getRoom).mockReturnValue(room);
            mocked(client.getRoomUpgradeHistory).mockReturnValue([]);

            // When we signal that we have joined
            await dispatchJoinRoom(room.roomId);

            // We pass the value of the dynamic predecessor setting through
            expect(client.getRoomUpgradeHistory).toHaveBeenCalledWith(room.roomId, false, false);
        });
    });

    describe("If the feature_dynamic_room_predecessors is enabled", () => {
        beforeEach(() => {
            // Turn on feature_dynamic_room_predecessors setting
            jest.spyOn(SettingsStore, "getValue").mockImplementation(
                (settingName) => settingName === "feature_dynamic_room_predecessors",
            );
        });

        it("Passes through the dynamic predecessor setting", async () => {
            // Given a room
            const room = fakeRoom();
            mocked(client.getRoom).mockReturnValue(room);
            mocked(client.getRoomUpgradeHistory).mockReturnValue([]);

            // When we signal that we have joined
            await dispatchJoinRoom(room.roomId);

            // We pass the value of the dynamic predecessor setting through
            expect(client.getRoomUpgradeHistory).toHaveBeenCalledWith(room.roomId, false, true);
        });
    });

    /**
     * Send a JoinRoom event via the dispatcher, and wait for it to process.
     */
    async function dispatchJoinRoom(roomId: string) {
        defaultDispatcher.dispatch(
            {
                action: Action.JoinRoom,
                roomId,
                metricsTrigger: null,
            },
            true, // synchronous dispatch
        );

        // Wait for event dispatch to happen
        await flushPromises();
    }

    /**
     * Create as many fake rooms in an array as you ask for.
     */
    function fakeRooms(howMany: number): Room[] {
        const ret: Room[] = [];
        for (let i = 0; i < howMany; i++) {
            ret.push(fakeRoom());
        }
        return ret;
    }

    let roomIdx = 0;

    function fakeRoom(): Room {
        roomIdx++;
        return new Room(`room${roomIdx}`, client, "@user:example.com");
    }
});

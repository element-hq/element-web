/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { type MatrixClient, type Room } from "matrix-js-sdk/src/matrix";
import { mocked } from "jest-mock";

import { createTestClient, flushPromises, mkStubRoom, stubClient } from "../../test-utils";
import RoomListStoreV3, { RoomListStoreV3Event } from "../../../src/stores/room-list-v3/RoomListStoreV3";
import SpaceStore from "../../../src/stores/spaces/SpaceStore";
import { FilterKey } from "../../../src/stores/room-list-v3/skip-list/filters";
import dispatcher from "../../../src/dispatcher/dispatcher";
import { Action } from "../../../src/dispatcher/actions";
import { SdkContextClass } from "../../../src/contexts/SDKContext";
import DMRoomMap from "../../../src/utils/DMRoomMap";
import { RoomListViewViewModel } from "../../../src/viewmodels/room-list/RoomListViewViewModel";
import { hasCreateRoomRights } from "../../../src/viewmodels/room-list/utils";

jest.mock("../../../src/viewmodels/room-list/utils", () => ({
    hasCreateRoomRights: jest.fn().mockReturnValue(false),
    hasAccessToOptionsMenu: jest.fn().mockReturnValue(true),
    hasAccessToNotificationMenu: jest.fn().mockReturnValue(true),
}));

describe("RoomListViewViewModel", () => {
    let matrixClient: MatrixClient;
    let room1: Room;
    let room2: Room;
    let room3: Room;
    let viewModel: RoomListViewViewModel;

    beforeEach(() => {
        matrixClient = createTestClient();
        room1 = mkStubRoom("!room1:server", "Room 1", matrixClient);
        room2 = mkStubRoom("!room2:server", "Room 2", matrixClient);
        room3 = mkStubRoom("!room3:server", "Room 3", matrixClient);

        // Setup DMRoomMap
        const dmRoomMap = {
            getUserIdForRoomId: jest.fn().mockReturnValue(null),
        } as unknown as DMRoomMap;
        DMRoomMap.setShared(dmRoomMap);

        jest.spyOn(RoomListStoreV3.instance, "getSortedRoomsInActiveSpace").mockReturnValue({
            spaceId: "home",
            rooms: [room1, room2, room3],
        });

        jest.spyOn(RoomListStoreV3.instance, "isLoadingRooms", "get").mockReturnValue(false);
        jest.spyOn(SpaceStore.instance, "activeSpaceRoom", "get").mockReturnValue(null);
        jest.spyOn(SdkContextClass.instance.roomViewStore, "getRoomId").mockReturnValue(null);

        mocked(hasCreateRoomRights).mockReturnValue(false);
    });

    afterEach(() => {
        viewModel?.dispose();
        jest.restoreAllMocks();
    });

    describe("Initialization", () => {
        it("should initialize with correct snapshot", () => {
            viewModel = new RoomListViewViewModel({ client: matrixClient });

            const snapshot = viewModel.getSnapshot();
            expect(snapshot.roomIds).toEqual(["!room1:server", "!room2:server", "!room3:server"]);
            expect(snapshot.isRoomListEmpty).toBe(false);
            expect(snapshot.isLoadingRooms).toBe(false);
            expect(snapshot.roomListState.spaceId).toBe("home");
            expect(snapshot.filterIds.length).toBeGreaterThan(0);
            expect(snapshot.activeFilterId).toBeUndefined();
        });

        it("should initialize with empty room list", () => {
            jest.spyOn(RoomListStoreV3.instance, "getSortedRoomsInActiveSpace").mockReturnValue({
                spaceId: "home",
                rooms: [],
            });

            viewModel = new RoomListViewViewModel({ client: matrixClient });

            expect(viewModel.getSnapshot().roomIds).toEqual([]);
            expect(viewModel.getSnapshot().isRoomListEmpty).toBe(true);
        });

        it("should set canCreateRoom based on user rights", () => {
            mocked(hasCreateRoomRights).mockReturnValue(true);
            viewModel = new RoomListViewViewModel({ client: matrixClient });

            expect(viewModel.getSnapshot().canCreateRoom).toBe(true);
        });
    });

    describe("Room list updates", () => {
        it("should update room list when ListsUpdate event fires", () => {
            viewModel = new RoomListViewViewModel({ client: matrixClient });

            const newRoom = mkStubRoom("!room4:server", "Room 4", matrixClient);
            jest.spyOn(RoomListStoreV3.instance, "getSortedRoomsInActiveSpace").mockReturnValue({
                spaceId: "home",
                rooms: [room1, room2, room3, newRoom],
            });

            RoomListStoreV3.instance.emit(RoomListStoreV3Event.ListsUpdate);

            expect(viewModel.getSnapshot().roomIds).toEqual([
                "!room1:server",
                "!room2:server",
                "!room3:server",
                "!room4:server",
            ]);
        });

        it("should update loading state when ListsLoaded event fires", () => {
            jest.spyOn(RoomListStoreV3.instance, "isLoadingRooms", "get").mockReturnValue(true);
            viewModel = new RoomListViewViewModel({ client: matrixClient });

            expect(viewModel.getSnapshot().isLoadingRooms).toBe(true);

            RoomListStoreV3.instance.emit(RoomListStoreV3Event.ListsLoaded);

            expect(viewModel.getSnapshot().isLoadingRooms).toBe(false);
        });
    });

    describe("Space switching", () => {
        it("should update room list when space changes", () => {
            viewModel = new RoomListViewViewModel({ client: matrixClient });

            const spaceRoomList = [room1, room2];

            jest.spyOn(RoomListStoreV3.instance, "getSortedRoomsInActiveSpace").mockReturnValue({
                spaceId: "!space:server",
                rooms: spaceRoomList,
            });

            jest.spyOn(SpaceStore.instance, "getLastSelectedRoomIdForSpace").mockReturnValue("!room1:server");

            RoomListStoreV3.instance.emit(RoomListStoreV3Event.ListsUpdate);

            expect(viewModel.getSnapshot().roomListState.spaceId).toBe("!space:server");
            expect(viewModel.getSnapshot().roomIds).toEqual(["!room1:server", "!room2:server"]);
        });

        it("should clear view models when space changes", () => {
            viewModel = new RoomListViewViewModel({ client: matrixClient });

            // Get view models for visible rooms
            const vm1 = viewModel.getRoomItemViewModel("!room1:server");
            const vm2 = viewModel.getRoomItemViewModel("!room2:server");

            const disposeSpy1 = jest.spyOn(vm1, "dispose");
            const disposeSpy2 = jest.spyOn(vm2, "dispose");

            // Change space
            jest.spyOn(RoomListStoreV3.instance, "getSortedRoomsInActiveSpace").mockReturnValue({
                spaceId: "!space:server",
                rooms: [room3],
            });

            RoomListStoreV3.instance.emit(RoomListStoreV3Event.ListsUpdate);

            expect(disposeSpy1).toHaveBeenCalled();
            expect(disposeSpy2).toHaveBeenCalled();
        });
    });

    describe("Active room tracking", () => {
        it("should update active room index when room is selected", async () => {
            viewModel = new RoomListViewViewModel({ client: matrixClient });

            jest.spyOn(SdkContextClass.instance.roomViewStore, "getRoomId").mockReturnValue("!room2:server");

            dispatcher.dispatch({
                action: Action.ActiveRoomChanged,
                oldRoomId: "!room1:server",
                newRoomId: "!room2:server",
            });

            // Use setTimeout to allow the dispatcher callback to run
            await flushPromises();
            expect(viewModel.getSnapshot().roomListState.activeRoomIndex).toBe(1);
        });

        it("should return undefined active room index when no room is selected", async () => {
            viewModel = new RoomListViewViewModel({ client: matrixClient });

            jest.spyOn(SdkContextClass.instance.roomViewStore, "getRoomId").mockReturnValue(null);

            dispatcher.dispatch({
                action: Action.ActiveRoomChanged,
                oldRoomId: "!room1:server",
                newRoomId: null,
            });

            // Use setTimeout to allow the dispatcher callback to run
            await flushPromises();
            expect(viewModel.getSnapshot().roomListState.activeRoomIndex).toBeUndefined();
        });
    });

    describe("Sticky room behavior", () => {
        it("should keep selected room at same index when room list updates", async () => {
            viewModel = new RoomListViewViewModel({ client: matrixClient });

            // Select room at index 1
            jest.spyOn(SdkContextClass.instance.roomViewStore, "getRoomId").mockReturnValue("!room2:server");
            dispatcher.dispatch({
                action: Action.ActiveRoomChanged,
                newRoomId: "!room2:server",
            });

            await flushPromises();
            expect(viewModel.getSnapshot().roomListState.activeRoomIndex).toBe(1);

            // Simulate room list update that would move room2 to front
            jest.spyOn(RoomListStoreV3.instance, "getSortedRoomsInActiveSpace").mockReturnValue({
                spaceId: "home",
                rooms: [room2, room1, room3], // room2 moved to front
            });

            RoomListStoreV3.instance.emit(RoomListStoreV3Event.ListsUpdate);

            // Active room should still be at index 1 (sticky behavior)
            expect(viewModel.getSnapshot().roomListState.activeRoomIndex).toBe(1);
            expect(viewModel.getSnapshot().roomIds[1]).toBe("!room2:server");
        });

        it("should not apply sticky behavior when user changes rooms", async () => {
            viewModel = new RoomListViewViewModel({ client: matrixClient });

            // Select room at index 1
            jest.spyOn(SdkContextClass.instance.roomViewStore, "getRoomId").mockReturnValue("!room2:server");
            dispatcher.dispatch({
                action: Action.ActiveRoomChanged,
                newRoomId: "!room2:server",
            });

            await flushPromises();

            // User switches to room3
            jest.spyOn(SdkContextClass.instance.roomViewStore, "getRoomId").mockReturnValue("!room3:server");
            dispatcher.dispatch({
                action: Action.ActiveRoomChanged,
                oldRoomId: "!room2:server",
                newRoomId: "!room3:server",
            });

            await flushPromises();
            expect(viewModel.getSnapshot().roomListState.activeRoomIndex).toBe(2);
        });
    });

    describe("Filters", () => {
        it("should toggle filter on", () => {
            viewModel = new RoomListViewViewModel({ client: matrixClient });

            expect(viewModel.getSnapshot().activeFilterId).toBeUndefined();

            jest.spyOn(RoomListStoreV3.instance, "getSortedRoomsInActiveSpace").mockReturnValue({
                spaceId: "home",
                rooms: [room1],
                filterKeys: [FilterKey.UnreadFilter],
            });

            viewModel.onToggleFilter("unread");

            expect(viewModel.getSnapshot().activeFilterId).toBe("unread");
            expect(viewModel.getSnapshot().roomIds).toEqual(["!room1:server"]);
        });

        it("should toggle filter off", () => {
            viewModel = new RoomListViewViewModel({ client: matrixClient });

            // Turn filter on
            jest.spyOn(RoomListStoreV3.instance, "getSortedRoomsInActiveSpace").mockReturnValue({
                spaceId: "home",
                rooms: [room1],
                filterKeys: [FilterKey.UnreadFilter],
            });
            viewModel.onToggleFilter("unread");

            expect(viewModel.getSnapshot().activeFilterId).toBe("unread");

            // Turn filter off
            jest.spyOn(RoomListStoreV3.instance, "getSortedRoomsInActiveSpace").mockReturnValue({
                spaceId: "home",
                rooms: [room1, room2, room3],
            });
            viewModel.onToggleFilter("unread");

            expect(viewModel.getSnapshot().activeFilterId).toBeUndefined();
            expect(viewModel.getSnapshot().roomIds).toEqual(["!room1:server", "!room2:server", "!room3:server"]);
        });

        it("should clear view models when filter changes", () => {
            viewModel = new RoomListViewViewModel({ client: matrixClient });

            // Get view models
            const vm1 = viewModel.getRoomItemViewModel("!room1:server");
            const disposeSpy = jest.spyOn(vm1, "dispose");

            jest.spyOn(RoomListStoreV3.instance, "getSortedRoomsInActiveSpace").mockReturnValue({
                spaceId: "home",
                rooms: [room2],
                filterKeys: [FilterKey.UnreadFilter],
            });

            viewModel.onToggleFilter("unread");

            expect(disposeSpy).toHaveBeenCalled();
        });
    });

    describe("Room item view models", () => {
        it("should create room item view model on demand", () => {
            viewModel = new RoomListViewViewModel({ client: matrixClient });

            const itemViewModel = viewModel.getRoomItemViewModel("!room1:server");

            expect(itemViewModel).toBeDefined();
            expect(itemViewModel.getSnapshot().room).toBe(room1);
        });

        it("should reuse existing room item view model", () => {
            viewModel = new RoomListViewViewModel({ client: matrixClient });

            const itemViewModel1 = viewModel.getRoomItemViewModel("!room1:server");
            const itemViewModel2 = viewModel.getRoomItemViewModel("!room1:server");

            expect(itemViewModel1).toBe(itemViewModel2);
        });

        it("should throw error when requesting view model for non-existent room", () => {
            viewModel = new RoomListViewViewModel({ client: matrixClient });

            expect(() => {
                viewModel.getRoomItemViewModel("!nonexistent:server");
            }).toThrow();
        });

        it("should dispose view models for rooms no longer visible", () => {
            viewModel = new RoomListViewViewModel({ client: matrixClient });

            const vm1 = viewModel.getRoomItemViewModel("!room1:server");
            const vm2 = viewModel.getRoomItemViewModel("!room2:server");
            const vm3 = viewModel.getRoomItemViewModel("!room3:server");

            const disposeSpy1 = jest.spyOn(vm1, "dispose");
            const disposeSpy3 = jest.spyOn(vm3, "dispose");

            // Update to show only middle room (index 1)
            viewModel.updateVisibleRooms(1, 2);

            expect(disposeSpy1).toHaveBeenCalled();
            expect(disposeSpy3).toHaveBeenCalled();

            // vm2 should still exist
            const vm2Again = viewModel.getRoomItemViewModel("!room2:server");
            expect(vm2Again).toBe(vm2);
        });
    });

    describe("Room creation", () => {
        it("should dispatch CreateChat action when createChatRoom is called", () => {
            viewModel = new RoomListViewViewModel({ client: matrixClient });

            const dispatchSpy = jest.spyOn(dispatcher, "fire");

            viewModel.createChatRoom();

            expect(dispatchSpy).toHaveBeenCalledWith(Action.CreateChat);
        });

        it("should dispatch CreateRoom action without parent space", () => {
            viewModel = new RoomListViewViewModel({ client: matrixClient });

            const dispatchSpy = jest.spyOn(dispatcher, "dispatch");

            viewModel.createRoom();

            expect(dispatchSpy).toHaveBeenCalledWith({
                action: Action.CreateRoom,
            });
        });

        it("should dispatch CreateRoom action with parent space", () => {
            const spaceRoom = mkStubRoom("!space:server", "Space", matrixClient);
            jest.spyOn(SpaceStore.instance, "activeSpaceRoom", "get").mockReturnValue(spaceRoom);

            viewModel = new RoomListViewViewModel({ client: matrixClient });

            const dispatchSpy = jest.spyOn(dispatcher, "dispatch");

            viewModel.createRoom();

            expect(dispatchSpy).toHaveBeenCalledWith({
                action: Action.CreateRoom,
                parent_space: spaceRoom,
            });
        });
    });

    describe("Keyboard navigation (ViewRoomDelta)", () => {
        beforeEach(() => {
            // stubClient sets up MatrixClientPeg which is needed when ViewRoom action is dispatched
            stubClient();
        });

        it("should navigate to next room when delta is 1", async () => {
            viewModel = new RoomListViewViewModel({ client: matrixClient });

            jest.spyOn(SdkContextClass.instance.roomViewStore, "getRoomId").mockReturnValue("!room1:server");

            const dispatchSpy = jest.spyOn(dispatcher, "dispatch");

            dispatcher.dispatch({
                action: Action.ViewRoomDelta,
                delta: 1,
                unread: false,
            });

            await flushPromises();

            expect(dispatchSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    action: Action.ViewRoom,
                    room_id: "!room2:server",
                }),
            );
        });

        it("should navigate to previous room when delta is -1", async () => {
            viewModel = new RoomListViewViewModel({ client: matrixClient });

            jest.spyOn(SdkContextClass.instance.roomViewStore, "getRoomId").mockReturnValue("!room2:server");

            const dispatchSpy = jest.spyOn(dispatcher, "dispatch");

            dispatcher.dispatch({
                action: Action.ViewRoomDelta,
                delta: -1,
                unread: false,
            });

            await flushPromises();

            expect(dispatchSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    action: Action.ViewRoom,
                    room_id: "!room1:server",
                }),
            );
        });

        it("should wrap around to last room when navigating backwards from first room", async () => {
            viewModel = new RoomListViewViewModel({ client: matrixClient });

            jest.spyOn(SdkContextClass.instance.roomViewStore, "getRoomId").mockReturnValue("!room1:server");

            const dispatchSpy = jest.spyOn(dispatcher, "dispatch");

            dispatcher.dispatch({
                action: Action.ViewRoomDelta,
                delta: -1,
                unread: false,
            });

            await flushPromises();

            expect(dispatchSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    action: Action.ViewRoom,
                    room_id: "!room3:server",
                }),
            );
        });

        it("should not navigate when current room is not found", async () => {
            viewModel = new RoomListViewViewModel({ client: matrixClient });

            jest.spyOn(SdkContextClass.instance.roomViewStore, "getRoomId").mockReturnValue("!unknown:server");

            const dispatchSpy = jest.spyOn(dispatcher, "dispatch");
            dispatchSpy.mockClear();

            dispatcher.dispatch({
                action: Action.ViewRoomDelta,
                delta: 1,
                unread: false,
            });

            await flushPromises();

            // Should not dispatch ViewRoom since current room wasn't found
            expect(dispatchSpy).not.toHaveBeenCalledWith(
                expect.objectContaining({
                    action: Action.ViewRoom,
                }),
            );
        });

        it("should not navigate when no room is selected", async () => {
            viewModel = new RoomListViewViewModel({ client: matrixClient });

            jest.spyOn(SdkContextClass.instance.roomViewStore, "getRoomId").mockReturnValue(null);

            const dispatchSpy = jest.spyOn(dispatcher, "dispatch");
            dispatchSpy.mockClear();

            dispatcher.dispatch({
                action: Action.ViewRoomDelta,
                delta: 1,
                unread: false,
            });

            await flushPromises();

            expect(dispatchSpy).not.toHaveBeenCalledWith(
                expect.objectContaining({
                    action: Action.ViewRoom,
                }),
            );
        });
    });

    describe("Cleanup", () => {
        it("should dispose all room item view models on dispose", () => {
            viewModel = new RoomListViewViewModel({ client: matrixClient });

            const vm1 = viewModel.getRoomItemViewModel("!room1:server");
            const vm2 = viewModel.getRoomItemViewModel("!room2:server");

            const disposeSpy1 = jest.spyOn(vm1, "dispose");
            const disposeSpy2 = jest.spyOn(vm2, "dispose");

            viewModel.dispose();

            expect(disposeSpy1).toHaveBeenCalled();
            expect(disposeSpy2).toHaveBeenCalled();
        });
    });
});

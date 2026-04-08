/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { type MatrixClient, type Room } from "matrix-js-sdk/src/matrix";
import { mocked } from "jest-mock";
import { waitFor } from "jest-matrix-react";

import { createTestClient, flushPromises, mkStubRoom, stubClient } from "../../test-utils";
import RoomListStoreV3, { CHATS_TAG, RoomListStoreV3Event } from "../../../src/stores/room-list-v3/RoomListStoreV3";
import SpaceStore from "../../../src/stores/spaces/SpaceStore";
import { FilterEnum } from "../../../src/stores/room-list-v3/skip-list/filters";
import dispatcher from "../../../src/dispatcher/dispatcher";
import { Action } from "../../../src/dispatcher/actions";
import { SdkContextClass } from "../../../src/contexts/SDKContext";
import DMRoomMap from "../../../src/utils/DMRoomMap";
import { RoomListViewModel } from "../../../src/viewmodels/room-list/RoomListViewModel";
import { hasCreateRoomRights } from "../../../src/viewmodels/room-list/utils";
import { DefaultTagID } from "../../../src/stores/room-list-v3/skip-list/tag";
import SettingsStore from "../../../src/settings/SettingsStore";

jest.mock("../../../src/viewmodels/room-list/utils", () => ({
    hasCreateRoomRights: jest.fn().mockReturnValue(false),
    hasAccessToOptionsMenu: jest.fn().mockReturnValue(true),
    hasAccessToNotificationMenu: jest.fn().mockReturnValue(true),
}));

describe("RoomListViewModel", () => {
    let matrixClient: MatrixClient;
    let room1: Room;
    let room2: Room;
    let room3: Room;
    let viewModel: RoomListViewModel;

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
            sections: [{ tag: CHATS_TAG, rooms: [room1, room2, room3] }],
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
            viewModel = new RoomListViewModel({ client: matrixClient });

            const snapshot = viewModel.getSnapshot();
            expect(snapshot.sections[0].roomIds).toEqual(["!room1:server", "!room2:server", "!room3:server"]);
            expect(snapshot.isRoomListEmpty).toBe(false);
            expect(snapshot.isLoadingRooms).toBe(false);
            expect(snapshot.roomListState.spaceId).toBe("home");
            expect(snapshot.filterIds.length).toBeGreaterThan(0);
            expect(snapshot.activeFilterId).toBeUndefined();
        });

        it("should initialize with empty room list", () => {
            jest.spyOn(RoomListStoreV3.instance, "getSortedRoomsInActiveSpace").mockReturnValue({
                spaceId: "home",
                sections: [{ tag: CHATS_TAG, rooms: [] }],
            });

            viewModel = new RoomListViewModel({ client: matrixClient });

            expect(viewModel.getSnapshot().sections).toEqual([]);
            expect(viewModel.getSnapshot().isRoomListEmpty).toBe(true);
        });

        it("should set canCreateRoom based on user rights", () => {
            mocked(hasCreateRoomRights).mockReturnValue(true);
            viewModel = new RoomListViewModel({ client: matrixClient });

            expect(viewModel.getSnapshot().canCreateRoom).toBe(true);
        });
    });

    describe("Room list updates", () => {
        it("should update room list when ListsUpdate event fires", () => {
            viewModel = new RoomListViewModel({ client: matrixClient });

            const newRoom = mkStubRoom("!room4:server", "Room 4", matrixClient);
            jest.spyOn(RoomListStoreV3.instance, "getSortedRoomsInActiveSpace").mockReturnValue({
                spaceId: "home",
                sections: [{ tag: CHATS_TAG, rooms: [room1, room2, room3, newRoom] }],
            });

            RoomListStoreV3.instance.emit(RoomListStoreV3Event.ListsUpdate);

            expect(viewModel.getSnapshot().sections[0].roomIds).toEqual([
                "!room1:server",
                "!room2:server",
                "!room3:server",
                "!room4:server",
            ]);
        });

        it("should update loading state when ListsLoaded event fires", () => {
            jest.spyOn(RoomListStoreV3.instance, "isLoadingRooms", "get").mockReturnValue(true);
            viewModel = new RoomListViewModel({ client: matrixClient });

            expect(viewModel.getSnapshot().isLoadingRooms).toBe(true);

            RoomListStoreV3.instance.emit(RoomListStoreV3Event.ListsLoaded);

            expect(viewModel.getSnapshot().isLoadingRooms).toBe(false);
        });

        // This test ensures that the room list item vms are preserved when the room list is changing
        it("should keep existing view model when ListsUpdate event fires", () => {
            viewModel = new RoomListViewModel({ client: matrixClient });

            // Create view model for room1
            const room1VM = viewModel.getRoomItemViewModel("!room1:server");
            expect(room1VM).toBeDefined();

            RoomListStoreV3.instance.emit(RoomListStoreV3Event.ListsUpdate);

            // View model should be still valid
            expect(room1VM!.isDisposed).toBe(false);
        });
    });

    describe("Space switching", () => {
        it("should update room list when space changes", () => {
            viewModel = new RoomListViewModel({ client: matrixClient });

            const spaceRoomList = [room1, room2];

            jest.spyOn(RoomListStoreV3.instance, "getSortedRoomsInActiveSpace").mockReturnValue({
                spaceId: "!space:server",
                sections: [{ tag: CHATS_TAG, rooms: spaceRoomList }],
            });

            jest.spyOn(SpaceStore.instance, "getLastSelectedRoomIdForSpace").mockReturnValue("!room1:server");

            RoomListStoreV3.instance.emit(RoomListStoreV3Event.ListsUpdate);

            expect(viewModel.getSnapshot().roomListState.spaceId).toBe("!space:server");
            expect(viewModel.getSnapshot().sections[0].roomIds).toEqual(["!room1:server", "!room2:server"]);
        });

        it("should clear view models when space changes", () => {
            viewModel = new RoomListViewModel({ client: matrixClient });

            // Get view models for visible rooms
            const vm1 = viewModel.getRoomItemViewModel("!room1:server")!;
            const vm2 = viewModel.getRoomItemViewModel("!room2:server")!;

            const disposeSpy1 = jest.spyOn(vm1, "dispose");
            const disposeSpy2 = jest.spyOn(vm2, "dispose");

            // Change space
            jest.spyOn(RoomListStoreV3.instance, "getSortedRoomsInActiveSpace").mockReturnValue({
                spaceId: "!space:server",
                sections: [{ tag: CHATS_TAG, rooms: [room3] }],
            });

            RoomListStoreV3.instance.emit(RoomListStoreV3Event.ListsUpdate);

            expect(disposeSpy1).toHaveBeenCalled();
            expect(disposeSpy2).toHaveBeenCalled();
        });

        it("should clear roomsMap when space changes and repopulate with new rooms", () => {
            viewModel = new RoomListViewModel({ client: matrixClient });

            const newSpaceRoom = mkStubRoom("!spaceroom:server", "Space Room", matrixClient);

            jest.spyOn(RoomListStoreV3.instance, "getSortedRoomsInActiveSpace").mockReturnValue({
                spaceId: "!space:server",
                sections: [{ tag: CHATS_TAG, rooms: [newSpaceRoom] }],
            });
            jest.spyOn(SpaceStore.instance, "getLastSelectedRoomIdForSpace").mockReturnValue(null);

            RoomListStoreV3.instance.emit(RoomListStoreV3Event.ListsUpdate);

            // New space room should be accessible
            expect(() => viewModel.getRoomItemViewModel("!spaceroom:server")).not.toThrow();
            // Old rooms from the home space should not be accessible
            expect(viewModel.getRoomItemViewModel("!room1:server")).toBeUndefined();
        });
    });

    describe("Active room tracking", () => {
        it("should update active room index when room is selected", async () => {
            viewModel = new RoomListViewModel({ client: matrixClient });

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
            viewModel = new RoomListViewModel({ client: matrixClient });

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
            viewModel = new RoomListViewModel({ client: matrixClient });

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
                sections: [{ tag: CHATS_TAG, rooms: [room2, room1, room3] }], // room2 moved to front
            });

            RoomListStoreV3.instance.emit(RoomListStoreV3Event.ListsUpdate);

            // Active room should still be at index 1 (sticky behavior)
            expect(viewModel.getSnapshot().roomListState.activeRoomIndex).toBe(1);
            expect(viewModel.getSnapshot().sections[0].roomIds[1]).toBe("!room2:server");
        });

        it("should not apply sticky behavior when user changes rooms", async () => {
            viewModel = new RoomListViewModel({ client: matrixClient });

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
            viewModel = new RoomListViewModel({ client: matrixClient });

            expect(viewModel.getSnapshot().activeFilterId).toBeUndefined();

            jest.spyOn(RoomListStoreV3.instance, "getSortedRoomsInActiveSpace").mockReturnValue({
                spaceId: "home",
                sections: [{ tag: CHATS_TAG, rooms: [room1] }],
                filterKeys: [FilterEnum.UnreadFilter],
            });

            viewModel.onToggleFilter("unread");

            expect(viewModel.getSnapshot().activeFilterId).toBe("unread");
            expect(viewModel.getSnapshot().sections[0].roomIds).toEqual(["!room1:server"]);
        });

        it("should toggle filter off", () => {
            viewModel = new RoomListViewModel({ client: matrixClient });

            // Turn filter on
            jest.spyOn(RoomListStoreV3.instance, "getSortedRoomsInActiveSpace").mockReturnValue({
                spaceId: "home",
                sections: [{ tag: CHATS_TAG, rooms: [room1] }],
                filterKeys: [FilterEnum.UnreadFilter],
            });
            viewModel.onToggleFilter("unread");

            expect(viewModel.getSnapshot().activeFilterId).toBe("unread");

            // Turn filter off
            jest.spyOn(RoomListStoreV3.instance, "getSortedRoomsInActiveSpace").mockReturnValue({
                spaceId: "home",
                sections: [{ tag: CHATS_TAG, rooms: [room1, room2, room3] }],
            });
            viewModel.onToggleFilter("unread");

            expect(viewModel.getSnapshot().activeFilterId).toBeUndefined();
            expect(viewModel.getSnapshot().sections[0].roomIds).toEqual([
                "!room1:server",
                "!room2:server",
                "!room3:server",
            ]);
        });
    });

    describe("Room item view models", () => {
        it("should create room item view model on demand", () => {
            viewModel = new RoomListViewModel({ client: matrixClient });

            const itemViewModel = viewModel.getRoomItemViewModel("!room1:server");

            expect(itemViewModel).toBeDefined();
            expect(itemViewModel!.getSnapshot().room).toBe(room1);
        });

        it("should reuse existing room item view model", () => {
            viewModel = new RoomListViewModel({ client: matrixClient });

            const itemViewModel1 = viewModel.getRoomItemViewModel("!room1:server");
            const itemViewModel2 = viewModel.getRoomItemViewModel("!room1:server");

            expect(itemViewModel1).toBe(itemViewModel2);
        });

        it("should return undefined for non-existent room", () => {
            viewModel = new RoomListViewModel({ client: matrixClient });

            expect(viewModel.getRoomItemViewModel("!nonexistent:server")).toBeUndefined();
        });

        it("should not throw when requesting view model for a room removed from the list but still in roomsMap", () => {
            viewModel = new RoomListViewModel({ client: matrixClient });

            // Normal list update removes room2 from the list
            jest.spyOn(RoomListStoreV3.instance, "getSortedRoomsInActiveSpace").mockReturnValue({
                spaceId: "home",
                sections: [{ tag: CHATS_TAG, rooms: [room1, room3] }],
            });

            RoomListStoreV3.instance.emit(RoomListStoreV3Event.ListsUpdate);

            expect(() => viewModel.getRoomItemViewModel("!room2:server")).not.toThrow();
        });

        it("should return undefined for a room from old space after space change", () => {
            viewModel = new RoomListViewModel({ client: matrixClient });

            const spaceRoom = mkStubRoom("!newroom:server", "New Room", matrixClient);

            // Space change: new space only has spaceRoom
            jest.spyOn(RoomListStoreV3.instance, "getSortedRoomsInActiveSpace").mockReturnValue({
                spaceId: "!space:server",
                sections: [{ tag: CHATS_TAG, rooms: [spaceRoom] }],
            });
            jest.spyOn(SpaceStore.instance, "getLastSelectedRoomIdForSpace").mockReturnValue(null);

            RoomListStoreV3.instance.emit(RoomListStoreV3Event.ListsUpdate);

            expect(viewModel.getRoomItemViewModel("!room1:server")).toBeUndefined();
        });

        it("should recover when roomsMap is stale but roomsResult has the room", () => {
            viewModel = new RoomListViewModel({ client: matrixClient });

            // Manually clear roomsMap to simulate stale cache, but keep roomsResult intact
            (viewModel as any).roomsMap.clear();

            // getRoomItemViewModel should retry by re-populating roomsMap from roomsResult
            expect(() => viewModel.getRoomItemViewModel("!room1:server")).not.toThrow();
        });

        it("should dispose view models for rooms no longer visible", () => {
            viewModel = new RoomListViewModel({ client: matrixClient });

            const vm1 = viewModel.getRoomItemViewModel("!room1:server")!;
            const vm2 = viewModel.getRoomItemViewModel("!room2:server")!;
            const vm3 = viewModel.getRoomItemViewModel("!room3:server")!;

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
            viewModel = new RoomListViewModel({ client: matrixClient });

            const dispatchSpy = jest.spyOn(dispatcher, "fire");

            viewModel.createChatRoom();

            expect(dispatchSpy).toHaveBeenCalledWith(Action.CreateChat);
        });

        it("should dispatch CreateRoom action without parent space", () => {
            viewModel = new RoomListViewModel({ client: matrixClient });

            const dispatchSpy = jest.spyOn(dispatcher, "dispatch");

            viewModel.createRoom();

            expect(dispatchSpy).toHaveBeenCalledWith({
                action: Action.CreateRoom,
            });
        });

        it("should dispatch CreateRoom action with parent space", () => {
            const spaceRoom = mkStubRoom("!space:server", "Space", matrixClient);
            jest.spyOn(SpaceStore.instance, "activeSpaceRoom", "get").mockReturnValue(spaceRoom);

            viewModel = new RoomListViewModel({ client: matrixClient });

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
            viewModel = new RoomListViewModel({ client: matrixClient });

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
            viewModel = new RoomListViewModel({ client: matrixClient });

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
            viewModel = new RoomListViewModel({ client: matrixClient });

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
            viewModel = new RoomListViewModel({ client: matrixClient });

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
            viewModel = new RoomListViewModel({ client: matrixClient });

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
            viewModel = new RoomListViewModel({ client: matrixClient });

            const vm1 = viewModel.getRoomItemViewModel("!room1:server")!;
            const vm2 = viewModel.getRoomItemViewModel("!room2:server")!;

            const disposeSpy1 = jest.spyOn(vm1, "dispose");
            const disposeSpy2 = jest.spyOn(vm2, "dispose");

            viewModel.dispose();

            expect(disposeSpy1).toHaveBeenCalled();
            expect(disposeSpy2).toHaveBeenCalled();
        });

        describe("Sections (feature_room_list_sections)", () => {
            let favRoom1: Room;
            let favRoom2: Room;
            let lowPriorityRoom: Room;
            let regularRoom1: Room;
            let regularRoom2: Room;

            beforeEach(() => {
                jest.spyOn(SettingsStore, "getValue").mockImplementation((setting: string) => {
                    if (setting === "feature_room_list_sections") return true;
                    return false;
                });

                favRoom1 = mkStubRoom("!fav1:server", "Fav 1", matrixClient);
                favRoom2 = mkStubRoom("!fav2:server", "Fav 2", matrixClient);
                lowPriorityRoom = mkStubRoom("!low1:server", "Low 1", matrixClient);
                regularRoom1 = mkStubRoom("!reg1:server", "Reg 1", matrixClient);
                regularRoom2 = mkStubRoom("!reg2:server", "Reg 2", matrixClient);

                jest.spyOn(RoomListStoreV3.instance, "getSortedRoomsInActiveSpace").mockReturnValue({
                    spaceId: "home",
                    sections: [
                        { tag: DefaultTagID.Favourite, rooms: [favRoom1, favRoom2] },
                        { tag: CHATS_TAG, rooms: [regularRoom1, regularRoom2] },
                        { tag: DefaultTagID.LowPriority, rooms: [lowPriorityRoom] },
                    ],
                });
            });

            it("should initialize with multiple sections", () => {
                viewModel = new RoomListViewModel({ client: matrixClient });

                const snapshot = viewModel.getSnapshot();
                expect(snapshot.sections).toHaveLength(3);
                expect(snapshot.sections[0].id).toBe(DefaultTagID.Favourite);
                expect(snapshot.sections[0].roomIds).toEqual(["!fav1:server", "!fav2:server"]);
                expect(snapshot.sections[1].id).toBe(CHATS_TAG);
                expect(snapshot.sections[1].roomIds).toEqual(["!reg1:server", "!reg2:server"]);
                expect(snapshot.sections[2].id).toBe(DefaultTagID.LowPriority);
                expect(snapshot.sections[2].roomIds).toEqual(["!low1:server"]);
            });

            it("should not be a flat list when multiple sections exist", () => {
                viewModel = new RoomListViewModel({ client: matrixClient });

                expect(viewModel.getSnapshot().isFlatList).toBe(false);
            });

            it("should be a flat list when only chats section has rooms", () => {
                jest.spyOn(RoomListStoreV3.instance, "getSortedRoomsInActiveSpace").mockReturnValue({
                    spaceId: "home",
                    sections: [
                        { tag: DefaultTagID.Favourite, rooms: [] },
                        { tag: CHATS_TAG, rooms: [regularRoom1] },
                        { tag: DefaultTagID.LowPriority, rooms: [] },
                    ],
                });

                viewModel = new RoomListViewModel({ client: matrixClient });

                expect(viewModel.getSnapshot().isFlatList).toBe(true);
                expect(viewModel.getSnapshot().sections).toHaveLength(1);
                expect(viewModel.getSnapshot().sections[0].id).toBe(CHATS_TAG);
            });

            it("should exclude favourite and low_priority from filter list", () => {
                viewModel = new RoomListViewModel({ client: matrixClient });

                const snapshot = viewModel.getSnapshot();
                expect(snapshot.filterIds).not.toContain("favourite");
                expect(snapshot.filterIds).not.toContain("low_priority");
                // Other filters should still be present
                expect(snapshot.filterIds).toContain("unread");
                expect(snapshot.filterIds).toContain("people");
            });

            it("should omit empty sections from snapshot", () => {
                jest.spyOn(RoomListStoreV3.instance, "getSortedRoomsInActiveSpace").mockReturnValue({
                    spaceId: "home",
                    sections: [
                        { tag: DefaultTagID.Favourite, rooms: [] },
                        { tag: CHATS_TAG, rooms: [regularRoom1] },
                        { tag: DefaultTagID.LowPriority, rooms: [] },
                    ],
                });

                viewModel = new RoomListViewModel({ client: matrixClient });

                const snapshot = viewModel.getSnapshot();
                expect(snapshot.sections).toHaveLength(1);
                expect(snapshot.sections[0].id).toBe(CHATS_TAG);
            });

            it("should create section header view models on demand", () => {
                viewModel = new RoomListViewModel({ client: matrixClient });

                const headerVM = viewModel.getSectionHeaderViewModel(DefaultTagID.Favourite);
                expect(headerVM).toBeDefined();
                expect(headerVM.getSnapshot().id).toBe(DefaultTagID.Favourite);
                expect(headerVM.getSnapshot().isExpanded).toBe(true);
            });

            it("should reuse section header view models", () => {
                viewModel = new RoomListViewModel({ client: matrixClient });

                const headerVM1 = viewModel.getSectionHeaderViewModel(DefaultTagID.Favourite);
                const headerVM2 = viewModel.getSectionHeaderViewModel(DefaultTagID.Favourite);
                expect(headerVM1).toBe(headerVM2);
            });

            it("should hide room IDs when a section is collapsed", () => {
                viewModel = new RoomListViewModel({ client: matrixClient });

                // Collapse the favourite section
                const favHeader = viewModel.getSectionHeaderViewModel(DefaultTagID.Favourite);
                favHeader.onClick();
                expect(favHeader.isExpanded).toBe(false);

                const snapshot = viewModel.getSnapshot();
                const favSection = snapshot.sections.find((s) => s.id === DefaultTagID.Favourite);
                expect(favSection).toBeDefined();
                // Collapsed sections have an empty roomIds list
                expect(favSection!.roomIds).toEqual([]);

                // Other sections remain unaffected
                const chatsSection = snapshot.sections.find((s) => s.id === CHATS_TAG);
                expect(chatsSection!.roomIds).toEqual(["!reg1:server", "!reg2:server"]);
            });

            it("should compute activeRoomIndex relative to visible rooms when a section is collapsed", async () => {
                viewModel = new RoomListViewModel({ client: matrixClient });

                // Collapse the favourite section (which has 2 rooms: fav1, fav2)
                const favHeader = viewModel.getSectionHeaderViewModel(DefaultTagID.Favourite);
                favHeader.onClick();
                expect(favHeader.isExpanded).toBe(false);

                // Select regularRoom1, which is the first room in the chats section
                jest.spyOn(SdkContextClass.instance.roomViewStore, "getRoomId").mockReturnValue("!reg1:server");
                dispatcher.dispatch({
                    action: Action.ActiveRoomChanged,
                    newRoomId: "!reg1:server",
                });

                await waitFor(() => {
                    const snapshot = viewModel.getSnapshot();
                    // The favourite section is collapsed so its 2 rooms are not visible.
                    // regularRoom1 should be at index 0 in the visible list, not index 2.
                    expect(snapshot.roomListState.activeRoomIndex).toBe(0);
                });
            });

            it("should restore room IDs when a section is re-expanded", () => {
                viewModel = new RoomListViewModel({ client: matrixClient });

                const favHeader = viewModel.getSectionHeaderViewModel(DefaultTagID.Favourite);

                // Collapse then re-expand
                favHeader.onClick();
                favHeader.onClick();
                expect(favHeader.isExpanded).toBe(true);

                const snapshot = viewModel.getSnapshot();
                const favSection = snapshot.sections.find((s) => s.id === DefaultTagID.Favourite);
                expect(favSection!.roomIds).toEqual(["!fav1:server", "!fav2:server"]);
            });

            it("should update sections when room list changes", () => {
                viewModel = new RoomListViewModel({ client: matrixClient });

                const newFav = mkStubRoom("!fav3:server", "Fav 3", matrixClient);

                jest.spyOn(RoomListStoreV3.instance, "getSortedRoomsInActiveSpace").mockReturnValue({
                    spaceId: "home",
                    sections: [
                        { tag: DefaultTagID.Favourite, rooms: [favRoom1, favRoom2, newFav] },
                        { tag: CHATS_TAG, rooms: [regularRoom1, regularRoom2] },
                        { tag: DefaultTagID.LowPriority, rooms: [lowPriorityRoom] },
                    ],
                });

                RoomListStoreV3.instance.emit(RoomListStoreV3Event.ListsUpdate);

                const snapshot = viewModel.getSnapshot();
                expect(snapshot.sections[0].roomIds).toEqual(["!fav1:server", "!fav2:server", "!fav3:server"]);
            });

            it("should preserve section collapse state across list updates", () => {
                viewModel = new RoomListViewModel({ client: matrixClient });

                // Collapse favourites
                const favHeader = viewModel.getSectionHeaderViewModel(DefaultTagID.Favourite);
                favHeader.onClick();

                // Trigger a list update
                RoomListStoreV3.instance.emit(RoomListStoreV3Event.ListsUpdate);

                const snapshot = viewModel.getSnapshot();
                const favSection = snapshot.sections.find((s) => s.id === DefaultTagID.Favourite);
                expect(favSection!.roomIds).toEqual([]);
            });

            it("should track section collapse state per space", () => {
                viewModel = new RoomListViewModel({ client: matrixClient });

                // Collapse favourites in the home space
                const favHeader = viewModel.getSectionHeaderViewModel(DefaultTagID.Favourite);
                favHeader.onClick();

                // Switch to a different space with its own rooms
                const spaceFav = mkStubRoom("!spacefav:server", "Space Fav", matrixClient);
                const spaceReg = mkStubRoom("!spacereg:server", "Space Reg", matrixClient);
                jest.spyOn(RoomListStoreV3.instance, "getSortedRoomsInActiveSpace").mockReturnValue({
                    spaceId: "!space:server",
                    sections: [
                        { tag: DefaultTagID.Favourite, rooms: [spaceFav] },
                        { tag: CHATS_TAG, rooms: [spaceReg] },
                        { tag: DefaultTagID.LowPriority, rooms: [] },
                    ],
                });
                jest.spyOn(SpaceStore.instance, "getLastSelectedRoomIdForSpace").mockReturnValue(null);

                RoomListStoreV3.instance.emit(RoomListStoreV3Event.ListsUpdate);

                let snapshot = viewModel.getSnapshot();
                // Favourites should be expanded in the new space (per-space state)
                let favSection = snapshot.sections.find((s) => s.id === DefaultTagID.Favourite);
                expect(favSection).toBeDefined();
                expect(favSection!.roomIds).toEqual(["!spacefav:server"]);

                // Other sections should also be expanded
                let chatsSection = snapshot.sections.find((s) => s.id === CHATS_TAG);
                expect(chatsSection!.roomIds).toEqual(["!spacereg:server"]);

                // Switch back to home space
                jest.spyOn(RoomListStoreV3.instance, "getSortedRoomsInActiveSpace").mockReturnValue({
                    spaceId: "home",
                    sections: [
                        { tag: DefaultTagID.Favourite, rooms: [favRoom1, favRoom2] },
                        { tag: CHATS_TAG, rooms: [regularRoom1] },
                        { tag: DefaultTagID.LowPriority, rooms: [] },
                    ],
                });

                RoomListStoreV3.instance.emit(RoomListStoreV3Event.ListsUpdate);

                snapshot = viewModel.getSnapshot();
                // Favourites should still be collapsed in the home space
                favSection = snapshot.sections.find((s) => s.id === DefaultTagID.Favourite);
                expect(favSection).toBeDefined();
                expect(favSection!.roomIds).toEqual([]);

                // Chats should be expanded
                chatsSection = snapshot.sections.find((s) => s.id === CHATS_TAG);
                expect(chatsSection!.roomIds).toEqual(["!reg1:server"]);
            });

            it("should apply filters across all sections", () => {
                viewModel = new RoomListViewModel({ client: matrixClient });

                // Only favRoom1 is unread
                jest.spyOn(RoomListStoreV3.instance, "getSortedRoomsInActiveSpace").mockReturnValue({
                    spaceId: "home",
                    sections: [
                        { tag: DefaultTagID.Favourite, rooms: [favRoom1] },
                        { tag: CHATS_TAG, rooms: [] },
                        { tag: DefaultTagID.LowPriority, rooms: [] },
                    ],
                    filterKeys: [FilterEnum.UnreadFilter],
                });

                viewModel.onToggleFilter("unread");

                const snapshot = viewModel.getSnapshot();
                expect(snapshot.activeFilterId).toBe("unread");
                // Only the favourite section should remain (chats and low priority are empty)
                expect(snapshot.sections).toHaveLength(1);
                expect(snapshot.sections[0].id).toBe(DefaultTagID.Favourite);
                expect(snapshot.sections[0].roomIds).toEqual(["!fav1:server"]);
            });

            it("should apply sticky room within the correct section", async () => {
                stubClient();
                viewModel = new RoomListViewModel({ client: matrixClient });

                // Select favRoom1 (index 0 globally, index 0 in favourites section)
                jest.spyOn(SdkContextClass.instance.roomViewStore, "getRoomId").mockReturnValue("!fav1:server");
                dispatcher.dispatch({
                    action: Action.ActiveRoomChanged,
                    newRoomId: "!fav1:server",
                });
                await flushPromises();

                expect(viewModel.getSnapshot().roomListState.activeRoomIndex).toBe(0);

                // Room list update moves favRoom1 to second position within favourites
                jest.spyOn(RoomListStoreV3.instance, "getSortedRoomsInActiveSpace").mockReturnValue({
                    spaceId: "home",
                    sections: [
                        { tag: DefaultTagID.Favourite, rooms: [favRoom2, favRoom1] },
                        { tag: CHATS_TAG, rooms: [regularRoom1, regularRoom2] },
                        { tag: DefaultTagID.LowPriority, rooms: [lowPriorityRoom] },
                    ],
                });

                RoomListStoreV3.instance.emit(RoomListStoreV3Event.ListsUpdate);

                // Sticky room should keep favRoom1 at index 0 within the favourites section
                const snapshot = viewModel.getSnapshot();
                expect(snapshot.sections[0].roomIds[0]).toBe("!fav1:server");
                expect(snapshot.roomListState.activeRoomIndex).toBe(0);
            });
        });
    });
});

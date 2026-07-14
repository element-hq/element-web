/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { type MatrixClient, type Room } from "matrix-js-sdk/src/matrix";
import { mocked } from "jest-mock";
import { waitFor } from "jest-matrix-react";

import {
    createTestClient,
    flushPromises,
    flushPromisesWithFakeTimers,
    mkStubRoom,
    stubClient,
    TestSDKContext,
} from "../../test-utils";
import RoomListStoreV3, { RoomListStoreV3Event } from "../../../src/stores/room-list-v3/RoomListStoreV3";
import { FilterEnum } from "../../../src/stores/room-list-v3/skip-list/filters";
import dispatcher from "../../../src/dispatcher/dispatcher";
import { Action } from "../../../src/dispatcher/actions";
import { SDKContextClass } from "../../../src/contexts/SDKContextClass";
import DMRoomMap from "../../../src/utils/DMRoomMap";
import { RoomListViewModel } from "../../../src/viewmodels/room-list/RoomListViewModel";
import { hasCreateRoomRights } from "../../../src/viewmodels/room-list/utils";
import { DefaultTagID } from "../../../src/stores/room-list-v3/skip-list/tag";
import SettingsStore from "../../../src/settings/SettingsStore";
import { tagRoom } from "../../../src/utils/room/tagRoom";
import { getSectionTagForRoom } from "../../../src/utils/room/getSectionTagForRoom";
import { CHATS_TAG, CUSTOM_SECTION_TAG_PREFIX } from "../../../src/stores/room-list-v3/section";
import { MetaSpace } from "../../../src/stores/spaces";
import { RoomNotificationStateStore } from "../../../src/stores/notifications/RoomNotificationStateStore";
import { type RoomNotificationState } from "../../../src/stores/notifications/RoomNotificationState";

jest.mock("../../../src/utils/room/tagRoom", () => ({
    tagRoom: jest.fn(),
}));

jest.mock("../../../src/utils/room/getSectionTagForRoom", () => ({
    getSectionTagForRoom: jest.fn().mockReturnValue(null),
}));

jest.mock("../../../src/viewmodels/room-list/utils", () => ({
    hasCreateRoomRights: jest.fn().mockReturnValue(false),
    hasAccessToOptionsMenu: jest.fn().mockReturnValue(true),
    hasAccessToNotificationMenu: jest.fn().mockReturnValue(true),
}));

describe("RoomListViewModel", () => {
    let matrixClient: MatrixClient;
    let sdkContext: TestSDKContext;
    let room1: Room;
    let room2: Room;
    let room3: Room;
    let viewModel: RoomListViewModel;

    beforeEach(() => {
        matrixClient = createTestClient();
        sdkContext = new TestSDKContext();
        sdkContext._client = matrixClient;
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
        jest.spyOn(SDKContextClass.instance.spaceStore, "activeSpaceRoom", "get").mockReturnValue(null);
        jest.spyOn(SDKContextClass.instance.roomViewStore, "getRoomId").mockReturnValue(null);

        mocked(hasCreateRoomRights).mockReturnValue(false);
    });

    afterEach(() => {
        viewModel?.dispose();
        jest.restoreAllMocks();
    });

    describe("Initialization", () => {
        it("should initialize with correct snapshot", () => {
            viewModel = new RoomListViewModel({
                client: matrixClient,
                spaceStore: SDKContextClass.instance.spaceStore,
                roomViewStore: SDKContextClass.instance.roomViewStore,
            });

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

            viewModel = new RoomListViewModel({
                client: matrixClient,
                spaceStore: SDKContextClass.instance.spaceStore,
                roomViewStore: SDKContextClass.instance.roomViewStore,
            });

            expect(viewModel.getSnapshot().sections).toEqual([]);
            expect(viewModel.getSnapshot().isRoomListEmpty).toBe(true);
            expect(viewModel.getSnapshot().isFlatList).toBe(true);
        });

        it("should set canCreateRoom based on user rights", () => {
            mocked(hasCreateRoomRights).mockReturnValue(true);
            viewModel = new RoomListViewModel({
                client: matrixClient,
                spaceStore: SDKContextClass.instance.spaceStore,
                roomViewStore: SDKContextClass.instance.roomViewStore,
            });

            expect(viewModel.getSnapshot().canCreateRoom).toBe(true);
        });
    });

    describe("Room list updates", () => {
        it("should update room list when ListsUpdate event fires", () => {
            viewModel = new RoomListViewModel({
                client: matrixClient,
                spaceStore: SDKContextClass.instance.spaceStore,
                roomViewStore: SDKContextClass.instance.roomViewStore,
            });

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
            viewModel = new RoomListViewModel({
                client: matrixClient,
                spaceStore: SDKContextClass.instance.spaceStore,
                roomViewStore: SDKContextClass.instance.roomViewStore,
            });

            expect(viewModel.getSnapshot().isLoadingRooms).toBe(true);

            RoomListStoreV3.instance.emit(RoomListStoreV3Event.ListsLoaded);

            expect(viewModel.getSnapshot().isLoadingRooms).toBe(false);
        });

        // This test ensures that the room list item vms are preserved when the room list is changing
        it("should keep existing view model when ListsUpdate event fires", () => {
            viewModel = new RoomListViewModel({
                client: matrixClient,
                spaceStore: SDKContextClass.instance.spaceStore,
                roomViewStore: SDKContextClass.instance.roomViewStore,
            });

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
            viewModel = new RoomListViewModel({
                client: matrixClient,
                spaceStore: SDKContextClass.instance.spaceStore,
                roomViewStore: SDKContextClass.instance.roomViewStore,
            });

            const spaceRoomList = [room1, room2];

            jest.spyOn(RoomListStoreV3.instance, "getSortedRoomsInActiveSpace").mockReturnValue({
                spaceId: "!space:server",
                sections: [{ tag: CHATS_TAG, rooms: spaceRoomList }],
            });

            jest.spyOn(SDKContextClass.instance.spaceStore, "getLastSelectedRoomIdForSpace").mockReturnValue(
                "!room1:server",
            );

            RoomListStoreV3.instance.emit(RoomListStoreV3Event.ListsUpdate);

            expect(viewModel.getSnapshot().roomListState.spaceId).toBe("!space:server");
            expect(viewModel.getSnapshot().sections[0].roomIds).toEqual(["!room1:server", "!room2:server"]);
        });

        it("should clear view models when space changes", () => {
            viewModel = new RoomListViewModel({
                client: matrixClient,
                spaceStore: SDKContextClass.instance.spaceStore,
                roomViewStore: SDKContextClass.instance.roomViewStore,
            });

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
            viewModel = new RoomListViewModel({
                client: matrixClient,
                spaceStore: SDKContextClass.instance.spaceStore,
                roomViewStore: SDKContextClass.instance.roomViewStore,
            });

            const newSpaceRoom = mkStubRoom("!spaceroom:server", "Space Room", matrixClient);

            jest.spyOn(RoomListStoreV3.instance, "getSortedRoomsInActiveSpace").mockReturnValue({
                spaceId: "!space:server",
                sections: [{ tag: CHATS_TAG, rooms: [newSpaceRoom] }],
            });
            jest.spyOn(SDKContextClass.instance.spaceStore, "getLastSelectedRoomIdForSpace").mockReturnValue(null);

            RoomListStoreV3.instance.emit(RoomListStoreV3Event.ListsUpdate);

            // New space room should be accessible
            expect(() => viewModel.getRoomItemViewModel("!spaceroom:server")).not.toThrow();
            // Old rooms from the home space should not be accessible
            expect(viewModel.getRoomItemViewModel("!room1:server")).toBeUndefined();
        });
    });

    describe("Active room tracking", () => {
        it("should update active room index when room is selected", async () => {
            viewModel = new RoomListViewModel({
                client: matrixClient,
                spaceStore: SDKContextClass.instance.spaceStore,
                roomViewStore: SDKContextClass.instance.roomViewStore,
            });

            jest.spyOn(SDKContextClass.instance.roomViewStore, "getRoomId").mockReturnValue("!room2:server");

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
            viewModel = new RoomListViewModel({
                client: matrixClient,
                spaceStore: SDKContextClass.instance.spaceStore,
                roomViewStore: SDKContextClass.instance.roomViewStore,
            });

            jest.spyOn(SDKContextClass.instance.roomViewStore, "getRoomId").mockReturnValue(null);

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
            viewModel = new RoomListViewModel({
                client: matrixClient,
                spaceStore: SDKContextClass.instance.spaceStore,
                roomViewStore: SDKContextClass.instance.roomViewStore,
            });

            // Select room at index 1
            jest.spyOn(SDKContextClass.instance.roomViewStore, "getRoomId").mockReturnValue("!room2:server");
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
            viewModel = new RoomListViewModel({
                client: matrixClient,
                spaceStore: SDKContextClass.instance.spaceStore,
                roomViewStore: SDKContextClass.instance.roomViewStore,
            });

            // Select room at index 1
            jest.spyOn(SDKContextClass.instance.roomViewStore, "getRoomId").mockReturnValue("!room2:server");
            dispatcher.dispatch({
                action: Action.ActiveRoomChanged,
                newRoomId: "!room2:server",
            });

            await flushPromises();

            // User switches to room3
            jest.spyOn(SDKContextClass.instance.roomViewStore, "getRoomId").mockReturnValue("!room3:server");
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
            viewModel = new RoomListViewModel({
                client: matrixClient,
                spaceStore: SDKContextClass.instance.spaceStore,
                roomViewStore: SDKContextClass.instance.roomViewStore,
            });

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
            viewModel = new RoomListViewModel({
                client: matrixClient,
                spaceStore: SDKContextClass.instance.spaceStore,
                roomViewStore: SDKContextClass.instance.roomViewStore,
            });

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

        describe("Favourites and Low Priority filters (RoomList.showSections)", () => {
            function mockShowSections(showSections: boolean): void {
                jest.spyOn(SettingsStore, "getValue").mockImplementation((setting) => {
                    if (setting === "RoomList.showSections") return showSections;
                    if (setting === "RoomList.CustomSectionData") return {};
                    if (setting === "RoomList.OrderedCustomSections") return [];
                    return undefined as any;
                });
            }

            it("hides the Favourites and Low Priority filters when sections are enabled", () => {
                mockShowSections(true);
                viewModel = new RoomListViewModel({
                    client: matrixClient,
                    roomViewStore: sdkContext.roomViewStore,
                    spaceStore: sdkContext.spaceStore,
                });

                const { filterIds } = viewModel.getSnapshot();
                expect(filterIds).not.toContain("favourite");
                expect(filterIds).not.toContain("low_priority");
            });

            it("shows the Favourites and Low Priority filters when sections are disabled", () => {
                mockShowSections(false);
                viewModel = new RoomListViewModel({
                    client: matrixClient,
                    roomViewStore: sdkContext.roomViewStore,
                    spaceStore: sdkContext.spaceStore,
                });

                const { filterIds } = viewModel.getSnapshot();
                expect(filterIds).toContain("favourite");
                expect(filterIds).toContain("low_priority");
            });

            it("recomputes the filters and clears the active filter when the setting changes", () => {
                let showSections = false;
                let watchCallback: () => void = () => {};
                jest.spyOn(SettingsStore, "getValue").mockImplementation((setting) => {
                    if (setting === "RoomList.showSections") return showSections;
                    if (setting === "RoomList.CustomSectionData") return {};
                    if (setting === "RoomList.OrderedCustomSections") return [];
                    return undefined as any;
                });
                jest.spyOn(SettingsStore, "watchSetting").mockImplementation((setting, _room, callback) => {
                    if (setting === "RoomList.showSections") watchCallback = callback as () => void;
                    return "watcher-id";
                });

                viewModel = new RoomListViewModel({
                    client: matrixClient,
                    roomViewStore: sdkContext.roomViewStore,
                    spaceStore: sdkContext.spaceStore,
                });
                expect(viewModel.getSnapshot().filterIds).toContain("favourite");

                // Activate the Favourites filter
                jest.spyOn(RoomListStoreV3.instance, "getSortedRoomsInActiveSpace").mockReturnValue({
                    spaceId: "home",
                    sections: [{ tag: CHATS_TAG, rooms: [room1] }],
                    filterKeys: [FilterEnum.FavouriteFilter],
                });
                viewModel.onToggleFilter("favourite");
                expect(viewModel.getSnapshot().activeFilterId).toBe("favourite");

                // Enabling sections hides the Favourites filter and resets the active filter
                showSections = true;
                jest.spyOn(RoomListStoreV3.instance, "getSortedRoomsInActiveSpace").mockReturnValue({
                    spaceId: "home",
                    sections: [{ tag: CHATS_TAG, rooms: [room1, room2, room3] }],
                });
                watchCallback();

                const snapshot = viewModel.getSnapshot();
                expect(snapshot.filterIds).not.toContain("favourite");
                expect(snapshot.filterIds).not.toContain("low_priority");
                expect(snapshot.activeFilterId).toBeUndefined();
            });
        });
    });

    describe("Room item view models", () => {
        it("should create room item view model on demand", () => {
            viewModel = new RoomListViewModel({
                client: matrixClient,
                spaceStore: SDKContextClass.instance.spaceStore,
                roomViewStore: SDKContextClass.instance.roomViewStore,
            });

            const itemViewModel = viewModel.getRoomItemViewModel("!room1:server");

            expect(itemViewModel).toBeDefined();
            expect(itemViewModel!.getSnapshot().room).toBe(room1);
        });

        it("should reuse existing room item view model", () => {
            viewModel = new RoomListViewModel({
                client: matrixClient,
                spaceStore: SDKContextClass.instance.spaceStore,
                roomViewStore: SDKContextClass.instance.roomViewStore,
            });

            const itemViewModel1 = viewModel.getRoomItemViewModel("!room1:server");
            const itemViewModel2 = viewModel.getRoomItemViewModel("!room1:server");

            expect(itemViewModel1).toBe(itemViewModel2);
        });

        it("should return undefined for non-existent room", () => {
            viewModel = new RoomListViewModel({
                client: matrixClient,
                spaceStore: SDKContextClass.instance.spaceStore,
                roomViewStore: SDKContextClass.instance.roomViewStore,
            });

            expect(viewModel.getRoomItemViewModel("!nonexistent:server")).toBeUndefined();
        });

        it("should not throw when requesting view model for a room removed from the list but still in roomsMap", () => {
            viewModel = new RoomListViewModel({
                client: matrixClient,
                spaceStore: SDKContextClass.instance.spaceStore,
                roomViewStore: SDKContextClass.instance.roomViewStore,
            });

            // Normal list update removes room2 from the list
            jest.spyOn(RoomListStoreV3.instance, "getSortedRoomsInActiveSpace").mockReturnValue({
                spaceId: "home",
                sections: [{ tag: CHATS_TAG, rooms: [room1, room3] }],
            });

            RoomListStoreV3.instance.emit(RoomListStoreV3Event.ListsUpdate);

            expect(() => viewModel.getRoomItemViewModel("!room2:server")).not.toThrow();
        });

        it("should return undefined for a room from old space after space change", () => {
            viewModel = new RoomListViewModel({
                client: matrixClient,
                spaceStore: SDKContextClass.instance.spaceStore,
                roomViewStore: SDKContextClass.instance.roomViewStore,
            });

            const spaceRoom = mkStubRoom("!newroom:server", "New Room", matrixClient);

            // Space change: new space only has spaceRoom
            jest.spyOn(RoomListStoreV3.instance, "getSortedRoomsInActiveSpace").mockReturnValue({
                spaceId: "!space:server",
                sections: [{ tag: CHATS_TAG, rooms: [spaceRoom] }],
            });
            jest.spyOn(SDKContextClass.instance.spaceStore, "getLastSelectedRoomIdForSpace").mockReturnValue(null);

            RoomListStoreV3.instance.emit(RoomListStoreV3Event.ListsUpdate);

            expect(viewModel.getRoomItemViewModel("!room1:server")).toBeUndefined();
        });

        it("should recover when roomsMap is stale but roomsResult has the room", () => {
            viewModel = new RoomListViewModel({
                client: matrixClient,
                spaceStore: SDKContextClass.instance.spaceStore,
                roomViewStore: SDKContextClass.instance.roomViewStore,
            });

            // Manually clear roomsMap to simulate stale cache, but keep roomsResult intact
            (viewModel as any).roomsMap.clear();

            // getRoomItemViewModel should retry by re-populating roomsMap from roomsResult
            expect(() => viewModel.getRoomItemViewModel("!room1:server")).not.toThrow();
        });

        it("should dispose view models for rooms no longer visible", () => {
            viewModel = new RoomListViewModel({
                client: matrixClient,
                spaceStore: SDKContextClass.instance.spaceStore,
                roomViewStore: SDKContextClass.instance.roomViewStore,
            });

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
            viewModel = new RoomListViewModel({
                client: matrixClient,
                spaceStore: SDKContextClass.instance.spaceStore,
                roomViewStore: SDKContextClass.instance.roomViewStore,
            });

            const dispatchSpy = jest.spyOn(dispatcher, "fire");

            viewModel.createChatRoom();

            expect(dispatchSpy).toHaveBeenCalledWith(Action.CreateChat);
        });

        it("should dispatch CreateRoom action without parent space", () => {
            viewModel = new RoomListViewModel({
                client: matrixClient,
                spaceStore: SDKContextClass.instance.spaceStore,
                roomViewStore: SDKContextClass.instance.roomViewStore,
            });

            const dispatchSpy = jest.spyOn(dispatcher, "dispatch");

            viewModel.createRoom();

            expect(dispatchSpy).toHaveBeenCalledWith({
                action: Action.CreateRoom,
            });
        });

        it("should dispatch CreateRoom action with parent space", () => {
            const spaceRoom = mkStubRoom("!space:server", "Space", matrixClient);
            jest.spyOn(SDKContextClass.instance.spaceStore, "activeSpaceRoom", "get").mockReturnValue(spaceRoom);

            viewModel = new RoomListViewModel({
                client: matrixClient,
                spaceStore: SDKContextClass.instance.spaceStore,
                roomViewStore: SDKContextClass.instance.roomViewStore,
            });

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
            viewModel = new RoomListViewModel({
                client: matrixClient,
                spaceStore: SDKContextClass.instance.spaceStore,
                roomViewStore: SDKContextClass.instance.roomViewStore,
            });

            jest.spyOn(SDKContextClass.instance.roomViewStore, "getRoomId").mockReturnValue("!room1:server");

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
            viewModel = new RoomListViewModel({
                client: matrixClient,
                spaceStore: SDKContextClass.instance.spaceStore,
                roomViewStore: SDKContextClass.instance.roomViewStore,
            });

            jest.spyOn(SDKContextClass.instance.roomViewStore, "getRoomId").mockReturnValue("!room2:server");

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
            viewModel = new RoomListViewModel({
                client: matrixClient,
                spaceStore: SDKContextClass.instance.spaceStore,
                roomViewStore: SDKContextClass.instance.roomViewStore,
            });

            jest.spyOn(SDKContextClass.instance.roomViewStore, "getRoomId").mockReturnValue("!room1:server");

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
            viewModel = new RoomListViewModel({
                client: matrixClient,
                spaceStore: SDKContextClass.instance.spaceStore,
                roomViewStore: SDKContextClass.instance.roomViewStore,
            });

            jest.spyOn(SDKContextClass.instance.roomViewStore, "getRoomId").mockReturnValue("!unknown:server");

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
            viewModel = new RoomListViewModel({
                client: matrixClient,
                spaceStore: SDKContextClass.instance.spaceStore,
                roomViewStore: SDKContextClass.instance.roomViewStore,
            });

            jest.spyOn(SDKContextClass.instance.roomViewStore, "getRoomId").mockReturnValue(null);

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
        beforeEach(() => {
            jest.useFakeTimers();
        });

        afterEach(() => {
            jest.useRealTimers();
        });

        it("should dispose all room item view models on dispose", () => {
            viewModel = new RoomListViewModel({
                client: matrixClient,
                spaceStore: SDKContextClass.instance.spaceStore,
                roomViewStore: SDKContextClass.instance.roomViewStore,
            });

            const vm1 = viewModel.getRoomItemViewModel("!room1:server")!;
            const vm2 = viewModel.getRoomItemViewModel("!room2:server")!;

            const disposeSpy1 = jest.spyOn(vm1, "dispose");
            const disposeSpy2 = jest.spyOn(vm2, "dispose");

            viewModel.dispose();

            expect(disposeSpy1).toHaveBeenCalled();
            expect(disposeSpy2).toHaveBeenCalled();
        });

        describe("Toast", () => {
            it("should show toast when SectionCreated event fires", () => {
                viewModel = new RoomListViewModel({
                    client: matrixClient,
                    spaceStore: SDKContextClass.instance.spaceStore,
                    roomViewStore: SDKContextClass.instance.roomViewStore,
                });
                RoomListStoreV3.instance.emit(RoomListStoreV3Event.SectionCreated);
                expect(viewModel.getSnapshot().toast).toBe("section_created");
            });

            it("should show toast when RoomTagged event fires", () => {
                viewModel = new RoomListViewModel({
                    client: matrixClient,
                    spaceStore: SDKContextClass.instance.spaceStore,
                    roomViewStore: SDKContextClass.instance.roomViewStore,
                });
                RoomListStoreV3.instance.emit(RoomListStoreV3Event.RoomTagged);
                expect(viewModel.getSnapshot().toast).toBe("chat_moved");
            });

            it("should clear toast when closeToast is called", () => {
                viewModel = new RoomListViewModel({
                    client: matrixClient,
                    spaceStore: SDKContextClass.instance.spaceStore,
                    roomViewStore: SDKContextClass.instance.roomViewStore,
                });

                RoomListStoreV3.instance.emit(RoomListStoreV3Event.SectionCreated);
                expect(viewModel.getSnapshot().toast).toBe("section_created");

                viewModel.closeToast();
                expect(viewModel.getSnapshot().toast).toBeUndefined();
            });

            it("should auto-close toast after 15 seconds", () => {
                viewModel = new RoomListViewModel({
                    client: matrixClient,
                    spaceStore: SDKContextClass.instance.spaceStore,
                    roomViewStore: SDKContextClass.instance.roomViewStore,
                });

                RoomListStoreV3.instance.emit(RoomListStoreV3Event.SectionCreated);
                expect(viewModel.getSnapshot().toast).toBe("section_created");

                jest.advanceTimersByTime(15 * 1000);
                expect(viewModel.getSnapshot().toast).toBeUndefined();
            });

            it("should reset the auto-close timer when a new section is created", () => {
                viewModel = new RoomListViewModel({
                    client: matrixClient,
                    spaceStore: SDKContextClass.instance.spaceStore,
                    roomViewStore: SDKContextClass.instance.roomViewStore,
                });

                RoomListStoreV3.instance.emit(RoomListStoreV3Event.SectionCreated);
                jest.advanceTimersByTime(10 * 1000);

                // Second section created — resets the timer
                RoomListStoreV3.instance.emit(RoomListStoreV3Event.SectionCreated);
                jest.advanceTimersByTime(10 * 1000);

                // Toast should still be visible (only 10s since last emit)
                expect(viewModel.getSnapshot().toast).toBe("section_created");

                jest.advanceTimersByTime(5 * 1000);
                expect(viewModel.getSnapshot().toast).toBeUndefined();
            });

            /** Make only `room3` report an unread count, so it is the unread room below the fold. */
            const mockRoom3Unread = (): void => {
                jest.spyOn(RoomNotificationStateStore.instance, "getRoomState").mockImplementation(
                    (room) => ({ hasUnreadCount: room === room3 }) as unknown as RoomNotificationState,
                );
            };

            it("should show the unread-activity toast when an unread room is below the fold", () => {
                mockRoom3Unread();
                viewModel = new RoomListViewModel({
                    client: matrixClient,
                    spaceStore: SDKContextClass.instance.spaceStore,
                    roomViewStore: SDKContextClass.instance.roomViewStore,
                });

                // room1/room2 visible, room3 (unread) scrolled below the fold.
                viewModel.updateVisibleFold(1);

                expect(viewModel.getSnapshot().toast).toBe("unread_activity");
            });

            it("should prefer the event toast over the unread-activity toast, restoring it on auto-close", () => {
                mockRoom3Unread();
                viewModel = new RoomListViewModel({
                    client: matrixClient,
                    spaceStore: SDKContextClass.instance.spaceStore,
                    roomViewStore: SDKContextClass.instance.roomViewStore,
                });
                viewModel.updateVisibleFold(1);
                expect(viewModel.getSnapshot().toast).toBe("unread_activity");

                // A transient event toast takes precedence over the persistent unread-activity toast…
                RoomListStoreV3.instance.emit(RoomListStoreV3Event.RoomTagged);
                expect(viewModel.getSnapshot().toast).toBe("chat_moved");

                // …and once it auto-dismisses, the unread-activity toast returns.
                jest.advanceTimersByTime(15 * 1000);
                expect(viewModel.getSnapshot().toast).toBe("unread_activity");
            });
        });

        describe("Sections", () => {
            let favRoom1: Room;
            let favRoom2: Room;
            let lowPriorityRoom: Room;
            let regularRoom1: Room;
            let regularRoom2: Room;

            beforeEach(() => {
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
                viewModel = new RoomListViewModel({
                    client: matrixClient,
                    spaceStore: SDKContextClass.instance.spaceStore,
                    roomViewStore: SDKContextClass.instance.roomViewStore,
                });

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
                viewModel = new RoomListViewModel({
                    client: matrixClient,
                    spaceStore: SDKContextClass.instance.spaceStore,
                    roomViewStore: SDKContextClass.instance.roomViewStore,
                });

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

                viewModel = new RoomListViewModel({
                    client: matrixClient,
                    spaceStore: SDKContextClass.instance.spaceStore,
                    roomViewStore: SDKContextClass.instance.roomViewStore,
                });

                expect(viewModel.getSnapshot().isFlatList).toBe(true);
                expect(viewModel.getSnapshot().sections).toHaveLength(1);
                expect(viewModel.getSnapshot().sections[0].id).toBe(CHATS_TAG);
            });

            it("should be a flat list when the room list is empty", () => {
                jest.spyOn(RoomListStoreV3.instance, "getSortedRoomsInActiveSpace").mockReturnValue({
                    spaceId: "home",
                    sections: [
                        { tag: DefaultTagID.Favourite, rooms: [] },
                        { tag: CHATS_TAG, rooms: [] },
                        { tag: DefaultTagID.LowPriority, rooms: [] },
                    ],
                });

                viewModel = new RoomListViewModel({
                    client: matrixClient,
                    spaceStore: SDKContextClass.instance.spaceStore,
                    roomViewStore: SDKContextClass.instance.roomViewStore,
                });

                expect(viewModel.getSnapshot().isFlatList).toBe(true);
                expect(viewModel.getSnapshot().sections).toHaveLength(0);
            });

            it("should exclude favourite and low_priority from filter list", () => {
                viewModel = new RoomListViewModel({
                    client: matrixClient,
                    spaceStore: SDKContextClass.instance.spaceStore,
                    roomViewStore: SDKContextClass.instance.roomViewStore,
                });

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

                viewModel = new RoomListViewModel({
                    client: matrixClient,
                    spaceStore: SDKContextClass.instance.spaceStore,
                    roomViewStore: SDKContextClass.instance.roomViewStore,
                });

                const snapshot = viewModel.getSnapshot();
                expect(snapshot.sections).toHaveLength(1);
                expect(snapshot.sections[0].id).toBe(CHATS_TAG);
            });

            it("should create section header view models on demand", () => {
                viewModel = new RoomListViewModel({
                    client: matrixClient,
                    spaceStore: SDKContextClass.instance.spaceStore,
                    roomViewStore: SDKContextClass.instance.roomViewStore,
                });

                const headerVM = viewModel.getSectionHeaderViewModel(DefaultTagID.Favourite);
                expect(headerVM).toBeDefined();
                expect(headerVM.getSnapshot().id).toBe(DefaultTagID.Favourite);
                expect(headerVM.getSnapshot().isExpanded).toBe(true);
            });

            it("should reuse section header view models", () => {
                viewModel = new RoomListViewModel({
                    client: matrixClient,
                    spaceStore: SDKContextClass.instance.spaceStore,
                    roomViewStore: SDKContextClass.instance.roomViewStore,
                });

                const headerVM1 = viewModel.getSectionHeaderViewModel(DefaultTagID.Favourite);
                const headerVM2 = viewModel.getSectionHeaderViewModel(DefaultTagID.Favourite);
                expect(headerVM1).toBe(headerVM2);
            });

            it("should hide room IDs when a section is collapsed", () => {
                viewModel = new RoomListViewModel({
                    client: matrixClient,
                    spaceStore: SDKContextClass.instance.spaceStore,
                    roomViewStore: SDKContextClass.instance.roomViewStore,
                });

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
                viewModel = new RoomListViewModel({
                    client: matrixClient,
                    spaceStore: SDKContextClass.instance.spaceStore,
                    roomViewStore: SDKContextClass.instance.roomViewStore,
                });

                // Collapse the favourite section (which has 2 rooms: fav1, fav2)
                const favHeader = viewModel.getSectionHeaderViewModel(DefaultTagID.Favourite);
                favHeader.onClick();
                expect(favHeader.isExpanded).toBe(false);

                // Select regularRoom1, which is the first room in the chats section
                jest.spyOn(SDKContextClass.instance.roomViewStore, "getRoomId").mockReturnValue("!reg1:server");
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
                viewModel = new RoomListViewModel({
                    client: matrixClient,
                    spaceStore: SDKContextClass.instance.spaceStore,
                    roomViewStore: SDKContextClass.instance.roomViewStore,
                });

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
                viewModel = new RoomListViewModel({
                    client: matrixClient,
                    spaceStore: SDKContextClass.instance.spaceStore,
                    roomViewStore: SDKContextClass.instance.roomViewStore,
                });

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
                viewModel = new RoomListViewModel({
                    client: matrixClient,
                    spaceStore: SDKContextClass.instance.spaceStore,
                    roomViewStore: SDKContextClass.instance.roomViewStore,
                });

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
                viewModel = new RoomListViewModel({
                    client: matrixClient,
                    spaceStore: SDKContextClass.instance.spaceStore,
                    roomViewStore: SDKContextClass.instance.roomViewStore,
                });

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
                jest.spyOn(SDKContextClass.instance.spaceStore, "getLastSelectedRoomIdForSpace").mockReturnValue(null);

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
                viewModel = new RoomListViewModel({
                    client: matrixClient,
                    spaceStore: SDKContextClass.instance.spaceStore,
                    roomViewStore: SDKContextClass.instance.roomViewStore,
                });

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

            describe("custom section visibility by originating space", () => {
                const customTag = `${CUSTOM_SECTION_TAG_PREFIX}test-uuid` as const;

                beforeEach(() => {
                    jest.spyOn(SDKContextClass.instance.spaceStore, "enabledMetaSpaces", "get").mockReturnValue([
                        MetaSpace.Home,
                    ]);
                    jest.spyOn(SDKContextClass.instance.spaceStore, "spacePanelSpaces", "get").mockReturnValue([
                        mkStubRoom("!space:server", "My Space", matrixClient),
                    ]);
                    jest.spyOn(SettingsStore, "getValue").mockImplementation((setting: string) => {
                        if (setting === "RoomList.CustomSectionData")
                            return {
                                [customTag]: { tag: customTag, name: "My Section", spaceId: "!space:server" },
                            };
                        return false;
                    });
                });

                it("shows an empty custom section when viewing its originating space", () => {
                    jest.spyOn(SettingsStore, "getValue").mockImplementation((setting: string) => {
                        if (setting === "RoomList.CustomSectionData")
                            return { [customTag]: { tag: customTag, name: "My Section", spaceId: MetaSpace.Home } };
                        return false;
                    });
                    jest.spyOn(RoomListStoreV3.instance, "getSortedRoomsInActiveSpace").mockReturnValue({
                        spaceId: MetaSpace.Home,
                        sections: [
                            { tag: customTag, rooms: [] },
                            { tag: CHATS_TAG, rooms: [regularRoom1] },
                        ],
                    });

                    viewModel = new RoomListViewModel({
                        client: matrixClient,
                        spaceStore: SDKContextClass.instance.spaceStore,
                        roomViewStore: SDKContextClass.instance.roomViewStore,
                    });

                    expect(viewModel.getSnapshot().sections.some((s) => s.id === customTag)).toBe(true);
                });

                it("hides an empty custom section in a different space", () => {
                    jest.spyOn(RoomListStoreV3.instance, "getSortedRoomsInActiveSpace").mockReturnValue({
                        spaceId: MetaSpace.Home,
                        sections: [
                            { tag: customTag, rooms: [] },
                            { tag: CHATS_TAG, rooms: [regularRoom1] },
                        ],
                    });

                    viewModel = new RoomListViewModel({
                        client: matrixClient,
                        spaceStore: SDKContextClass.instance.spaceStore,
                        roomViewStore: SDKContextClass.instance.roomViewStore,
                    });

                    expect(viewModel.getSnapshot().sections.some((s) => s.id === customTag)).toBe(false);
                });

                it("shows a non-empty custom section regardless of originating space", () => {
                    jest.spyOn(RoomListStoreV3.instance, "getSortedRoomsInActiveSpace").mockReturnValue({
                        spaceId: MetaSpace.Home,
                        sections: [
                            { tag: customTag, rooms: [regularRoom1] },
                            { tag: CHATS_TAG, rooms: [regularRoom2] },
                        ],
                    });

                    viewModel = new RoomListViewModel({
                        client: matrixClient,
                        spaceStore: SDKContextClass.instance.spaceStore,
                        roomViewStore: SDKContextClass.instance.roomViewStore,
                    });

                    expect(viewModel.getSnapshot().sections.some((s) => s.id === customTag)).toBe(true);
                });
            });

            describe("Collapse/expand all sections", () => {
                it("should collapse all sections when Action.RoomListCollapseAllSections is dispatched", async () => {
                    viewModel = new RoomListViewModel({
                        client: matrixClient,
                        spaceStore: SDKContextClass.instance.spaceStore,
                        roomViewStore: SDKContextClass.instance.roomViewStore,
                    });

                    const favHeader = viewModel.getSectionHeaderViewModel(DefaultTagID.Favourite);
                    const chatsHeader = viewModel.getSectionHeaderViewModel(CHATS_TAG);
                    expect(favHeader.isExpanded).toBe(true);

                    dispatcher.dispatch({ action: Action.RoomListCollapseAllSections });
                    await flushPromisesWithFakeTimers();

                    expect(favHeader.isExpanded).toBe(false);
                    expect(chatsHeader.isExpanded).toBe(false);

                    const snapshot = viewModel.getSnapshot();
                    expect(snapshot.sections.find((s) => s.id === DefaultTagID.Favourite)!.roomIds).toEqual([]);
                    expect(snapshot.sections.find((s) => s.id === CHATS_TAG)!.roomIds).toEqual([]);
                });

                it("should expand all sections when Action.RoomListExpandAllSections is dispatched", async () => {
                    viewModel = new RoomListViewModel({
                        client: matrixClient,
                        spaceStore: SDKContextClass.instance.spaceStore,
                        roomViewStore: SDKContextClass.instance.roomViewStore,
                    });

                    // Collapse first
                    const favHeader = viewModel.getSectionHeaderViewModel(DefaultTagID.Favourite);
                    favHeader.onClick();
                    expect(favHeader.isExpanded).toBe(false);

                    dispatcher.dispatch({ action: Action.RoomListExpandAllSections });
                    await flushPromisesWithFakeTimers();

                    expect(favHeader.isExpanded).toBe(true);
                    const snapshot = viewModel.getSnapshot();
                    expect(snapshot.sections.find((s) => s.id === DefaultTagID.Favourite)!.roomIds).toEqual([
                        "!fav1:server",
                        "!fav2:server",
                    ]);
                });
            });

            describe("notifyCollapseState", () => {
                it("should dispatch collapseSections=expand when all sections are expanded (default)", () => {
                    viewModel = new RoomListViewModel({
                        client: matrixClient,
                        spaceStore: SDKContextClass.instance.spaceStore,
                        roomViewStore: SDKContextClass.instance.roomViewStore,
                    });

                    const dispatchSpy = jest.spyOn(dispatcher, "dispatch");
                    RoomListStoreV3.instance.emit(RoomListStoreV3Event.ListsUpdate);

                    expect(dispatchSpy).toHaveBeenCalledWith({
                        action: Action.RoomListSectionsCollapseStateChanged,
                        collapseSections: "expand",
                    });
                });

                it("should dispatch collapseSection=collapse when all sections are collapsed", () => {
                    viewModel = new RoomListViewModel({
                        client: matrixClient,
                        spaceStore: SDKContextClass.instance.spaceStore,
                        roomViewStore: SDKContextClass.instance.roomViewStore,
                    });

                    // Collapse all sections
                    viewModel.getSectionHeaderViewModel(DefaultTagID.Favourite).isExpanded = false;
                    viewModel.getSectionHeaderViewModel(CHATS_TAG).isExpanded = false;
                    viewModel.getSectionHeaderViewModel(DefaultTagID.LowPriority).isExpanded = false;

                    const dispatchSpy = jest.spyOn(dispatcher, "dispatch");
                    RoomListStoreV3.instance.emit(RoomListStoreV3Event.ListsUpdate);

                    expect(dispatchSpy).toHaveBeenCalledWith({
                        action: Action.RoomListSectionsCollapseStateChanged,
                        collapseSections: "collapse",
                    });
                });

                it.each([
                    { label: "flat list", chatsRooms: true },
                    { label: "empty room list", chatsRooms: false },
                ])("should dispatch collapseSection=undefined when it is a $label", ({ chatsRooms }) => {
                    jest.spyOn(RoomListStoreV3.instance, "getSortedRoomsInActiveSpace").mockReturnValue({
                        spaceId: "home",
                        sections: [
                            { tag: DefaultTagID.Favourite, rooms: [] },
                            { tag: CHATS_TAG, rooms: chatsRooms ? [regularRoom1] : [] },
                            { tag: DefaultTagID.LowPriority, rooms: [] },
                        ],
                    });
                    viewModel = new RoomListViewModel({
                        client: matrixClient,
                        spaceStore: SDKContextClass.instance.spaceStore,
                        roomViewStore: SDKContextClass.instance.roomViewStore,
                    });

                    const dispatchSpy = jest.spyOn(dispatcher, "dispatch");
                    RoomListStoreV3.instance.emit(RoomListStoreV3Event.ListsUpdate);

                    expect(dispatchSpy).toHaveBeenCalledWith({
                        action: Action.RoomListSectionsCollapseStateChanged,
                        collapseSections: undefined,
                    });
                });
            });

            it("should apply sticky room within the correct section", async () => {
                stubClient();
                viewModel = new RoomListViewModel({
                    client: matrixClient,
                    spaceStore: SDKContextClass.instance.spaceStore,
                    roomViewStore: SDKContextClass.instance.roomViewStore,
                });

                // Select favRoom1 (index 0 globally, index 0 in favourites section)
                jest.spyOn(SDKContextClass.instance.roomViewStore, "getRoomId").mockReturnValue("!fav1:server");
                dispatcher.dispatch({
                    action: Action.ActiveRoomChanged,
                    newRoomId: "!fav1:server",
                });
                await flushPromisesWithFakeTimers();

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

            describe("Drag and drop", () => {
                beforeEach(() => {
                    viewModel = new RoomListViewModel({
                        client: matrixClient,
                        spaceStore: SDKContextClass.instance.spaceStore,
                        roomViewStore: SDKContextClass.instance.roomViewStore,
                    });
                    // Ensure section header VMs are created before tests that interact with them
                    viewModel.getSectionHeaderViewModel(DefaultTagID.Favourite);
                    viewModel.getSectionHeaderViewModel(CHATS_TAG);
                    viewModel.getSectionHeaderViewModel(DefaultTagID.LowPriority);
                });

                it("should delegate changeSectionOrder to RoomListStoreV3.reorderSection", async () => {
                    const reorderSpy = jest
                        .spyOn(RoomListStoreV3.instance, "reorderSection")
                        .mockResolvedValue(undefined);

                    await viewModel.changeSectionOrder(DefaultTagID.Favourite, CHATS_TAG);

                    expect(reorderSpy).toHaveBeenCalledWith(DefaultTagID.Favourite, CHATS_TAG);
                });

                it("should scroll the moved section back into view after reordering", async () => {
                    jest.spyOn(RoomListStoreV3.instance, "reorderSection").mockResolvedValue(undefined);

                    await viewModel.changeSectionOrder(DefaultTagID.Favourite, CHATS_TAG);
                    expect(viewModel.getSnapshot().roomListState.scrollToSectionTag).toBe(DefaultTagID.Favourite);
                });

                it("should collapse every section on drag start", () => {
                    expect(viewModel.getSectionHeaderViewModel(DefaultTagID.Favourite).isExpanded).toBe(true);

                    viewModel.onSectionDragStart();

                    expect(viewModel.getSectionHeaderViewModel(DefaultTagID.Favourite).isExpanded).toBe(false);
                    expect(viewModel.getSectionHeaderViewModel(CHATS_TAG).isExpanded).toBe(false);
                    expect(viewModel.getSectionHeaderViewModel(DefaultTagID.LowPriority).isExpanded).toBe(false);

                    for (const section of viewModel.getSnapshot().sections) {
                        expect(section.roomIds).toEqual([]);
                    }
                });

                it("should restore the pre-drag expansion state on drag end", () => {
                    // Collapse Favourite before the drag; other sections remain expanded
                    viewModel.getSectionHeaderViewModel(DefaultTagID.Favourite).onClick();

                    viewModel.onSectionDragStart();
                    viewModel.onSectionDragEnd();

                    expect(viewModel.getSectionHeaderViewModel(DefaultTagID.Favourite).isExpanded).toBe(false);
                    expect(viewModel.getSectionHeaderViewModel(CHATS_TAG).isExpanded).toBe(true);
                    expect(viewModel.getSectionHeaderViewModel(DefaultTagID.LowPriority).isExpanded).toBe(true);

                    const snapshot = viewModel.getSnapshot();
                    expect(snapshot.sections.find((s) => s.id === DefaultTagID.Favourite)!.roomIds).toEqual([]);
                    expect(snapshot.sections.find((s) => s.id === CHATS_TAG)!.roomIds).toEqual([
                        "!reg1:server",
                        "!reg2:server",
                    ]);
                    expect(snapshot.sections.find((s) => s.id === DefaultTagID.LowPriority)!.roomIds).toEqual([
                        "!low1:server",
                    ]);
                });

                it("should re-snapshot expansion state on each drag start", () => {
                    // First cycle: Favourite is collapsed before the drag
                    viewModel.getSectionHeaderViewModel(DefaultTagID.Favourite).onClick();
                    viewModel.onSectionDragStart();
                    viewModel.onSectionDragEnd();

                    // Between cycles: collapse CHATS_TAG as well
                    viewModel.getSectionHeaderViewModel(CHATS_TAG).onClick();
                    viewModel.onSectionDragStart();
                    viewModel.onSectionDragEnd();

                    // The second drag end must restore the state captured at the second drag start
                    // (Favourite collapsed, CHATS_TAG collapsed, LowPriority expanded), not the first cycle's snapshot.
                    expect(viewModel.getSectionHeaderViewModel(DefaultTagID.Favourite).isExpanded).toBe(false);
                    expect(viewModel.getSectionHeaderViewModel(CHATS_TAG).isExpanded).toBe(false);
                    expect(viewModel.getSectionHeaderViewModel(DefaultTagID.LowPriority).isExpanded).toBe(true);
                });

                it("should be a no-op when drag end is called without drag start", () => {
                    viewModel.onSectionDragEnd();

                    expect(viewModel.getSectionHeaderViewModel(DefaultTagID.Favourite).isExpanded).toBe(true);
                    expect(viewModel.getSectionHeaderViewModel(CHATS_TAG).isExpanded).toBe(true);
                    expect(viewModel.getSectionHeaderViewModel(DefaultTagID.LowPriority).isExpanded).toBe(true);

                    const snapshot = viewModel.getSnapshot();
                    expect(snapshot.sections.find((s) => s.id === DefaultTagID.Favourite)!.roomIds).toEqual([
                        "!fav1:server",
                        "!fav2:server",
                    ]);
                    expect(snapshot.sections.find((s) => s.id === CHATS_TAG)!.roomIds).toEqual([
                        "!reg1:server",
                        "!reg2:server",
                    ]);
                    expect(snapshot.sections.find((s) => s.id === DefaultTagID.LowPriority)!.roomIds).toEqual([
                        "!low1:server",
                    ]);
                });
            });
        });
    });

    describe("changeRoomSection", () => {
        beforeEach(() => {
            viewModel = new RoomListViewModel({
                client: matrixClient,
                spaceStore: SDKContextClass.instance.spaceStore,
                roomViewStore: SDKContextClass.instance.roomViewStore,
            });
            mocked(tagRoom).mockClear();
        });

        it("should call tagRoom with the room and target tag", () => {
            jest.spyOn(matrixClient, "getRoom").mockReturnValue(room1);
            mocked(getSectionTagForRoom).mockReturnValue(null);

            viewModel.changeRoomSection(room1.roomId, DefaultTagID.Favourite);

            expect(tagRoom).toHaveBeenCalledWith(room1, DefaultTagID.Favourite);
        });

        it("should do nothing when the room is not found", () => {
            jest.spyOn(matrixClient, "getRoom").mockReturnValue(null);

            viewModel.changeRoomSection("!unknown:server", DefaultTagID.Favourite);

            expect(tagRoom).not.toHaveBeenCalled();
        });

        it("should do nothing when the room is already in the target section", () => {
            jest.spyOn(matrixClient, "getRoom").mockReturnValue(room1);
            mocked(getSectionTagForRoom).mockReturnValue(DefaultTagID.Favourite);

            viewModel.changeRoomSection(room1.roomId, DefaultTagID.Favourite);

            expect(tagRoom).not.toHaveBeenCalled();
        });
    });

    describe("show_room_tile scroll", () => {
        beforeEach(() => {
            // Dispatching ViewRoom is also handled by the global RoomViewStore, which calls
            // MatrixClientPeg.safeGet(); stubClient sets up the peg so that doesn't throw.
            stubClient();
        });

        it("should scroll a room into view in a flat list", async () => {
            viewModel = new RoomListViewModel({
                client: matrixClient,
                roomViewStore: sdkContext.roomViewStore,
                spaceStore: sdkContext.spaceStore,
            });
            const scrollSpy = jest.fn();
            viewModel.setScrollToIndex(scrollSpy);

            dispatcher.dispatch({
                action: Action.ViewRoom,
                room_id: "!room2:server",
                show_room_tile: true,
                metricsTrigger: undefined,
            });

            // Flat list: entry index == room index.
            await waitFor(() => expect(scrollSpy).toHaveBeenCalledWith(1));
        });

        it("should scroll a room into view in a grouped list, accounting for section headers", async () => {
            const favRoom1 = mkStubRoom("!fav1:server", "Fav 1", matrixClient);
            const favRoom2 = mkStubRoom("!fav2:server", "Fav 2", matrixClient);
            const regularRoom1 = mkStubRoom("!reg1:server", "Reg 1", matrixClient);
            jest.spyOn(RoomListStoreV3.instance, "getSortedRoomsInActiveSpace").mockReturnValue({
                spaceId: "home",
                sections: [
                    { tag: DefaultTagID.Favourite, rooms: [favRoom1, favRoom2] },
                    { tag: CHATS_TAG, rooms: [regularRoom1] },
                ],
            });
            viewModel = new RoomListViewModel({
                client: matrixClient,
                roomViewStore: sdkContext.roomViewStore,
                spaceStore: sdkContext.spaceStore,
            });
            const scrollSpy = jest.fn();
            viewModel.setScrollToIndex(scrollSpy);

            dispatcher.dispatch({
                action: Action.ViewRoom,
                room_id: "!reg1:server",
                show_room_tile: true,
                metricsTrigger: undefined,
            });

            // Entry space: [Fav header(0), fav1(1), fav2(2), Chats header(3), reg1(4)]
            await waitFor(() => expect(scrollSpy).toHaveBeenCalledWith(4));
        });

        it("should not scroll when the room is not in the current list", async () => {
            viewModel = new RoomListViewModel({
                client: matrixClient,
                roomViewStore: sdkContext.roomViewStore,
                spaceStore: sdkContext.spaceStore,
            });
            const scrollSpy = jest.fn();
            viewModel.setScrollToIndex(scrollSpy);

            dispatcher.dispatch({
                action: Action.ViewRoom,
                room_id: "!room3:server",
                show_room_tile: true,
                metricsTrigger: undefined,
            });

            await waitFor(() => expect(scrollSpy).toHaveBeenCalledWith(2));
            expect(scrollSpy).toHaveBeenCalledTimes(1);
        });
    });
});

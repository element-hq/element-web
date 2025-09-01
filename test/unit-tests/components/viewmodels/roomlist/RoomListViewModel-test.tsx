/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { range } from "lodash";
import { act, renderHook, waitFor } from "jest-matrix-react";
import { mocked } from "jest-mock";

import RoomListStoreV3, { LISTS_UPDATE_EVENT } from "../../../../../src/stores/room-list-v3/RoomListStoreV3";
import { mkStubRoom } from "../../../../test-utils";
import { useRoomListViewModel } from "../../../../../src/components/viewmodels/roomlist/RoomListViewModel";
import { FilterKey } from "../../../../../src/stores/room-list-v3/skip-list/filters";
import { hasCreateRoomRights, createRoom } from "../../../../../src/components/viewmodels/roomlist/utils";
import dispatcher from "../../../../../src/dispatcher/dispatcher";
import { Action } from "../../../../../src/dispatcher/actions";
import { SdkContextClass } from "../../../../../src/contexts/SDKContext";
import SpaceStore from "../../../../../src/stores/spaces/SpaceStore";
import { UPDATE_SELECTED_SPACE } from "../../../../../src/stores/spaces";

jest.mock("../../../../../src/components/viewmodels/roomlist/utils", () => ({
    hasCreateRoomRights: jest.fn().mockReturnValue(false),
    createRoom: jest.fn(),
}));

describe("RoomListViewModel", () => {
    function mockAndCreateRooms() {
        const rooms = range(10).map((i) => mkStubRoom(`foo${i}:matrix.org`, `Foo ${i}`, undefined));
        const fn = jest
            .spyOn(RoomListStoreV3.instance, "getSortedRoomsInActiveSpace")
            .mockImplementation(() => ({ spaceId: "home", rooms: [...rooms] }));
        return { rooms, fn };
    }

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it("should return a list of rooms", async () => {
        const { rooms } = mockAndCreateRooms();
        const { result: vm } = renderHook(() => useRoomListViewModel());

        expect(vm.current.roomsResult.rooms).toHaveLength(10);
        for (const room of rooms) {
            expect(vm.current.roomsResult.rooms).toContain(room);
        }
    });

    it("should update list of rooms on event from room list store", async () => {
        const { rooms } = mockAndCreateRooms();
        const { result: vm } = renderHook(() => useRoomListViewModel());

        const newRoom = mkStubRoom("bar:matrix.org", "Bar", undefined);
        rooms.push(newRoom);
        await act(() => RoomListStoreV3.instance.emit(LISTS_UPDATE_EVENT));

        await waitFor(() => {
            expect(vm.current.roomsResult.rooms).toContain(newRoom);
        });
    });

    describe("Filters", () => {
        it("should provide list of available filters", () => {
            mockAndCreateRooms();
            const { result: vm } = renderHook(() => useRoomListViewModel());
            // should have 6 filters
            expect(vm.current.primaryFilters).toHaveLength(7);
            // check the order
            for (const [i, name] of [
                "Unreads",
                "People",
                "Rooms",
                "Mentions",
                "Invites",
                "Favourites",
                "Low priority",
            ].entries()) {
                expect(vm.current.primaryFilters[i].name).toEqual(name);
                expect(vm.current.primaryFilters[i].active).toEqual(false);
            }
        });

        it("should get filtered rooms from RLS on toggle", () => {
            const { fn } = mockAndCreateRooms();
            const { result: vm } = renderHook(() => useRoomListViewModel());
            // Let's say we toggle the People toggle
            const i = vm.current.primaryFilters.findIndex((f) => f.name === "People");
            act(() => {
                vm.current.primaryFilters[i].toggle();
            });
            expect(fn).toHaveBeenCalledWith([FilterKey.PeopleFilter]);
            expect(vm.current.primaryFilters[i].active).toEqual(true);
        });

        it("should change active property on toggle", () => {
            mockAndCreateRooms();
            const { result: vm } = renderHook(() => useRoomListViewModel());
            // Let's say we toggle the People filter
            const i = vm.current.primaryFilters.findIndex((f) => f.name === "People");
            expect(vm.current.primaryFilters[i].active).toEqual(false);
            act(() => {
                vm.current.primaryFilters[i].toggle();
            });
            expect(vm.current.primaryFilters[i].active).toEqual(true);

            // Let's say that we toggle the Favourite filter
            const j = vm.current.primaryFilters.findIndex((f) => f.name === "Favourites");
            act(() => {
                vm.current.primaryFilters[j].toggle();
            });
            expect(vm.current.primaryFilters[i].active).toEqual(false);
            expect(vm.current.primaryFilters[j].active).toEqual(true);
        });

        it("should return the current active primary filter", async () => {
            // Let's say that the user's preferred sorting is alphabetic
            mockAndCreateRooms();
            const { result: vm } = renderHook(() => useRoomListViewModel());
            // Toggle people filter
            const i = vm.current.primaryFilters.findIndex((f) => f.name === "People");
            expect(vm.current.primaryFilters[i].active).toEqual(false);
            act(() => vm.current.primaryFilters[i].toggle());

            // The active primary filter should be the People filter
            expect(vm.current.activePrimaryFilter).toEqual(vm.current.primaryFilters[i]);
        });

        it("should remove all filters when active space is changed", async () => {
            mockAndCreateRooms();
            const { result: vm } = renderHook(() => useRoomListViewModel());

            // Let's first toggle the People filter
            const i = vm.current.primaryFilters.findIndex((f) => f.name === "People");
            act(() => {
                vm.current.primaryFilters[i].toggle();
            });
            expect(vm.current.primaryFilters[i].active).toEqual(true);

            // Simulate a space change
            await act(() => SpaceStore.instance.emit(UPDATE_SELECTED_SPACE));

            // Primary filer should have been unapplied
            expect(vm.current.activePrimaryFilter).toEqual(undefined);
        });
    });

    describe("Create room and chat", () => {
        it("should be canCreateRoom=false if hasCreateRoomRights=false", () => {
            mocked(hasCreateRoomRights).mockReturnValue(false);
            const { result } = renderHook(() => useRoomListViewModel());
            expect(result.current.canCreateRoom).toBe(false);
        });

        it("should be canCreateRoom=true if hasCreateRoomRights=true", () => {
            mocked(hasCreateRoomRights).mockReturnValue(true);
            const { result } = renderHook(() => useRoomListViewModel());
            expect(result.current.canCreateRoom).toBe(true);
        });

        it("should call createRoom", () => {
            const { result } = renderHook(() => useRoomListViewModel());
            result.current.createRoom();
            expect(mocked(createRoom)).toHaveBeenCalled();
        });

        it("should dispatch Action.CreateChat", () => {
            const spy = jest.spyOn(dispatcher, "fire");
            const { result } = renderHook(() => useRoomListViewModel());
            result.current.createChatRoom();
            expect(spy).toHaveBeenCalledWith(Action.CreateChat);
        });
    });

    describe("Sticky room and active index", () => {
        function expectActiveRoom(vm: ReturnType<typeof useRoomListViewModel>, i: number, roomId: string) {
            expect(vm.activeIndex).toEqual(i);
            expect(vm.roomsResult.rooms[i].roomId).toEqual(roomId);
        }

        it("active index is calculated with the last opened room in a space", () => {
            // Let's say there's two spaces: !space1:matrix.org and !space2:matrix.org
            // Let's also say that the current active space is !space1:matrix.org
            let currentSpace = "!space1:matrix.org";
            jest.spyOn(SpaceStore.instance, "activeSpace", "get").mockImplementation(() => currentSpace);

            const rooms = range(10).map((i) => mkStubRoom(`foo${i}:matrix.org`, `Foo ${i}`, undefined));
            // Let's say all the rooms are in space1
            const roomsInSpace1 = { spaceId: currentSpace, rooms: [...rooms] };
            // Let's say all rooms with even index are in space 2
            const roomsInSpace2 = { spaceId: "!space2:matrix.org", rooms: [...rooms].filter((_, i) => i % 2 === 0) };
            jest.spyOn(RoomListStoreV3.instance, "getSortedRoomsInActiveSpace").mockImplementation(() =>
                currentSpace === "!space1:matrix.org" ? roomsInSpace1 : roomsInSpace2,
            );

            // Let's say that the room at index 4 is currently active
            const roomId = rooms[4].roomId;
            jest.spyOn(SdkContextClass.instance.roomViewStore, "getRoomId").mockImplementation(() => roomId);

            const { result: vm } = renderHook(() => useRoomListViewModel());
            expect(vm.current.activeIndex).toEqual(4);

            // Let's say that space is changed to "!space2:matrix.org"
            currentSpace = "!space2:matrix.org";
            // Let's say that room[6] is active in space 2
            const activeRoomIdInSpace2 = rooms[6].roomId;
            jest.spyOn(SpaceStore.instance, "getLastSelectedRoomIdForSpace").mockImplementation(
                () => activeRoomIdInSpace2,
            );
            act(() => {
                RoomListStoreV3.instance.emit(LISTS_UPDATE_EVENT);
            });

            // Active index should be 3 even without the room change event.
            expectActiveRoom(vm.current, 3, activeRoomIdInSpace2);
        });

        it("active room and active index are retained on order change", () => {
            const { rooms } = mockAndCreateRooms();

            // Let's say that the room at index 5 is active
            const roomId = rooms[5].roomId;
            jest.spyOn(SdkContextClass.instance.roomViewStore, "getRoomId").mockImplementation(() => roomId);

            const { result: vm } = renderHook(() => useRoomListViewModel());
            expect(vm.current.activeIndex).toEqual(5);

            // Let's say that room at index 9 moves to index 5
            const room9 = rooms[9];
            rooms.splice(9, 1);
            rooms.splice(5, 0, room9);
            act(() => RoomListStoreV3.instance.emit(LISTS_UPDATE_EVENT));

            // Active room index should still be 5
            expectActiveRoom(vm.current, 5, roomId);

            // Let's add 2 new rooms from index 0
            const newRoom1 = mkStubRoom("bar1:matrix.org", "Bar 1", undefined);
            const newRoom2 = mkStubRoom("bar2:matrix.org", "Bar 2", undefined);
            rooms.unshift(newRoom1, newRoom2);
            act(() => RoomListStoreV3.instance.emit(LISTS_UPDATE_EVENT));

            // Active room index should still be 5
            expectActiveRoom(vm.current, 5, roomId);
        });

        it("active room and active index are updated when another room is opened", () => {
            const { rooms } = mockAndCreateRooms();
            const roomId = rooms[5].roomId;
            jest.spyOn(SdkContextClass.instance.roomViewStore, "getRoomId").mockImplementation(() => roomId);

            const { result: vm } = renderHook(() => useRoomListViewModel());
            expectActiveRoom(vm.current, 5, roomId);

            // Let's say that room at index 9 becomes active
            const room = rooms[9];
            act(() => {
                dispatcher.dispatch(
                    {
                        action: Action.ActiveRoomChanged,
                        oldRoomId: null,
                        newRoomId: room.roomId,
                    },
                    true,
                );
            });

            // Active room index should change to reflect new room
            expectActiveRoom(vm.current, 9, room.roomId);
        });

        it("active room and active index are updated when active index spills out of rooms array bounds", () => {
            const { rooms } = mockAndCreateRooms();
            // Let's say that the room at index 5 is active
            const roomId = rooms[5].roomId;
            jest.spyOn(SdkContextClass.instance.roomViewStore, "getRoomId").mockImplementation(() => roomId);

            const { result: vm } = renderHook(() => useRoomListViewModel());
            expectActiveRoom(vm.current, 5, roomId);

            // Let's say that we remove rooms from the start of the array
            for (let i = 0; i < 4; ++i) {
                // We should be able to do 4 deletions before we run out of rooms
                rooms.splice(0, 1);
                act(() => RoomListStoreV3.instance.emit(LISTS_UPDATE_EVENT));
                expectActiveRoom(vm.current, 5, roomId);
            }

            // If we remove one more room from the start, there's not going to be enough rooms
            // to maintain the active index.
            rooms.splice(0, 1);
            act(() => RoomListStoreV3.instance.emit(LISTS_UPDATE_EVENT));
            expectActiveRoom(vm.current, 0, roomId);
        });

        it("active room and active index are retained when rooms that appear after the active room are deleted", () => {
            const { rooms } = mockAndCreateRooms();
            // Let's say that the room at index 5 is active
            const roomId = rooms[5].roomId;
            jest.spyOn(SdkContextClass.instance.roomViewStore, "getRoomId").mockImplementation(() => roomId);

            const { result: vm } = renderHook(() => useRoomListViewModel());
            expectActiveRoom(vm.current, 5, roomId);

            // Let's say that we remove rooms from the start of the array
            for (let i = 0; i < 4; ++i) {
                // Deleting rooms after index 5 (active) should not update the active index
                rooms.splice(6, 1);
                act(() => RoomListStoreV3.instance.emit(LISTS_UPDATE_EVENT));
                expectActiveRoom(vm.current, 5, roomId);
            }
        });

        it("active room index becomes undefined when active room is deleted", () => {
            const { rooms } = mockAndCreateRooms();
            // Let's say that the room at index 5 is active
            let roomId: string | undefined = rooms[5].roomId;
            jest.spyOn(SdkContextClass.instance.roomViewStore, "getRoomId").mockImplementation(() => roomId);

            const { result: vm } = renderHook(() => useRoomListViewModel());
            expectActiveRoom(vm.current, 5, roomId);

            // Let's remove the active room (i.e room at index 5)
            rooms.splice(5, 1);
            roomId = undefined;
            act(() => RoomListStoreV3.instance.emit(LISTS_UPDATE_EVENT));
            expect(vm.current.activeIndex).toBeUndefined();
        });

        it("active room index is initially undefined", () => {
            mockAndCreateRooms();

            // Let's say that there's no active room currently
            jest.spyOn(SdkContextClass.instance.roomViewStore, "getRoomId").mockImplementation(() => undefined);

            const { result: vm } = renderHook(() => useRoomListViewModel());
            expect(vm.current.activeIndex).toEqual(undefined);
        });
    });
});

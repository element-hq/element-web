/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { range } from "lodash";
import { act, renderHook, waitFor } from "jest-matrix-react";

import RoomListStoreV3 from "../../../../../src/stores/room-list-v3/RoomListStoreV3";
import { mkStubRoom } from "../../../../test-utils";
import { LISTS_UPDATE_EVENT } from "../../../../../src/stores/room-list/SlidingRoomListStore";
import { useRoomListViewModel } from "../../../../../src/components/viewmodels/roomlist/RoomListViewModel";
import dispatcher from "../../../../../src/dispatcher/dispatcher";
import { Action } from "../../../../../src/dispatcher/actions";
import { FilterKey } from "../../../../../src/stores/room-list-v3/skip-list/filters";

describe("RoomListViewModel", () => {
    function mockAndCreateRooms() {
        const rooms = range(10).map((i) => mkStubRoom(`foo${i}:matrix.org`, `Foo ${i}`, undefined));
        const fn = jest
            .spyOn(RoomListStoreV3.instance, "getSortedRoomsInActiveSpace")
            .mockImplementation(() => [...rooms]);
        return { rooms, fn };
    }

    it("should return a list of rooms", async () => {
        const { rooms } = mockAndCreateRooms();
        const { result: vm } = renderHook(() => useRoomListViewModel());

        expect(vm.current.rooms).toHaveLength(10);
        for (const room of rooms) {
            expect(vm.current.rooms).toContain(room);
        }
    });

    it("should update list of rooms on event from room list store", async () => {
        const { rooms } = mockAndCreateRooms();
        const { result: vm } = renderHook(() => useRoomListViewModel());

        const newRoom = mkStubRoom("bar:matrix.org", "Bar", undefined);
        rooms.push(newRoom);
        act(() => RoomListStoreV3.instance.emit(LISTS_UPDATE_EVENT));

        await waitFor(() => {
            expect(vm.current.rooms).toContain(newRoom);
        });
    });

    it("should dispatch view room action on openRoom", async () => {
        const { rooms } = mockAndCreateRooms();
        const { result: vm } = renderHook(() => useRoomListViewModel());

        const fn = jest.spyOn(dispatcher, "dispatch");
        act(() => vm.current.openRoom(rooms[7].roomId));
        expect(fn).toHaveBeenCalledWith(
            expect.objectContaining({
                action: Action.ViewRoom,
                room_id: rooms[7].roomId,
                metricsTrigger: "RoomList",
            }),
        );
    });

    describe("Filters", () => {
        it("should provide list of available filters", () => {
            mockAndCreateRooms();
            const { result: vm } = renderHook(() => useRoomListViewModel());
            // should have 4 filters
            expect(vm.current.primaryFilters).toHaveLength(4);
            // check the order
            for (const [i, name] of ["Unread", "Favourites", "People", "Rooms"].entries()) {
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
    });
});

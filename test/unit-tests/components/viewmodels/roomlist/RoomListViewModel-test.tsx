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
import { FilterKey } from "../../../../../src/stores/room-list-v3/skip-list/filters";
import { SecondaryFilters } from "../../../../../src/components/viewmodels/roomlist/useFilteredRooms";

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

        it("should select all activity as default secondary filter", () => {
            mockAndCreateRooms();
            const { result: vm } = renderHook(() => useRoomListViewModel());

            // By default, all activity should be the active secondary filter
            expect(vm.current.activeSecondaryFilter).toEqual(SecondaryFilters.AllActivity);
        });

        it("should be able to filter using secondary filters", () => {
            const { fn } = mockAndCreateRooms();
            const { result: vm } = renderHook(() => useRoomListViewModel());

            // Let's say we toggle the mentions secondary filter
            act(() => {
                vm.current.activateSecondaryFilter(SecondaryFilters.MentionsOnly);
            });
            expect(fn).toHaveBeenCalledWith([FilterKey.MentionsFilter]);
        });

        it("primary filters are applied on top of secondary filers", () => {
            const { fn } = mockAndCreateRooms();
            const { result: vm } = renderHook(() => useRoomListViewModel());

            // Let's say we toggle the mentions secondary filter
            act(() => {
                vm.current.activateSecondaryFilter(SecondaryFilters.MentionsOnly);
            });

            // Let's say we toggle the People filter
            const i = vm.current.primaryFilters.findIndex((f) => f.name === "People");
            act(() => {
                vm.current.primaryFilters[i].toggle();
            });

            // RLS call must include both these filters
            expect(fn).toHaveBeenLastCalledWith(
                expect.arrayContaining([FilterKey.PeopleFilter, FilterKey.MentionsFilter]),
            );
        });

        const testcases: Array<[string, { secondary: SecondaryFilters; filterKey: FilterKey }, string]> = [
            [
                "Mentions only",
                { secondary: SecondaryFilters.MentionsOnly, filterKey: FilterKey.MentionsFilter },
                "Unread",
            ],
            ["Invites only", { secondary: SecondaryFilters.InvitesOnly, filterKey: FilterKey.InvitesFilter }, "Unread"],
            [
                "Invites only",
                { secondary: SecondaryFilters.InvitesOnly, filterKey: FilterKey.InvitesFilter },
                "Favourites",
            ],
            [
                "Low priority",
                { secondary: SecondaryFilters.LowPriority, filterKey: FilterKey.LowPriorityFilter },
                "Favourites",
            ],
        ];

        describe.each(testcases)("For secondary filter: %s", (secondaryFilterName, secondary, primaryFilterName) => {
            it(`should unapply incompatible primary filter that is already active: ${primaryFilterName}`, () => {
                const { fn } = mockAndCreateRooms();
                const { result: vm } = renderHook(() => useRoomListViewModel());

                // Apply the primary filter
                const i = vm.current.primaryFilters.findIndex((f) => f.name === primaryFilterName);
                act(() => {
                    vm.current.primaryFilters[i].toggle();
                });

                // Apply the secondary filter
                act(() => {
                    vm.current.activateSecondaryFilter(secondary.secondary);
                });

                // RLS call should only include the secondary filter
                expect(fn).toHaveBeenLastCalledWith([secondary.filterKey]);
                // Primary filter should have been unapplied
                expect(vm.current.primaryFilters[i].active).toEqual(false);
            });

            it(`should hide incompatible primary filter: ${primaryFilterName}`, () => {
                mockAndCreateRooms();
                const { result: vm } = renderHook(() => useRoomListViewModel());

                // Apply the secondary filter
                act(() => {
                    vm.current.activateSecondaryFilter(secondary.secondary);
                });

                // Incompatible primary filter must be hidden
                expect(vm.current.primaryFilters.find((f) => f.name === primaryFilterName)).toBeUndefined();
            });
        });
    });
});

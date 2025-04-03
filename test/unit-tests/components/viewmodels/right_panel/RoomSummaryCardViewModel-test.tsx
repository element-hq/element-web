/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { range } from "lodash";
import { act, renderHook, waitFor } from "jest-matrix-react";
import { mocked } from "jest-mock";

import RoomListStoreV3 from "../../../../../src/stores/room-list-v3/RoomListStoreV3";
import { mkStubRoom } from "../../../../test-utils";
import { LISTS_UPDATE_EVENT } from "../../../../../src/stores/room-list/RoomListStore";
import { useRoomListViewModel } from "../../../../../src/components/viewmodels/roomlist/RoomListViewModel";
import { FilterKey } from "../../../../../src/stores/room-list-v3/skip-list/filters";
import { SecondaryFilters } from "../../../../../src/components/viewmodels/roomlist/useFilteredRooms";
import { SortingAlgorithm } from "../../../../../src/stores/room-list-v3/skip-list/sorters";
import { SortOption } from "../../../../../src/components/viewmodels/roomlist/useSorter";
import SettingsStore from "../../../../../src/settings/SettingsStore";
import { hasCreateRoomRights, createRoom } from "../../../../../src/components/viewmodels/roomlist/utils";
import dispatcher from "../../../../../src/dispatcher/dispatcher";
import { Action } from "../../../../../src/dispatcher/actions";
import { SdkContextClass } from "../../../../../src/contexts/SDKContext";

jest.mock("../../../../../src/components/viewmodels/roomlist/utils", () => ({
    hasCreateRoomRights: jest.fn().mockReturnValue(false),
    createRoom: jest.fn(),
}));

describe("RoomSummaryCardViewModel", () => {
    function mockAndCreateRooms() {
        const rooms = range(10).map((i) => mkStubRoom(`foo${i}:matrix.org`, `Foo ${i}`, undefined));
        const fn = jest
            .spyOn(RoomListStoreV3.instance, "getSortedRoomsInActiveSpace")
            .mockImplementation(() => [...rooms]);
        return { rooms, fn };
    }

    afterEach(() => {
        jest.restoreAllMocks();
    });

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

    it("opens room export dialog on button click", () => {
        const { getByText } = getComponent();

        fireEvent.click(getByText(_t("export_chat|title")));

        expect(Modal.createDialog).toHaveBeenCalledWith(ExportDialog, { room });
    });

    it("opens share room dialog on button click", () => {
        const { getByText } = getComponent();

        fireEvent.click(getByText(_t("action|copy_link")));

        expect(Modal.createDialog).toHaveBeenCalledWith(ShareDialog, { target: room });
    });

    it("opens invite dialog on button click", () => {
        const { getByText } = getComponent();

        fireEvent.click(getByText(_t("action|invite")));

        expect(defaultDispatcher.dispatch).toHaveBeenCalledWith({ action: "view_invite", roomId: room.roomId });
    });

    it("fires favourite dispatch on button click", () => {
        const { getByText } = getComponent();

        fireEvent.click(getByText(_t("room|context_menu|favourite")));

        expect(tagRoom).toHaveBeenCalledWith(room, DefaultTagID.Favourite);
    });

    it("opens room settings on button click", () => {
        const { getByText } = getComponent();

        fireEvent.click(getByText(_t("common|settings")));

        expect(defaultDispatcher.dispatch).toHaveBeenCalledWith({ action: "open_room_settings" });
    });

    it("opens room member list on button click", () => {
        const { getByText } = getComponent();

        fireEvent.click(getByText("People"));

        expect(RightPanelStore.instance.pushCard).toHaveBeenCalledWith({ phase: RightPanelPhases.MemberList }, true);
    });

    it("opens room threads list on button click", () => {
        const { getByText } = getComponent();

        fireEvent.click(getByText("Threads"));

        expect(RightPanelStore.instance.pushCard).toHaveBeenCalledWith({ phase: RightPanelPhases.ThreadPanel }, true);
    });

    it("opens room pinned messages on button click", () => {
        const { getByText } = getComponent();

        fireEvent.click(getByText("Pinned messages"));

        expect(RightPanelStore.instance.pushCard).toHaveBeenCalledWith(
            { phase: RightPanelPhases.PinnedMessages },
            true,
        );
    });

    describe("search", () => {
        it("should empty search field when the timeline rendering type changes away", async () => {
            const onSearchChange = jest.fn();
            const { rerender } = render(
                <MatrixClientContext.Provider value={mockClient}>
                    <ScopedRoomContextProvider {...({ timelineRenderingType: TimelineRenderingType.Search } as any)}>
                        <RoomSummaryCard
                            room={room}
                            permalinkCreator={new RoomPermalinkCreator(room)}
                            onSearchChange={onSearchChange}
                            focusRoomSearch={true}
                        />
                    </ScopedRoomContextProvider>
                </MatrixClientContext.Provider>,
            );

            await userEvent.type(screen.getByPlaceholderText("Search messages…"), "test");
            expect(screen.getByPlaceholderText("Search messages…")).toHaveValue("test");

            rerender(
                <MatrixClientContext.Provider value={mockClient}>
                    <ScopedRoomContextProvider {...({ timelineRenderingType: TimelineRenderingType.Room } as any)}>
                        <RoomSummaryCard
                            room={room}
                            permalinkCreator={new RoomPermalinkCreator(room)}
                            onSearchChange={onSearchChange}
                        />
                    </ScopedRoomContextProvider>
                </MatrixClientContext.Provider>,
            );
            expect(screen.getByPlaceholderText("Search messages…")).toHaveValue("");
        });
    });
});


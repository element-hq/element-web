/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { act } from "react";
import { render, screen } from "jest-matrix-react";
import userEvent from "@testing-library/user-event";

import { type RoomListViewState } from "../../../../../../src/components/viewmodels/roomlist/RoomListViewModel";
import { RoomListPrimaryFilters } from "../../../../../../src/components/views/rooms/RoomListPanel/RoomListPrimaryFilters";
import { FilterKey } from "../../../../../../src/stores/room-list-v3/skip-list/filters";

describe("<RoomListPrimaryFilters />", () => {
    let vm: RoomListViewState;
    const filterToggleMocks = [jest.fn(), jest.fn(), jest.fn()];

    let resizeCallback: ResizeObserverCallback;

    beforeEach(() => {
        // Reset mocks between tests
        filterToggleMocks.forEach((mock) => mock.mockClear());

        // Mock ResizeObserver
        global.ResizeObserver = jest.fn().mockImplementation((callback) => {
            resizeCallback = callback;
            return {
                observe: jest.fn(),
                unobserve: jest.fn(),
                disconnect: jest.fn(),
            };
        });

        vm = {
            primaryFilters: [
                { name: "People", active: false, toggle: filterToggleMocks[0], key: FilterKey.PeopleFilter },
                { name: "Rooms", active: true, toggle: filterToggleMocks[1], key: FilterKey.RoomsFilter },
                { name: "Unreads", active: false, toggle: filterToggleMocks[2], key: FilterKey.UnreadFilter },
            ],
        } as unknown as RoomListViewState;
    });

    it("should renders all filters correctly", () => {
        const { asFragment } = render(<RoomListPrimaryFilters vm={vm} />);

        // Check that all filters are rendered
        expect(screen.getByRole("option", { name: "People" })).toBeInTheDocument();
        expect(screen.getByRole("option", { name: "Rooms" })).toBeInTheDocument();
        expect(screen.getByRole("option", { name: "Unreads" })).toBeInTheDocument();

        // Check that the active filter is marked as selected
        expect(screen.getByRole("option", { name: "Rooms" })).toHaveAttribute("aria-selected", "true");
        expect(screen.getByRole("option", { name: "People" })).toHaveAttribute("aria-selected", "false");
        expect(screen.getByRole("option", { name: "Unreads" })).toHaveAttribute("aria-selected", "false");

        expect(asFragment()).toMatchSnapshot();
    });

    it("should call toggle function when a filter is clicked", async () => {
        const user = userEvent.setup();
        render(<RoomListPrimaryFilters vm={vm} />);

        // Click on an inactive filter
        await user.click(screen.getByRole("button", { name: "People" }));

        // Check that the toggle function was called
        expect(filterToggleMocks[0]).toHaveBeenCalledTimes(1);
    });

    function mockFiltersOffsetLeft() {
        jest.spyOn(screen.getByRole("option", { name: "People" }), "offsetLeft", "get").mockReturnValue(0);
        jest.spyOn(screen.getByRole("option", { name: "Rooms" }), "offsetLeft", "get").mockReturnValue(30);
        // Unreads is wrapping
        jest.spyOn(screen.getByRole("option", { name: "Unreads" }), "offsetLeft", "get").mockReturnValue(0);
    }

    it("should hide or display filters if they are wrapping", async () => {
        const user = userEvent.setup();
        render(<RoomListPrimaryFilters vm={vm} />);

        // No filter is wrapping, so chevron shouldn't be visible
        expect(screen.queryByRole("button", { name: "Expand filter list" })).toBeNull();
        expect(screen.queryByRole("option", { name: "Unreads" })).toBeVisible();

        mockFiltersOffsetLeft();
        // @ts-ignore
        act(() => resizeCallback([{ target: screen.getByRole("listbox", { name: "Room list filters" }) }]));

        // The Unreads filter is wrapping, it should not be visible
        expect(screen.queryByRole("option", { name: "Unreads" })).toBeNull();
        // Now filters are wrapping, so chevron should be visible
        await user.click(screen.getByRole("button", { name: "Expand filter list" }));
        // The list is expanded, so Unreads should be visible
        expect(screen.getByRole("option", { name: "Unreads" })).toBeVisible();
    });

    it("should move the active filter if the list is collapsed and the filter is wrapping", async () => {
        vm = {
            primaryFilters: [
                { name: "People", active: false, toggle: filterToggleMocks[0], key: FilterKey.PeopleFilter },
                { name: "Rooms", active: false, toggle: filterToggleMocks[1], key: FilterKey.RoomsFilter },
                { name: "Unreads", active: true, toggle: filterToggleMocks[2], key: FilterKey.UnreadFilter },
            ],
        } as unknown as RoomListViewState;

        const user = userEvent.setup();
        render(<RoomListPrimaryFilters vm={vm} />);
        mockFiltersOffsetLeft();
        // @ts-ignore
        act(() => resizeCallback([{ target: screen.getByRole("listbox", { name: "Room list filters" }) }]));

        // Unread filter should be moved to the first position
        expect(screen.getByRole("listbox", { name: "Room list filters" }).children[0]).toBe(
            screen.getByRole("option", { name: "Unreads" }),
        );

        // When the list is expanded, the Unreads filter should move to its original position
        await user.click(screen.getByRole("button", { name: "Expand filter list" }));
        expect(screen.getByRole("listbox", { name: "Room list filters" }).children[0]).not.toEqual(
            screen.getByRole("option", { name: "Unreads" }),
        );
    });
});

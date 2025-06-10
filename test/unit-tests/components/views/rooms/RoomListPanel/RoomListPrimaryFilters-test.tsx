/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { act } from "react";
import { render, screen, waitFor } from "jest-matrix-react";
import userEvent from "@testing-library/user-event";

import { type RoomListViewState } from "../../../../../../src/components/viewmodels/roomlist/RoomListViewModel";
import { RoomListPrimaryFilters } from "../../../../../../src/components/views/rooms/RoomListPanel/RoomListPrimaryFilters";
import { FilterKey } from "../../../../../../src/stores/room-list-v3/skip-list/filters";

// Mock the useIsNodeVisible hook
jest.mock("../../../../../../src/hooks/useIsNodeVisible", () => ({
    useIsNodeVisible: jest.fn().mockImplementation(() => ({
        isVisible: true,
        nodeRef: jest.fn(),
        rootRef: jest.fn(),
    })),
}));

jest.mock("../../../../../../src/hooks/left-panel/room-list/useFilterHeight", () => ({
    useFilterHeight: jest.fn().mockImplementation(() => ({
        filterHeight: 30,
    })),
}));

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

    it("should show chevron and expands filters when there's overflow", async () => {
        const user = userEvent.setup();
        render(<RoomListPrimaryFilters vm={vm} />);

        expect(screen.getByTestId("filter-container")).toHaveAttribute("data-expanded", "false");

        // Force the overflow state by simulating ResizeObserver callback
        // Mock that the scrollHeight is greater than FILTER_HEIGHT (30)
        jest.spyOn(screen.getByRole("listbox", { name: "Room list filters" }), "scrollHeight", "get").mockReturnValue(
            50,
        );
        // @ts-ignore
        act(() => resizeCallback());

        await waitFor(async () => {
            const chevronButton = screen.getByRole("button", { name: "Expand filter list" });
            await user.click(chevronButton);
        });

        // Check that the container has the expanded attribute
        await waitFor(() => {
            expect(screen.getByTestId("filter-container")).toHaveAttribute("data-expanded", "true");
            expect(screen.getByRole("button", { name: "Collapse filter list" })).toBeInTheDocument();
        });
    });

    it("should not show the chevron when the list is equal at FILTER_HEIGHT", async () => {
        render(<RoomListPrimaryFilters vm={vm} />);

        // Force the overflow state by simulating ResizeObserver callback
        // Mock that the scrollHeight is greater than FILTER_HEIGHT (30)
        jest.spyOn(screen.getByRole("listbox", { name: "Room list filters" }), "scrollHeight", "get").mockReturnValue(
            30,
        );

        // @ts-ignore
        act(() => resizeCallback());

        expect(screen.queryByRole("button", { name: "Expand filter list" })).toBeNull();
    });

    it("handles filter reordering when active filter is not visible", async () => {
        // Mock useIsNodeVisible to return false, indicating active filter is not visible
        jest.requireMock("../../../../../../src/hooks/useIsNodeVisible").useIsNodeVisible.mockImplementation(() => ({
            isVisible: false,
            nodeRef: jest.fn(),
            rootRef: jest.fn(),
        }));

        render(<RoomListPrimaryFilters vm={vm} />);

        // Check that filters are reordered with the active one first
        const options = screen.getAllByRole("option");
        expect(options[0]).toHaveAttribute("aria-selected", "true");
        expect(options[0].textContent).toBe("Rooms");
    });

    it("resets filter ordering when a filter is selected", async () => {
        // Setup: First mock it as not visible so it reorders
        jest.requireMock("../../../../../../src/hooks/useIsNodeVisible").useIsNodeVisible.mockImplementation(() => ({
            isVisible: false,
            nodeRef: jest.fn(),
            rootRef: jest.fn(),
        }));

        const user = userEvent.setup();
        render(<RoomListPrimaryFilters vm={vm} />);

        // Check initial order (reordered with active first)
        let options = screen.getAllByRole("option");
        expect(options[0].textContent).toBe("Rooms");

        // Now change the hook to return true and click a filter
        jest.requireMock("../../../../../../src/hooks/useIsNodeVisible").useIsNodeVisible.mockImplementation(() => ({
            isVisible: true,
            nodeRef: jest.fn(),
            rootRef: jest.fn(),
        }));

        await user.click(screen.getByRole("button", { name: "People" }));

        // The order should be reset to original order
        options = screen.getAllByRole("option");
        expect(options[0].textContent).toBe("People");
    });
});

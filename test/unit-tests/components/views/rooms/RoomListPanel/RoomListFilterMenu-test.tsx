/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";
import { render, type RenderOptions, screen } from "jest-matrix-react";
import userEvent from "@testing-library/user-event";
import { TooltipProvider } from "@vector-im/compound-web";

import { type RoomListViewState } from "../../../../../../src/components/viewmodels/roomlist/RoomListViewModel";
import { SecondaryFilters } from "../../../../../../src/components/viewmodels/roomlist/useFilteredRooms";
import { SortOption } from "../../../../../../src/components/viewmodels/roomlist/useSorter";
import { RoomListFilterMenu } from "../../../../../../src/components/views/rooms/RoomListPanel/RoomListFilterMenu";

function getRenderOptions(): RenderOptions {
    return {
        wrapper: ({ children }) => <TooltipProvider>{children}</TooltipProvider>,
    };
}

describe("<RoomListFilterMenu />", () => {
    let vm: RoomListViewState;

    beforeEach(() => {
        vm = {
            isLoadingRooms: false,
            rooms: [],
            canCreateRoom: true,
            createRoom: jest.fn(),
            createChatRoom: jest.fn(),
            primaryFilters: [],
            activateSecondaryFilter: () => {},
            activeSecondaryFilter: SecondaryFilters.AllActivity,
            sort: jest.fn(),
            activeSortOption: SortOption.Activity,
            shouldShowMessagePreview: false,
            toggleMessagePreview: jest.fn(),
            activeIndex: undefined,
        };
    });

    it("should render room list filter menu button", async () => {
        const { asFragment } = render(<RoomListFilterMenu vm={vm} />, getRenderOptions());
        expect(screen.getByRole("button", { name: "Filter" })).toBeInTheDocument();
        expect(asFragment()).toMatchSnapshot();
    });

    it("opens the menu on click", async () => {
        const userevent = userEvent.setup();

        render(<RoomListFilterMenu vm={vm} />, getRenderOptions());
        await userevent.click(screen.getByRole("button", { name: "Filter" }));
        expect(screen.getByRole("menu", { name: "Filter" })).toBeInTheDocument();
    });

    it("shows 'All activity' checked if selected", async () => {
        const userevent = userEvent.setup();

        render(<RoomListFilterMenu vm={vm} />, getRenderOptions());
        await userevent.click(screen.getByRole("button", { name: "Filter" }));

        const shouldBeSelected = screen.getByRole("menuitem", { name: "All activity" });
        expect(shouldBeSelected).toHaveAttribute("aria-selected", "true");
        expect(shouldBeSelected).toMatchSnapshot();
    });

    it("shows 'Invites only' checked if selected", async () => {
        const userevent = userEvent.setup();

        vm.activeSecondaryFilter = SecondaryFilters.InvitesOnly;
        render(<RoomListFilterMenu vm={vm} />, getRenderOptions());
        await userevent.click(screen.getByRole("button", { name: "Filter" }));

        const shouldBeSelected = screen.getByRole("menuitem", { name: "Invites only" });
        expect(shouldBeSelected).toHaveAttribute("aria-selected", "true");
        expect(shouldBeSelected).toMatchSnapshot();
    });

    it("shows 'Low priority' checked if selected", async () => {
        const userevent = userEvent.setup();

        vm.activeSecondaryFilter = SecondaryFilters.LowPriority;
        render(<RoomListFilterMenu vm={vm} />, getRenderOptions());
        await userevent.click(screen.getByRole("button", { name: "Filter" }));

        const shouldBeSelected = screen.getByRole("menuitem", { name: "Low priority" });
        expect(shouldBeSelected).toHaveAttribute("aria-selected", "true");
        expect(shouldBeSelected).toMatchSnapshot();
    });

    it("shows 'Mentions only' checked if selected", async () => {
        const userevent = userEvent.setup();

        vm.activeSecondaryFilter = SecondaryFilters.MentionsOnly;
        render(<RoomListFilterMenu vm={vm} />, getRenderOptions());
        await userevent.click(screen.getByRole("button", { name: "Filter" }));

        const shouldBeSelected = screen.getByRole("menuitem", { name: "Mentions only" });
        expect(shouldBeSelected).toHaveAttribute("aria-selected", "true");
        expect(shouldBeSelected).toMatchSnapshot();
    });

    it("activates filter when item clicked", async () => {
        const userevent = userEvent.setup();

        vm.activateSecondaryFilter = jest.fn();
        render(<RoomListFilterMenu vm={vm} />, getRenderOptions());
        await userevent.click(screen.getByRole("button", { name: "Filter" }));
        await userevent.click(screen.getByRole("menuitem", { name: "Invites only" }));

        expect(vm.activateSecondaryFilter).toHaveBeenCalledWith(SecondaryFilters.InvitesOnly);
    });
});

/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";
import { render, screen } from "jest-matrix-react";
import userEvent from "@testing-library/user-event";

import { type RoomListViewState } from "../../../../../../src/components/viewmodels/roomlist/RoomListViewModel";
import { SecondaryFilters } from "../../../../../../src/components/viewmodels/roomlist/useFilteredRooms";
import { RoomListPrimaryFilters } from "../../../../../../src/components/views/rooms/RoomListPanel/RoomListPrimaryFilters";
import { SortOption } from "../../../../../../src/components/viewmodels/roomlist/useSorter";

describe("<RoomListPrimaryFilters />", () => {
    let vm: RoomListViewState;

    beforeEach(() => {
        vm = {
            rooms: [],
            openRoom: jest.fn(),
            primaryFilters: [
                { name: "People", active: false, toggle: jest.fn() },
                { name: "Rooms", active: true, toggle: jest.fn() },
            ],
            activateSecondaryFilter: () => {},
            activeSecondaryFilter: SecondaryFilters.AllActivity,
            sort: jest.fn(),
            activeSortOption: SortOption.Activity,
        };
    });

    it("should render primary filters", async () => {
        const user = userEvent.setup();

        const { asFragment } = render(<RoomListPrimaryFilters vm={vm} />);
        expect(screen.getByRole("option", { name: "People" })).toBeInTheDocument();
        expect(screen.getByRole("option", { name: "Rooms" })).toHaveAttribute("aria-selected", "true");
        expect(asFragment()).toMatchSnapshot();

        await user.click(screen.getByRole("button", { name: "People" }));
        expect(vm.primaryFilters[0].toggle).toHaveBeenCalled();
    });
});

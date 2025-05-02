/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";
import { render, screen } from "jest-matrix-react";

import { type RoomListViewState } from "../../../../../../src/components/viewmodels/roomlist/RoomListViewModel";
import { SecondaryFilters } from "../../../../../../src/components/viewmodels/roomlist/useFilteredRooms";
import { SortOption } from "../../../../../../src/components/viewmodels/roomlist/useSorter";
import { RoomListSecondaryFilters } from "../../../../../../src/components/views/rooms/RoomListPanel/RoomListSecondaryFilters";

describe("<RoomListSecondaryFilters />", () => {
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

    it("should render 'room options' button", async () => {
        const { asFragment } = render(<RoomListSecondaryFilters vm={vm} />);
        expect(screen.getByRole("button", { name: "Room Options" })).toBeInTheDocument();
        expect(asFragment()).toMatchSnapshot();
    });
});

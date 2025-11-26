/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { render, screen } from "jest-matrix-react";
import React from "react";

import { RoomListPanel, type RoomListPanelViewModel } from "./RoomListPanel";
import { SortOption } from "../RoomListHeader";
import type { RoomListItemViewModel } from "../RoomListItem";

describe("RoomListPanel", () => {
    const mockRenderAvatar = jest.fn((roomViewModel: RoomListItemViewModel) => (
        <div data-testid={`avatar-${roomViewModel.id}`}>{roomViewModel.name[0]}</div>
    ));

    const mockViewModel: RoomListPanelViewModel = {
        ariaLabel: "Room List",
        searchViewModel: {
            onSearchClick: jest.fn(),
            showDialPad: false,
            showExplore: false,
        },
        headerViewModel: {
            title: "Test Header",
            isSpace: false,
            displayComposeMenu: false,
            onComposeClick: jest.fn(),
            sortOptionsMenuViewModel: {
                activeSortOption: SortOption.Activity,
                sort: jest.fn(),
            },
        },
        viewViewModel: {
            isLoadingRooms: false,
            isRoomListEmpty: false,
            emptyStateTitle: "No rooms",
            filtersViewModel: {
                filters: [],
            },
            roomListViewModel: {
                roomsResult: {
                    spaceId: "!space:server",
                    filterKeys: undefined,
                    rooms: [],
                },
                activeRoomIndex: undefined,
                onKeyDown: undefined,
            },
        },
    };

    it("renders with search, header, and content", () => {
        render(<RoomListPanel viewModel={mockViewModel} renderAvatar={mockRenderAvatar} />);

        expect(screen.getByText("Test Header")).toBeInTheDocument();
        expect(screen.getByRole("navigation", { name: "Room List" })).toBeInTheDocument();
    });

    it("renders without search", () => {
        const vmWithoutSearch = {
            ...mockViewModel,
            searchViewModel: undefined,
        };

        render(<RoomListPanel viewModel={vmWithoutSearch} renderAvatar={mockRenderAvatar} />);

        expect(screen.getByText("Test Header")).toBeInTheDocument();
    });

    it("renders loading state", () => {
        const vmLoading: RoomListPanelViewModel = {
            ...mockViewModel,
            viewViewModel: {
                ...mockViewModel.viewViewModel,
                isLoadingRooms: true,
                isRoomListEmpty: false,
            },
        };

        render(<RoomListPanel viewModel={vmLoading} renderAvatar={mockRenderAvatar} />);

        // RoomListPanel should render (loading state is handled by RoomListView)
        expect(screen.getByRole("navigation")).toBeInTheDocument();
    });

    it("renders empty state", () => {
        const vmEmpty: RoomListPanelViewModel = {
            ...mockViewModel,
            viewViewModel: {
                ...mockViewModel.viewViewModel,
                isLoadingRooms: false,
                isRoomListEmpty: true,
            },
        };

        render(<RoomListPanel viewModel={vmEmpty} renderAvatar={mockRenderAvatar} />);

        // RoomListPanel should render (empty state is handled by RoomListView)
        expect(screen.getByRole("navigation")).toBeInTheDocument();
    });

    it("passes additional HTML attributes", () => {
        render(<RoomListPanel viewModel={mockViewModel} renderAvatar={mockRenderAvatar} data-testid="custom-panel" />);

        expect(screen.getByTestId("custom-panel")).toBeInTheDocument();
    });
});

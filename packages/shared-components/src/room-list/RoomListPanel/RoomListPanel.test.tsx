/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { render, screen } from "jest-matrix-react";
import React from "react";

import { RoomListPanel, type RoomListPanelSnapshot } from "./RoomListPanel";
import { type ViewModel } from "../../viewmodel/ViewModel";
import { SortOption } from "../RoomListHeader";
import type { RoomListItemViewModel } from "../RoomListItem";
import type { RoomListSearchSnapshot } from "../RoomListSearch";
import type { RoomListHeaderSnapshot } from "../RoomListHeader";
import type { RoomListViewSnapshot } from "../RoomListView";
import type { RoomListPrimaryFiltersSnapshot } from "../RoomListPrimaryFilters";
import type { RoomListSnapshot } from "../RoomList";
import type { SortOptionsMenuSnapshot } from "../RoomListHeader/SortOptionsMenu";

// Mock ResizeObserver which is used by RoomListPrimaryFilters
global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
};

describe("RoomListPanel", () => {
    function createMockViewModel<T>(snapshot: T): ViewModel<T> {
        return {
            getSnapshot: () => snapshot,
            subscribe: () => () => {},
        };
    }

    const mockRenderAvatar = jest.fn((roomViewModel: RoomListItemViewModel) => (
        <div data-testid={`avatar-${roomViewModel.id}`}>{roomViewModel.name[0]}</div>
    ));

    const searchSnapshot: RoomListSearchSnapshot = {
        onSearchClick: jest.fn(),
        showDialPad: false,
        showExplore: false,
    };

    const sortOptionsMenuSnapshot: SortOptionsMenuSnapshot = {
        activeSortOption: SortOption.Activity,
        sort: jest.fn(),
    };

    const headerSnapshot: RoomListHeaderSnapshot = {
        title: "Test Header",
        isSpace: false,
        displayComposeMenu: false,
        onComposeClick: jest.fn(),
        sortOptionsMenuVm: createMockViewModel(sortOptionsMenuSnapshot),
    };

    const filtersSnapshot: RoomListPrimaryFiltersSnapshot = {
        filters: [],
    };

    const roomListSnapshot: RoomListSnapshot = {
        roomsResult: {
            spaceId: "!space:server",
            filterKeys: undefined,
            rooms: [],
        },
        activeRoomIndex: undefined,
        onKeyDown: undefined,
    };

    const viewSnapshot: RoomListViewSnapshot = {
        isLoadingRooms: false,
        isRoomListEmpty: false,
        emptyStateTitle: "No rooms",
        filtersVm: createMockViewModel(filtersSnapshot),
        roomListVm: createMockViewModel(roomListSnapshot),
    };

    const mockSnapshot: RoomListPanelSnapshot = {
        ariaLabel: "Room List",
        searchVm: createMockViewModel(searchSnapshot),
        headerVm: createMockViewModel(headerSnapshot),
        viewVm: createMockViewModel(viewSnapshot),
    };

    const mockViewModel = createMockViewModel(mockSnapshot);

    it("renders with search, header, and content", () => {
        render(<RoomListPanel vm={mockViewModel} renderAvatar={mockRenderAvatar} />);

        expect(screen.getByText("Test Header")).toBeInTheDocument();
        expect(screen.getByRole("navigation", { name: "Room List" })).toBeInTheDocument();
    });

    it("renders without search", () => {
        const snapshotWithoutSearch: RoomListPanelSnapshot = {
            ...mockSnapshot,
            searchVm: undefined,
        };

        const vmWithoutSearch = createMockViewModel(snapshotWithoutSearch);

        render(<RoomListPanel vm={vmWithoutSearch} renderAvatar={mockRenderAvatar} />);

        expect(screen.getByText("Test Header")).toBeInTheDocument();
    });

    it("renders loading state", () => {
        const loadingViewSnapshot: RoomListViewSnapshot = {
            ...viewSnapshot,
            isLoadingRooms: true,
            isRoomListEmpty: false,
        };

        const loadingSnapshot: RoomListPanelSnapshot = {
            ...mockSnapshot,
            viewVm: createMockViewModel(loadingViewSnapshot),
        };

        const vmLoading = createMockViewModel(loadingSnapshot);

        render(<RoomListPanel vm={vmLoading} renderAvatar={mockRenderAvatar} />);

        // RoomListPanel should render (loading state is handled by RoomListView)
        expect(screen.getByRole("navigation")).toBeInTheDocument();
    });

    it("renders empty state", () => {
        const emptyViewSnapshot: RoomListViewSnapshot = {
            ...viewSnapshot,
            isLoadingRooms: false,
            isRoomListEmpty: true,
        };

        const emptySnapshot: RoomListPanelSnapshot = {
            ...mockSnapshot,
            viewVm: createMockViewModel(emptyViewSnapshot),
        };

        const vmEmpty = createMockViewModel(emptySnapshot);

        render(<RoomListPanel vm={vmEmpty} renderAvatar={mockRenderAvatar} />);

        // RoomListPanel should render (empty state is handled by RoomListView)
        expect(screen.getByRole("navigation")).toBeInTheDocument();
    });

    it("passes additional HTML attributes", () => {
        render(<RoomListPanel vm={mockViewModel} renderAvatar={mockRenderAvatar} data-testid="custom-panel" />);

        expect(screen.getByTestId("custom-panel")).toBeInTheDocument();
    });
});

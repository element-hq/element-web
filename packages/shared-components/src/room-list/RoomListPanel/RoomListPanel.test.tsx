/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { render, screen } from "jest-matrix-react";
import React from "react";

import { RoomListPanel } from "./RoomListPanel";
import { type RoomListViewModel, type RoomListSnapshot } from "../RoomListView";
import { SortOption } from "../RoomListHeader";
import type { RoomListItem } from "../RoomListItem";
import type { RoomListSearchState } from "../RoomListSearch";
import type { SortOptionsMenuSnapshot } from "../RoomListHeader/SortOptionsMenu";
import type { Filter } from "../RoomListPrimaryFilters";

// Mock ResizeObserver which is used by RoomListPrimaryFilters
global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
};

describe("RoomListPanel", () => {
    function createMockViewModel(snapshot: RoomListSnapshot): RoomListViewModel {
        return {
            getSnapshot: () => snapshot,
            subscribe: () => () => {},
            onToggleFilter: jest.fn(),
            onSearchClick: jest.fn(),
            onDialPadClick: jest.fn(),
            onExploreClick: jest.fn(),
            onOpenRoom: jest.fn(),
            onMarkAsRead: jest.fn(),
            onMarkAsUnread: jest.fn(),
            onToggleFavorite: jest.fn(),
            onToggleLowPriority: jest.fn(),
            onInvite: jest.fn(),
            onCopyRoomLink: jest.fn(),
            onLeaveRoom: jest.fn(),
            onSetRoomNotifState: jest.fn(),
        };
    }

    const mockRenderAvatar = jest.fn((roomItem: RoomListItem) => (
        <div data-testid={`avatar-${roomItem.id}`}>{roomItem.name[0]}</div>
    ));

    const searchState: RoomListSearchState = {
        showDialPad: false,
        showExplore: false,
    };

    const sortOptionsMenuSnapshot: SortOptionsMenuSnapshot = {
        activeSortOption: SortOption.Activity,
        sort: jest.fn(),
    };

    const filters: Filter[] = [];

    const mockSnapshot: RoomListSnapshot = {
        searchState: searchState,
        headerState: {
            title: "Test Header",
            isSpace: false,
            displayComposeMenu: false,
            onComposeClick: jest.fn(),
            sortOptionsMenuProps: sortOptionsMenuSnapshot,
        },
        isLoadingRooms: false,
        isRoomListEmpty: false,
        filters: filters,
        roomListState: {
            rooms: [],
            activeRoomIndex: undefined,
            spaceId: "!space:server",
            filterKeys: undefined,
        },
    };

    const mockViewModel = createMockViewModel(mockSnapshot);

    it("renders with search, header, and content", () => {
        render(<RoomListPanel vm={mockViewModel} renderAvatar={mockRenderAvatar} />);

        expect(screen.getByText("Test Header")).toBeInTheDocument();
        expect(screen.getByRole("navigation")).toBeInTheDocument();
    });

    it("renders without search", () => {
        const snapshotWithoutSearch: RoomListSnapshot = {
            ...mockSnapshot,
            searchState: undefined,
        };

        const vmWithoutSearch = createMockViewModel(snapshotWithoutSearch);

        render(<RoomListPanel vm={vmWithoutSearch} renderAvatar={mockRenderAvatar} />);

        expect(screen.getByText("Test Header")).toBeInTheDocument();
    });

    it("renders loading state", () => {
        const loadingSnapshot: RoomListSnapshot = {
            ...mockSnapshot,
            isLoadingRooms: true,
            isRoomListEmpty: false,
        };

        const vmLoading = createMockViewModel(loadingSnapshot);

        render(<RoomListPanel vm={vmLoading} renderAvatar={mockRenderAvatar} />);

        // RoomListPanel should render (loading state is handled by RoomListView)
        expect(screen.getByRole("navigation")).toBeInTheDocument();
    });

    it("renders empty state", () => {
        const emptySnapshot: RoomListSnapshot = {
            ...mockSnapshot,
            isLoadingRooms: false,
            isRoomListEmpty: true,
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

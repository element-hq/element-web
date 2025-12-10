/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { render, screen } from "jest-matrix-react";
import React from "react";

import { RoomListHeader } from "./RoomListHeader";
import { SortOption } from "./SortOptionsMenu";
import type { RoomListViewModel, RoomListSnapshot } from "../RoomListView";
import type { RoomListHeaderState } from "./RoomListHeader";

describe("RoomListHeader", () => {
    const createMockViewModel = (headerState: RoomListHeaderState): RoomListViewModel => {
        const snapshot: RoomListSnapshot = {
            headerState,
            isLoadingRooms: false,
            isRoomListEmpty: false,
            filters: [],
            roomListState: {
                rooms: [],
            },
        };

        return {
            getSnapshot: () => snapshot,
            subscribe: (listener: () => void) => {
                return () => {};
            },
            sort: jest.fn(),
            onToggleFilter: jest.fn(),
            onSearchClick: jest.fn(),
            onDialPadClick: jest.fn(),
            onExploreClick: jest.fn(),
            showDialPad: false,
            showExplore: false,
            onComposeClick: jest.fn(),
            openSpaceHome: jest.fn(),
            inviteInSpace: jest.fn(),
            openSpacePreferences: jest.fn(),
            openSpaceSettings: jest.fn(),
            createChatRoom: jest.fn(),
            createRoom: jest.fn(),
            createVideoRoom: jest.fn(),
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
    };

    it("renders title", () => {
        const vm = createMockViewModel({
            title: "My Space",
            isSpace: false,
            displayComposeMenu: false,
            activeSortOption: SortOption.Activity,
        });

        render(<RoomListHeader vm={vm} />);

        expect(screen.getByText("My Space")).toBeInTheDocument();
        expect(screen.getByRole("banner")).toBeInTheDocument();
    });

    it("renders space menu when isSpace is true", () => {
        const vm = createMockViewModel({
            title: "My Space",
            isSpace: true,
            spaceMenuState: {
                title: "My Space",
                canInviteInSpace: true,
                canAccessSpaceSettings: true,
            },
            displayComposeMenu: false,
            activeSortOption: SortOption.Activity,
        });

        render(<RoomListHeader vm={vm} />);

        expect(screen.getByText("My Space")).toBeInTheDocument();
        // Space menu chevron button should be present
        expect(screen.getByLabelText("Open space menu")).toBeInTheDocument();
    });

    it("renders compose menu when displayComposeMenu is true", () => {
        const vm = createMockViewModel({
            title: "My Space",
            isSpace: false,
            displayComposeMenu: true,
            composeMenuState: {
                canCreateRoom: true,
                canCreateVideoRoom: true,
            },
            activeSortOption: SortOption.Activity,
        });

        render(<RoomListHeader vm={vm} />);

        // Compose button should be present
        expect(screen.getByLabelText("New conversation")).toBeInTheDocument();
    });

    it("renders compose icon button when displayComposeMenu is false", () => {
        const vm = createMockViewModel({
            title: "My Space",
            isSpace: false,
            displayComposeMenu: false,
            activeSortOption: SortOption.Activity,
        });

        render(<RoomListHeader vm={vm} />);

        // Compose icon button should be present
        expect(screen.getByLabelText("New conversation")).toBeInTheDocument();
    });

    it("renders sort options menu", () => {
        const vm = createMockViewModel({
            title: "My Space",
            isSpace: false,
            displayComposeMenu: false,
            activeSortOption: SortOption.Activity,
        });

        render(<RoomListHeader vm={vm} />);

        // Sort options menu trigger should be present
        expect(screen.getByLabelText("Room options")).toBeInTheDocument();
    });

    it("truncates long titles with title attribute", () => {
        const longTitle = "This is a very long space name that should be truncated";

        const vm = createMockViewModel({
            title: longTitle,
            isSpace: false,
            displayComposeMenu: false,
            activeSortOption: SortOption.Activity,
        });

        render(<RoomListHeader vm={vm} />);

        const h1 = screen.getByRole("heading", { level: 1 });
        expect(h1).toHaveAttribute("title", longTitle);
        expect(h1).toHaveTextContent(longTitle);
    });

    it("renders data-testid attribute", () => {
        const vm = createMockViewModel({
            title: "My Space",
            isSpace: false,
            displayComposeMenu: false,
            activeSortOption: SortOption.Activity,
        });

        render(<RoomListHeader vm={vm} />);

        expect(screen.getByTestId("room-list-header")).toBeInTheDocument();
    });
});

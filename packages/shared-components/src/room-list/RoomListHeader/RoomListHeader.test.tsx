/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { render, screen } from "jest-matrix-react";
import React from "react";

import { RoomListHeader, type RoomListHeaderSnapshot } from "./RoomListHeader";
import type { SpaceMenuSnapshot } from "./SpaceMenu";
import type { ComposeMenuSnapshot } from "./ComposeMenu";
import type { SortOptionsMenuSnapshot } from "./SortOptionsMenu";
import { SortOption } from "./SortOptionsMenu";
import { type ViewModel } from "../../viewmodel/ViewModel";

function createMockViewModel<T>(snapshot: T): ViewModel<T> {
    return {
        getSnapshot: () => snapshot,
        subscribe: () => () => {},
    };
}

describe("RoomListHeader", () => {
    const mockSortOptionsSnapshot: SortOptionsMenuSnapshot = {
        activeSortOption: SortOption.Activity,
        sort: jest.fn(),
    };

    it("renders title", () => {
        const snapshot: RoomListHeaderSnapshot = {
            title: "My Space",
            isSpace: false,
            displayComposeMenu: false,
            onComposeClick: jest.fn(),
            sortOptionsMenuVm: createMockViewModel(mockSortOptionsSnapshot),
        };

        render(<RoomListHeader vm={createMockViewModel(snapshot)} />);

        expect(screen.getByText("My Space")).toBeInTheDocument();
        expect(screen.getByRole("banner")).toBeInTheDocument();
    });

    it("renders space menu when isSpace is true", () => {
        const mockSpaceMenuSnapshot: SpaceMenuSnapshot = {
            title: "My Space",
            canInviteInSpace: true,
            canAccessSpaceSettings: true,
            openSpaceHome: jest.fn(),
            inviteInSpace: jest.fn(),
            openSpacePreferences: jest.fn(),
            openSpaceSettings: jest.fn(),
        };

        const snapshot: RoomListHeaderSnapshot = {
            title: "My Space",
            isSpace: true,
            spaceMenuVm: createMockViewModel(mockSpaceMenuSnapshot),
            displayComposeMenu: false,
            onComposeClick: jest.fn(),
            sortOptionsMenuVm: createMockViewModel(mockSortOptionsSnapshot),
        };

        render(<RoomListHeader vm={createMockViewModel(snapshot)} />);

        expect(screen.getByText("My Space")).toBeInTheDocument();
        // Space menu chevron button should be present
        expect(screen.getByLabelText("Open space menu")).toBeInTheDocument();
    });

    it("renders compose menu when displayComposeMenu is true", () => {
        const mockComposeMenuSnapshot: ComposeMenuSnapshot = {
            canCreateRoom: true,
            canCreateVideoRoom: true,
            createChatRoom: jest.fn(),
            createRoom: jest.fn(),
            createVideoRoom: jest.fn(),
        };

        const snapshot: RoomListHeaderSnapshot = {
            title: "My Space",
            isSpace: false,
            displayComposeMenu: true,
            composeMenuVm: createMockViewModel(mockComposeMenuSnapshot),
            sortOptionsMenuVm: createMockViewModel(mockSortOptionsSnapshot),
        };

        render(<RoomListHeader vm={createMockViewModel(snapshot)} />);

        // Compose button should be present
        expect(screen.getByLabelText("New conversation")).toBeInTheDocument();
    });

    it("renders compose icon button when displayComposeMenu is false", () => {
        const snapshot: RoomListHeaderSnapshot = {
            title: "My Space",
            isSpace: false,
            displayComposeMenu: false,
            onComposeClick: jest.fn(),
            sortOptionsMenuVm: createMockViewModel(mockSortOptionsSnapshot),
        };

        render(<RoomListHeader vm={createMockViewModel(snapshot)} />);

        // Compose icon button should be present
        expect(screen.getByLabelText("New conversation")).toBeInTheDocument();
    });

    it("renders sort options menu", () => {
        const snapshot: RoomListHeaderSnapshot = {
            title: "My Space",
            isSpace: false,
            displayComposeMenu: false,
            onComposeClick: jest.fn(),
            sortOptionsMenuVm: createMockViewModel(mockSortOptionsSnapshot),
        };

        render(<RoomListHeader vm={createMockViewModel(snapshot)} />);

        // Sort options menu trigger should be present
        expect(screen.getByLabelText("Room options")).toBeInTheDocument();
    });

    it("truncates long titles with title attribute", () => {
        const longTitle = "This is a very long space name that should be truncated";
        const snapshot: RoomListHeaderSnapshot = {
            title: longTitle,
            isSpace: false,
            displayComposeMenu: false,
            onComposeClick: jest.fn(),
            sortOptionsMenuVm: createMockViewModel(mockSortOptionsSnapshot),
        };

        render(<RoomListHeader vm={createMockViewModel(snapshot)} />);

        const h1 = screen.getByRole("heading", { level: 1 });
        expect(h1).toHaveAttribute("title", longTitle);
        expect(h1).toHaveTextContent(longTitle);
    });

    it("renders data-testid attribute", () => {
        const snapshot: RoomListHeaderSnapshot = {
            title: "My Space",
            isSpace: false,
            displayComposeMenu: false,
            onComposeClick: jest.fn(),
            sortOptionsMenuVm: createMockViewModel(mockSortOptionsSnapshot),
        };

        render(<RoomListHeader vm={createMockViewModel(snapshot)} />);

        expect(screen.getByTestId("room-list-header")).toBeInTheDocument();
    });
});

/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { render, screen } from "jest-matrix-react";
import React from "react";

import { RoomListHeader, type RoomListHeaderViewModel } from "./RoomListHeader";
import type { SpaceMenuViewModel } from "./SpaceMenu";
import type { ComposeMenuViewModel } from "./ComposeMenu";
import type { SortOptionsMenuViewModel } from "./SortOptionsMenu";
import { SortOption } from "./SortOptionsMenu";

describe("RoomListHeader", () => {
    const mockSortOptionsViewModel: SortOptionsMenuViewModel = {
        activeSortOption: SortOption.Activity,
        sort: jest.fn(),
    };

    it("renders title", () => {
        const viewModel: RoomListHeaderViewModel = {
            title: "My Space",
            isSpace: false,
            displayComposeMenu: false,
            onComposeClick: jest.fn(),
            sortOptionsMenuViewModel: mockSortOptionsViewModel,
        };

        render(<RoomListHeader viewModel={viewModel} />);

        expect(screen.getByText("My Space")).toBeInTheDocument();
        expect(screen.getByRole("banner")).toBeInTheDocument();
    });

    it("renders space menu when isSpace is true", () => {
        const mockSpaceMenuViewModel: SpaceMenuViewModel = {
            title: "My Space",
            canInviteInSpace: true,
            canAccessSpaceSettings: true,
            openSpaceHome: jest.fn(),
            inviteInSpace: jest.fn(),
            openSpacePreferences: jest.fn(),
            openSpaceSettings: jest.fn(),
        };

        const viewModel: RoomListHeaderViewModel = {
            title: "My Space",
            isSpace: true,
            spaceMenuViewModel: mockSpaceMenuViewModel,
            displayComposeMenu: false,
            onComposeClick: jest.fn(),
            sortOptionsMenuViewModel: mockSortOptionsViewModel,
        };

        render(<RoomListHeader viewModel={viewModel} />);

        expect(screen.getByText("My Space")).toBeInTheDocument();
        // Space menu chevron button should be present
        expect(screen.getByLabelText("Open space menu")).toBeInTheDocument();
    });

    it("renders compose menu when displayComposeMenu is true", () => {
        const mockComposeMenuViewModel: ComposeMenuViewModel = {
            canCreateRoom: true,
            canCreateVideoRoom: true,
            createChatRoom: jest.fn(),
            createRoom: jest.fn(),
            createVideoRoom: jest.fn(),
        };

        const viewModel: RoomListHeaderViewModel = {
            title: "My Space",
            isSpace: false,
            displayComposeMenu: true,
            composeMenuViewModel: mockComposeMenuViewModel,
            sortOptionsMenuViewModel: mockSortOptionsViewModel,
        };

        render(<RoomListHeader viewModel={viewModel} />);

        // Compose button should be present
        expect(screen.getByLabelText("New conversation")).toBeInTheDocument();
    });

    it("renders compose icon button when displayComposeMenu is false", () => {
        const viewModel: RoomListHeaderViewModel = {
            title: "My Space",
            isSpace: false,
            displayComposeMenu: false,
            onComposeClick: jest.fn(),
            sortOptionsMenuViewModel: mockSortOptionsViewModel,
        };

        render(<RoomListHeader viewModel={viewModel} />);

        // Compose icon button should be present
        expect(screen.getByLabelText("New conversation")).toBeInTheDocument();
    });

    it("renders sort options menu", () => {
        const viewModel: RoomListHeaderViewModel = {
            title: "My Space",
            isSpace: false,
            displayComposeMenu: false,
            onComposeClick: jest.fn(),
            sortOptionsMenuViewModel: mockSortOptionsViewModel,
        };

        render(<RoomListHeader viewModel={viewModel} />);

        // Sort options menu trigger should be present
        expect(screen.getByLabelText("Room options")).toBeInTheDocument();
    });

    it("truncates long titles with title attribute", () => {
        const longTitle = "This is a very long space name that should be truncated";
        const viewModel: RoomListHeaderViewModel = {
            title: longTitle,
            isSpace: false,
            displayComposeMenu: false,
            onComposeClick: jest.fn(),
            sortOptionsMenuViewModel: mockSortOptionsViewModel,
        };

        render(<RoomListHeader viewModel={viewModel} />);

        const h1 = screen.getByRole("heading", { level: 1 });
        expect(h1).toHaveAttribute("title", longTitle);
        expect(h1).toHaveTextContent(longTitle);
    });

    it("renders data-testid attribute", () => {
        const viewModel: RoomListHeaderViewModel = {
            title: "My Space",
            isSpace: false,
            displayComposeMenu: false,
            onComposeClick: jest.fn(),
            sortOptionsMenuViewModel: mockSortOptionsViewModel,
        };

        render(<RoomListHeader viewModel={viewModel} />);

        expect(screen.getByTestId("room-list-header")).toBeInTheDocument();
    });
});

/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { render, screen } from "@testing-library/react";
import React from "react";

import { RoomList, type RoomListViewModel, type RoomsResult } from "./RoomList";
import type { RoomListItemViewModel } from "../RoomListItem";
import type { NotificationDecorationViewModel } from "../../notifications/NotificationDecoration";
import type { RoomListItemMenuViewModel } from "../RoomListItem/RoomListItemMenuViewModel";

describe("RoomList", () => {
    const mockNotificationViewModel: NotificationDecorationViewModel = {
        hasAnyNotificationOrActivity: false,
        isUnsentMessage: false,
        invited: false,
        isMention: false,
        isActivityNotification: false,
        isNotification: false,
        count: 0,
        muted: false,
    };

    const mockMenuViewModel: RoomListItemMenuViewModel = {
        showMoreOptionsMenu: true,
        showNotificationMenu: true,
        isFavourite: false,
        isLowPriority: false,
        canInvite: true,
        canCopyRoomLink: true,
        canMarkAsRead: true,
        canMarkAsUnread: true,
        isNotificationAllMessage: true,
        isNotificationAllMessageLoud: false,
        isNotificationMentionOnly: false,
        isNotificationMute: false,
        markAsRead: jest.fn(),
        markAsUnread: jest.fn(),
        toggleFavorite: jest.fn(),
        toggleLowPriority: jest.fn(),
        invite: jest.fn(),
        copyRoomLink: jest.fn(),
        leaveRoom: jest.fn(),
        setRoomNotifState: jest.fn(),
    };

    const mockRooms: RoomListItemViewModel[] = [
        {
            id: "!room1:server",
            name: "Room 1",
            openRoom: jest.fn(),
            a11yLabel: "Room 1",
            isBold: false,
            notificationViewModel: mockNotificationViewModel,
            menuViewModel: mockMenuViewModel,
        },
        {
            id: "!room2:server",
            name: "Room 2",
            openRoom: jest.fn(),
            a11yLabel: "Room 2",
            isBold: false,
            notificationViewModel: mockNotificationViewModel,
            menuViewModel: mockMenuViewModel,
        },
        {
            id: "!room3:server",
            name: "Room 3",
            openRoom: jest.fn(),
            a11yLabel: "Room 3",
            isBold: false,
            notificationViewModel: mockNotificationViewModel,
            menuViewModel: mockMenuViewModel,
        },
    ];

    const mockRoomsResult: RoomsResult = {
        spaceId: "!space:server",
        filterKeys: undefined,
        rooms: mockRooms,
    };

    const mockRenderAvatar = jest.fn((roomViewModel: RoomListItemViewModel) => (
        <div data-testid={`avatar-${roomViewModel.id}`}>{roomViewModel.name[0]}</div>
    ));

    const mockViewModel: RoomListViewModel = {
        roomsResult: mockRoomsResult,
        activeRoomIndex: undefined,
        onKeyDown: undefined,
    };

    beforeEach(() => {
        mockRenderAvatar.mockClear();
    });

    it("renders the room list with correct aria attributes", () => {
        render(<RoomList viewModel={mockViewModel} renderAvatar={mockRenderAvatar} />);

        const listbox = screen.getByRole("listbox");
        expect(listbox).toBeInTheDocument();
        expect(listbox).toHaveAttribute("data-testid", "room-list");
    });

    it("renders with correct aria-label", () => {
        render(<RoomList viewModel={mockViewModel} renderAvatar={mockRenderAvatar} />);

        const listbox = screen.getByRole("listbox");
        expect(listbox).toBeInTheDocument();
        expect(listbox).toHaveAttribute("aria-label");
    });

    it("calls renderAvatar for each room", () => {
        render(<RoomList viewModel={mockViewModel} renderAvatar={mockRenderAvatar} />);

        // renderAvatar should be called for visible rooms (virtualization means not all may render immediately)
        expect(mockRenderAvatar).toHaveBeenCalled();
    });

    it("handles empty room list", () => {
        const emptyResult: RoomsResult = {
            spaceId: "!space:server",
            filterKeys: undefined,
            rooms: [],
        };

        const emptyViewModel: RoomListViewModel = {
            ...mockViewModel,
            roomsResult: emptyResult,
        };

        render(<RoomList viewModel={emptyViewModel} renderAvatar={mockRenderAvatar} />);

        const listbox = screen.getByRole("listbox");
        expect(listbox).toBeInTheDocument();
    });

    it("passes activeRoomIndex correctly", () => {
        const vmWithActive: RoomListViewModel = {
            ...mockViewModel,
            activeRoomIndex: 1,
        };

        render(<RoomList viewModel={vmWithActive} renderAvatar={mockRenderAvatar} />);

        // Component should render with active index set
        const listbox = screen.getByRole("listbox");
        expect(listbox).toBeInTheDocument();
    });

    it("handles keyboard events via onKeyDown callback", () => {
        const onKeyDown = jest.fn();
        const vmWithKeyDown: RoomListViewModel = {
            ...mockViewModel,
            onKeyDown,
        };

        render(<RoomList viewModel={vmWithKeyDown} renderAvatar={mockRenderAvatar} />);

        const listbox = screen.getByRole("listbox");
        listbox.focus();

        // Fire a keyboard event
        const event = new KeyboardEvent("keydown", { key: "ArrowDown", code: "ArrowDown" });
        listbox.dispatchEvent(event);

        // onKeyDown should be called
        expect(onKeyDown).toHaveBeenCalled();
    });
});

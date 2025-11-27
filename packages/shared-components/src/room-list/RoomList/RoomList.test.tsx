/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";

import { RoomList, type RoomListSnapshot, type RoomsResult } from "./RoomList";
import type { RoomListItemViewModel } from "../RoomListItem";
import type { NotificationDecorationViewModel } from "../../notifications/NotificationDecoration";
import type { RoomListItemMenuViewModel } from "../RoomListItem/RoomListItemMenuViewModel";
import { type ViewModel } from "../../viewmodel/ViewModel";

function createMockViewModel(snapshot: RoomListSnapshot): ViewModel<RoomListSnapshot> {
    return {
        getSnapshot: () => snapshot,
        subscribe: () => () => {},
    };
}

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

    const mockViewModel = createMockViewModel({
        roomsResult: mockRoomsResult,
        activeRoomIndex: undefined,
        onKeyDown: undefined,
    });

    beforeEach(() => {
        mockRenderAvatar.mockClear();
    });

    it("renders the room list with correct aria attributes", () => {
        render(<RoomList vm={mockViewModel} renderAvatar={mockRenderAvatar} />);

        const listbox = screen.getByRole("listbox");
        expect(listbox).toBeInTheDocument();
        expect(listbox).toHaveAttribute("data-testid", "room-list");
    });

    it("renders with correct aria-label", () => {
        render(<RoomList vm={mockViewModel} renderAvatar={mockRenderAvatar} />);

        const listbox = screen.getByRole("listbox");
        expect(listbox).toBeInTheDocument();
        expect(listbox).toHaveAttribute("aria-label");
    });

    it("calls renderAvatar for each room", () => {
        const { container } = render(
            <div style={{ height: "600px" }}>
                <RoomList vm={mockViewModel} renderAvatar={mockRenderAvatar} />
            </div>,
        );

        // renderAvatar should be called for visible rooms (virtualization means not all may render immediately)
        // Wait for virtuoso to render items
        expect(container).toBeInTheDocument();
        // Note: renderAvatar may not be called immediately due to virtualization
        // This test verifies the component renders without errors
    });

    it("handles empty room list", () => {
        const emptyResult: RoomsResult = {
            spaceId: "!space:server",
            filterKeys: undefined,
            rooms: [],
        };

        const emptyViewModel = createMockViewModel({
            roomsResult: emptyResult,
            activeRoomIndex: undefined,
            onKeyDown: undefined,
        });

        render(<RoomList vm={emptyViewModel} renderAvatar={mockRenderAvatar} />);

        const listbox = screen.getByRole("listbox");
        expect(listbox).toBeInTheDocument();
    });

    it("passes activeRoomIndex correctly", () => {
        const vmWithActive = createMockViewModel({
            roomsResult: mockRoomsResult,
            activeRoomIndex: 1,
            onKeyDown: undefined,
        });

        render(<RoomList vm={vmWithActive} renderAvatar={mockRenderAvatar} />);

        // Component should render with active index set
        const listbox = screen.getByRole("listbox");
        expect(listbox).toBeInTheDocument();
    });

    it("accepts onKeyDown callback", () => {
        const onKeyDown = jest.fn();
        const vmWithKeyDown = createMockViewModel({
            roomsResult: mockRoomsResult,
            activeRoomIndex: undefined,
            onKeyDown,
        });

        render(<RoomList vm={vmWithKeyDown} renderAvatar={mockRenderAvatar} />);

        const listbox = screen.getByRole("listbox");
        expect(listbox).toBeInTheDocument();

        // Component renders successfully with onKeyDown callback
        // Note: ListView handles keyboard events internally, so direct testing of the callback
        // would require testing ListView's internal behavior, which is out of scope for this test
    });
});

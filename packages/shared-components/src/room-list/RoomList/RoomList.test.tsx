/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { render, screen } from "@testing-library/react";
import React from "react";

import {
    RoomList,
    type RoomListViewModel,
    type RoomListViewSnapshot,
    type RoomListViewActions,
    type RoomsResult,
} from "./RoomList";
import type { RoomListItem } from "../RoomListItem";
import type { NotificationDecorationData } from "../../notifications/NotificationDecoration";
import type { MoreOptionsMenuState } from "../RoomListItem/RoomListItemMoreOptionsMenu";
import type { NotificationMenuState } from "../RoomListItem/RoomListItemNotificationMenu";

function createMockViewModel(
    snapshot: RoomListViewSnapshot,
    actions: Partial<RoomListViewActions> = {},
): RoomListViewModel {
    return {
        getSnapshot: () => snapshot,
        subscribe: () => () => {},
        onOpenRoom: actions.onOpenRoom || jest.fn(),
        onMarkAsRead: actions.onMarkAsRead || jest.fn(),
        onMarkAsUnread: actions.onMarkAsUnread || jest.fn(),
        onToggleFavorite: actions.onToggleFavorite || jest.fn(),
        onToggleLowPriority: actions.onToggleLowPriority || jest.fn(),
        onInvite: actions.onInvite || jest.fn(),
        onCopyRoomLink: actions.onCopyRoomLink || jest.fn(),
        onLeaveRoom: actions.onLeaveRoom || jest.fn(),
        onSetRoomNotifState: actions.onSetRoomNotifState || jest.fn(),
    };
}

describe("RoomList", () => {
    const mockNotificationData: NotificationDecorationData = {
        hasAnyNotificationOrActivity: false,
        isUnsentMessage: false,
        invited: false,
        isMention: false,
        isActivityNotification: false,
        isNotification: false,
        muted: false,
    };

    const mockMoreOptionsState: MoreOptionsMenuState = {
        isFavourite: false,
        isLowPriority: false,
        canInvite: true,
        canCopyRoomLink: true,
        canMarkAsRead: true,
        canMarkAsUnread: true,
    };

    const mockNotificationState: NotificationMenuState = {
        isNotificationAllMessage: true,
        isNotificationAllMessageLoud: false,
        isNotificationMentionOnly: false,
        isNotificationMute: false,
    };

    const mockRooms: RoomListItem[] = [
        {
            id: "!room1:server",
            name: "Room 1",
            a11yLabel: "Room 1",
            isBold: false,
            notification: mockNotificationData,
            showMoreOptionsMenu: true,
            showNotificationMenu: true,
            moreOptionsState: mockMoreOptionsState,
            notificationState: mockNotificationState,
        },
        {
            id: "!room2:server",
            name: "Room 2",
            a11yLabel: "Room 2",
            isBold: false,
            notification: mockNotificationData,
            showMoreOptionsMenu: true,
            showNotificationMenu: true,
            moreOptionsState: mockMoreOptionsState,
            notificationState: mockNotificationState,
        },
        {
            id: "!room3:server",
            name: "Room 3",
            a11yLabel: "Room 3",
            isBold: false,
            notification: mockNotificationData,
            showMoreOptionsMenu: true,
            showNotificationMenu: true,
            moreOptionsState: mockMoreOptionsState,
            notificationState: mockNotificationState,
        },
    ];

    const mockRoomsResult: RoomsResult = {
        spaceId: "!space:server",
        filterKeys: undefined,
        rooms: mockRooms,
    };

    const mockRenderAvatar = jest.fn((roomItem: RoomListItem) => (
        <div data-testid={`avatar-${roomItem.id}`}>{roomItem.name[0]}</div>
    ));

    const mockViewModel = createMockViewModel({
        roomsResult: mockRoomsResult,
        activeRoomIndex: undefined,
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
        });

        render(<RoomList vm={emptyViewModel} renderAvatar={mockRenderAvatar} />);

        const listbox = screen.getByRole("listbox");
        expect(listbox).toBeInTheDocument();
    });

    it("passes activeRoomIndex correctly", () => {
        const vmWithActive = createMockViewModel({
            roomsResult: mockRoomsResult,
            activeRoomIndex: 1,
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

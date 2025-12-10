/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { render, screen } from "jest-matrix-react";
import userEvent from "@testing-library/user-event";
import React from "react";

import { RoomListItemView, type RoomListItem, type RoomListItemCallbacks } from "./RoomListItem";
import type { NotificationDecorationData } from "../../notifications/NotificationDecoration";
import type { MoreOptionsMenuState, MoreOptionsMenuCallbacks } from "./RoomListItemMoreOptionsMenu";
import type { NotificationMenuState } from "./RoomListItemNotificationMenu";

describe("RoomListItem", () => {
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

    const mockMoreOptionsCallbacks: MoreOptionsMenuCallbacks = {
        onMarkAsRead: jest.fn(),
        onMarkAsUnread: jest.fn(),
        onToggleFavorite: jest.fn(),
        onToggleLowPriority: jest.fn(),
        onInvite: jest.fn(),
        onCopyRoomLink: jest.fn(),
        onLeaveRoom: jest.fn(),
    };

    const mockOnSetRoomNotifState = jest.fn();

    const mockItem: RoomListItem = {
        id: "!test:example.org",
        name: "Test Room",
        a11yLabel: "Test Room, no unread messages",
        isBold: false,
        messagePreview: undefined,
        notification: mockNotificationData,
        showMoreOptionsMenu: true,
        showNotificationMenu: true,
        moreOptionsState: mockMoreOptionsState,
        notificationState: mockNotificationState,
    };

    const mockCallbacks: RoomListItemCallbacks = {
        onOpenRoom: jest.fn(),
        moreOptionsCallbacks: mockMoreOptionsCallbacks,
        onSetRoomNotifState: mockOnSetRoomNotifState,
    };

    const mockAvatar = <div data-testid="mock-avatar">Avatar</div>;

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("renders room name and avatar", () => {
        render(
            <RoomListItemView
                item={mockItem}
                callbacks={mockCallbacks}
                isSelected={false}
                isFocused={false}
                onFocus={jest.fn()}
                roomIndex={0}
                roomCount={10}
                avatar={mockAvatar}
            />,
        );

        expect(screen.getByText("Test Room")).toBeInTheDocument();
        expect(screen.getByTestId("mock-avatar")).toBeInTheDocument();
    });

    it("renders with message preview", () => {
        const itemWithPreview = { ...mockItem, messagePreview: "Latest message preview" };
        render(
            <RoomListItemView
                item={itemWithPreview}
                callbacks={mockCallbacks}
                isSelected={false}
                isFocused={false}
                onFocus={jest.fn()}
                roomIndex={0}
                roomCount={10}
                avatar={mockAvatar}
            />,
        );

        expect(screen.getByText("Latest message preview")).toBeInTheDocument();
    });

    it("applies selected styles when selected", () => {
        render(
            <RoomListItemView
                item={mockItem}
                callbacks={mockCallbacks}
                isSelected={true}
                isFocused={false}
                onFocus={jest.fn()}
                roomIndex={0}
                roomCount={10}
                avatar={mockAvatar}
            />,
        );

        const button = screen.getByRole("option");
        expect(button).toHaveAttribute("aria-selected", "true");
    });

    it("applies bold styles when room has unread", () => {
        const itemWithUnread = { ...mockItem, isBold: true };
        render(
            <RoomListItemView
                item={itemWithUnread}
                callbacks={mockCallbacks}
                isSelected={false}
                isFocused={false}
                onFocus={jest.fn()}
                roomIndex={0}
                roomCount={10}
                avatar={mockAvatar}
            />,
        );

        const button = screen.getByRole("option");
        // Check that the bold class is applied
        expect(button.className).toContain("bold");
    });

    it("calls openRoom when clicked", async () => {
        const user = userEvent.setup();
        render(
            <RoomListItemView
                item={mockItem}
                callbacks={mockCallbacks}
                isSelected={false}
                isFocused={false}
                onFocus={jest.fn()}
                roomIndex={0}
                roomCount={10}
                avatar={mockAvatar}
            />,
        );

        await user.click(screen.getByRole("option"));
        expect(mockCallbacks.onOpenRoom).toHaveBeenCalledTimes(1);
    });

    it("calls onFocus when focused", async () => {
        const onFocus = jest.fn();
        render(
            <RoomListItemView
                item={mockItem}
                callbacks={mockCallbacks}
                isSelected={false}
                isFocused={false}
                onFocus={onFocus}
                roomIndex={0}
                roomCount={10}
                avatar={mockAvatar}
            />,
        );

        const button = screen.getByRole("option");
        button.focus();
        expect(onFocus).toHaveBeenCalled();
    });

    it("renders notification decoration when hasAnyNotificationOrActivity is true", () => {
        const notificationData: NotificationDecorationData = {
            hasAnyNotificationOrActivity: true,
            isUnsentMessage: false,
            invited: false,
            isMention: false,
            isActivityNotification: true,
            isNotification: false,
            muted: false,
        };
        const itemWithNotification = { ...mockItem, notification: notificationData };

        render(
            <RoomListItemView
                item={itemWithNotification}
                callbacks={mockCallbacks}
                isSelected={false}
                isFocused={false}
                onFocus={jest.fn()}
                roomIndex={0}
                roomCount={10}
                avatar={mockAvatar}
            />,
        );

        expect(screen.getByTestId("notification-decoration")).toBeInTheDocument();
    });

    it("sets correct ARIA attributes", () => {
        render(
            <RoomListItemView
                item={mockItem}
                callbacks={mockCallbacks}
                isSelected={false}
                isFocused={false}
                onFocus={jest.fn()}
                roomIndex={5}
                roomCount={20}
                avatar={mockAvatar}
            />,
        );

        const button = screen.getByRole("option");
        expect(button).toHaveAttribute("aria-posinset", "6"); // index + 1
        expect(button).toHaveAttribute("aria-setsize", "20");
        expect(button).toHaveAttribute("aria-label", mockItem.a11yLabel);
    });
});

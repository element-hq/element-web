/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { render, screen } from "jest-matrix-react";
import userEvent from "@testing-library/user-event";
import React from "react";

import { RoomListItem, type RoomListItemViewModel } from "./RoomListItem";
import type { NotificationDecorationViewModel } from "../../notifications/NotificationDecoration";
import type { RoomListItemMenuViewModel } from "./RoomListItemMenuViewModel";

describe("RoomListItem", () => {
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

    const mockViewModel: RoomListItemViewModel = {
        id: "!test:example.org",
        name: "Test Room",
        openRoom: jest.fn(),
        a11yLabel: "Test Room, no unread messages",
        isBold: false,
        messagePreview: undefined,
        notificationViewModel: mockNotificationViewModel,
        menuViewModel: mockMenuViewModel,
    };

    const mockAvatar = <div data-testid="mock-avatar">Avatar</div>;

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("renders room name and avatar", () => {
        render(
            <RoomListItem
                viewModel={mockViewModel}
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
        const vmWithPreview = { ...mockViewModel, messagePreview: "Latest message preview" };
        render(
            <RoomListItem
                viewModel={vmWithPreview}
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
            <RoomListItem
                viewModel={mockViewModel}
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
        const vmWithUnread = { ...mockViewModel, isBold: true };
        render(
            <RoomListItem
                viewModel={vmWithUnread}
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
            <RoomListItem
                viewModel={mockViewModel}
                isSelected={false}
                isFocused={false}
                onFocus={jest.fn()}
                roomIndex={0}
                roomCount={10}
                avatar={mockAvatar}
            />,
        );

        await user.click(screen.getByRole("option"));
        expect(mockViewModel.openRoom).toHaveBeenCalledTimes(1);
    });

    it("calls onFocus when focused", async () => {
        const onFocus = jest.fn();
        render(
            <RoomListItem
                viewModel={mockViewModel}
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
        const notificationVM: NotificationDecorationViewModel = {
            hasAnyNotificationOrActivity: true,
            isUnsentMessage: false,
            invited: false,
            isMention: false,
            isActivityNotification: true,
            isNotification: false,
            count: 0,
            muted: false,
        };
        const vmWithNotification = { ...mockViewModel, notificationViewModel: notificationVM };

        render(
            <RoomListItem
                viewModel={vmWithNotification}
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
            <RoomListItem
                viewModel={mockViewModel}
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
        expect(button).toHaveAttribute("aria-label", mockViewModel.a11yLabel);
    });
});

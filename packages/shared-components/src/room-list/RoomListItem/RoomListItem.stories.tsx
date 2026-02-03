/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX } from "react";
import { fn } from "storybook/test";

import type { Meta, StoryObj } from "@storybook/react-vite";
import { RoomListItemView, type RoomListItemSnapshot, type RoomListItemActions } from "./RoomListItem";
import { useMockedViewModel } from "../../viewmodel";
import { defaultSnapshot } from "./default-snapshot";
import { renderAvatar } from "../story-mocks";

type RoomListItemProps = RoomListItemSnapshot &
    RoomListItemActions & {
        isSelected: boolean;
        isFocused: boolean;
        onFocus: (room: any, e: React.FocusEvent) => void;
        roomIndex: number;
        roomCount: number;
        renderAvatar: (room: any) => React.ReactElement;
    };

// Wrapper component that creates a mocked ViewModel
const RoomListItemWrapper = ({
    onOpenRoom,
    onMarkAsRead,
    onMarkAsUnread,
    onToggleFavorite,
    onToggleLowPriority,
    onInvite,
    onCopyRoomLink,
    onLeaveRoom,
    onSetRoomNotifState,
    isSelected,
    isFocused,
    onFocus,
    roomIndex,
    roomCount,
    renderAvatar: renderAvatarProp,
    ...rest
}: RoomListItemProps): JSX.Element => {
    const vm = useMockedViewModel(rest, {
        onOpenRoom,
        onMarkAsRead,
        onMarkAsUnread,
        onToggleFavorite,
        onToggleLowPriority,
        onInvite,
        onCopyRoomLink,
        onLeaveRoom,
        onSetRoomNotifState,
    });
    return (
        <RoomListItemView
            vm={vm}
            isSelected={isSelected}
            isFocused={isFocused}
            onFocus={onFocus}
            roomIndex={roomIndex}
            roomCount={roomCount}
            renderAvatar={renderAvatarProp}
        />
    );
};

const meta = {
    title: "Room List/RoomListItem",
    component: RoomListItemWrapper,
    tags: ["autodocs"],
    decorators: [
        (Story) => (
            <div style={{ width: "320px", padding: "8px" }}>
                <div role="listbox" aria-label="Room list">
                    <Story />
                </div>
            </div>
        ),
    ],
    args: {
        ...defaultSnapshot,
        isSelected: false,
        isFocused: false,
        roomIndex: 0,
        roomCount: 10,
        onOpenRoom: fn(),
        onMarkAsRead: fn(),
        onMarkAsUnread: fn(),
        onToggleFavorite: fn(),
        onToggleLowPriority: fn(),
        onInvite: fn(),
        onCopyRoomLink: fn(),
        onLeaveRoom: fn(),
        onSetRoomNotifState: fn(),
        onFocus: fn(),
        renderAvatar,
    },
    parameters: {
        design: {
            type: "figma",
            url: "https://www.figma.com/design/vlmt46QDdE4dgXDiyBJXqp/ER-33-Left-Panel?node-id=101-13062",
        },
    },
} satisfies Meta<typeof RoomListItemWrapper>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Selected: Story = {
    args: {
        isSelected: true,
    },
};

export const Bold: Story = {
    args: {
        isBold: true,
        name: "Team Updates",
    },
};

export const WithNotification: Story = {
    args: {
        isBold: true,
        notification: {
            hasAnyNotificationOrActivity: true,
            isUnsentMessage: false,
            invited: false,
            isMention: false,
            isActivityNotification: false,
            isNotification: true,
            hasUnreadCount: true,
            count: 3,
            muted: false,
        },
    },
};

export const WithMention: Story = {
    args: {
        isBold: true,
        notification: {
            hasAnyNotificationOrActivity: true,
            isUnsentMessage: false,
            invited: false,
            isMention: true,
            isActivityNotification: false,
            isNotification: true,
            hasUnreadCount: true,
            count: 1,
            muted: false,
        },
    },
};

export const Invitation: Story = {
    args: {
        name: "Secret Project",
        messagePreview: "Bob invited you",
        notification: {
            hasAnyNotificationOrActivity: true,
            isUnsentMessage: false,
            invited: true,
            isMention: false,
            isActivityNotification: false,
            isNotification: false,
            hasUnreadCount: false,
            count: 0,
            muted: false,
        },
    },
};

export const UnsentMessage: Story = {
    args: {
        messagePreview: "Failed to send message",
        notification: {
            hasAnyNotificationOrActivity: true,
            isUnsentMessage: true,
            invited: false,
            isMention: false,
            isActivityNotification: false,
            isNotification: false,
            hasUnreadCount: false,
            count: 0,
            muted: false,
        },
    },
};

export const NoMessagePreview: Story = {
    args: {
        messagePreview: undefined,
    },
};

export const WithHoverMenu: Story = {
    args: {
        showMoreOptionsMenu: true,
    },
};

export const WithoutHoverMenu: Story = {
    args: {
        showMoreOptionsMenu: false,
    },
};

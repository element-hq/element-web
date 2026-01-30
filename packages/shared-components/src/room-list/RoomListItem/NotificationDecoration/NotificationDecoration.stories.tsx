/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";

import type { Meta, StoryObj } from "@storybook/react-vite";
import { NotificationDecoration, type NotificationDecorationProps } from "./NotificationDecoration";

const defaultProps: NotificationDecorationProps = {
    hasAnyNotificationOrActivity: false,
    isUnsentMessage: false,
    invited: false,
    isMention: false,
    isActivityNotification: false,
    isNotification: false,
    hasUnreadCount: false,
    count: 0,
    muted: false,
};

const meta = {
    title: "Room List/NotificationDecoration",
    component: NotificationDecoration,
    tags: ["autodocs"],
    decorators: [
        (Story) => (
            <div style={{ padding: "16px", backgroundColor: "var(--cpd-color-bg-canvas-default)" }}>
                <Story />
            </div>
        ),
    ],
    args: defaultProps,
} satisfies Meta<typeof NotificationDecoration>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NoNotification: Story = {};

export const UnsentMessage: Story = {
    args: {
        hasAnyNotificationOrActivity: true,
        isUnsentMessage: true,
    },
};

export const VideoCall: Story = {
    args: {
        hasAnyNotificationOrActivity: true,
        callType: "video",
    },
};

export const VoiceCall: Story = {
    args: {
        hasAnyNotificationOrActivity: true,
        callType: "voice",
    },
};

export const Invited: Story = {
    args: {
        hasAnyNotificationOrActivity: true,
        invited: true,
    },
};

export const Mention: Story = {
    args: {
        hasAnyNotificationOrActivity: true,
        isMention: true,
    },
};

export const MentionWithCount: Story = {
    args: {
        hasAnyNotificationOrActivity: true,
        isMention: true,
        count: 5,
    },
};

export const NotificationWithCount: Story = {
    args: {
        hasAnyNotificationOrActivity: true,
        isNotification: true,
        count: 3,
    },
};

export const ActivityIndicator: Story = {
    args: {
        hasAnyNotificationOrActivity: true,
        isActivityNotification: true,
    },
};

export const Muted: Story = {
    args: {
        muted: true,
    },
};

export const MutedWithoutActivity: Story = {
    args: {
        hasAnyNotificationOrActivity: false,
        muted: true,
    },
};

export const VideoCallWithoutActivity: Story = {
    args: {
        hasAnyNotificationOrActivity: false,
        callType: "video",
    },
};

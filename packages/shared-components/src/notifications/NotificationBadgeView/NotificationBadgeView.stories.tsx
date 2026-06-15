/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX } from "react";
import { fn } from "storybook/test";

import type { Meta, StoryObj } from "@storybook/react-vite";
import { useMockedViewModel } from "../../core/viewmodel";
import { withViewDocs } from "../../../.storybook/withViewDocs";
import {
    NotificationBadgeView,
    type NotificationBadgeViewActions,
    type NotificationBadgeViewSnapshot,
} from "./NotificationBadgeView";

type WrapperProps = NotificationBadgeViewSnapshot & NotificationBadgeViewActions;

const NotificationBadgeViewWrapperImpl = ({ onClick, ...snapshotProps }: WrapperProps): JSX.Element => {
    const vm = useMockedViewModel(snapshotProps, {
        onClick: onClick ?? fn(),
    });

    return <NotificationBadgeView vm={vm} />;
};

const NotificationBadgeViewWrapper = withViewDocs(NotificationBadgeViewWrapperImpl, NotificationBadgeView);

const meta = {
    title: "Notifications/NotificationBadgeView",
    component: NotificationBadgeViewWrapper,
    tags: ["autodocs"],
    args: {
        shouldRender: true,
        isVisible: true,
        isNotification: false,
        isHighlight: false,
        isKnocked: false,
        badgeType: "badge_2char",
        symbol: "3",
        knockLabel: "Request to join sent",
        isClickable: false,
        ariaLabel: undefined,
        tabIndex: undefined,
        tooltipLabel: undefined,
    },
} satisfies Meta<typeof NotificationBadgeViewWrapper>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Notification: Story = {};

export const Dot: Story = {
    args: {
        badgeType: "dot",
        symbol: null,
        isNotification: true,
    },
};

export const Highlight: Story = {
    args: {
        isHighlight: true,
        symbol: "!",
    },
};

export const Knocked: Story = {
    args: {
        isKnocked: true,
        symbol: "!",
    },
};

export const Clickable: Story = {
    args: {
        isClickable: true,
        ariaLabel: "Jump to first unread room",
        tabIndex: 0,
    },
};

export const WithTooltip: Story = {
    args: {
        isHighlight: true,
        symbol: "!",
        tooltipLabel: "Message did not send",
    },
};

export const Hidden: Story = {
    args: {
        shouldRender: false,
    },
};

/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX } from "react";

import type { Meta, StoryObj } from "@storybook/react-vite";
import { useMockedViewModel } from "../../core/viewmodel";
import { withViewDocs } from "../../../.storybook/withViewDocs";
import { NotificationBadgeView, type NotificationBadgeViewSnapshot } from "./NotificationBadgeView";

type WrapperProps = NotificationBadgeViewSnapshot;

const NotificationBadgeViewWrapperImpl = ({ ...snapshotProps }: WrapperProps): JSX.Element => {
    const vm = useMockedViewModel(snapshotProps, {});

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

export const Hidden: Story = {
    args: {
        shouldRender: false,
    },
};

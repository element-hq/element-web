/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX } from "react";
import { fn } from "storybook/test";

import type { Meta, StoryObj } from "@storybook/react-vite";
import {
    NotificationListView,
    type NotificationListViewActions,
    type NotificationListViewSnapshot,
} from "./NotificationListView";
import { useMockedViewModel } from "../../core/viewmodel";
import { withViewDocs } from "../../../.storybook/withViewDocs";

type NotificationListProps = NotificationListViewSnapshot & NotificationListViewActions;

const renderAvatar = (): JSX.Element => (
    <div style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--cpd-color-bg-decorative-1)" }} />
);

const NotificationListViewWrapperImpl = ({ onItemClick, loadMore, ...rest }: NotificationListProps): JSX.Element => {
    const vm = useMockedViewModel(rest, { onItemClick, loadMore });
    return (
        <div style={{ height: "400px", width: "320px", display: "flex" }}>
            <NotificationListView vm={vm} renderAvatar={renderAvatar} />
        </div>
    );
};
const NotificationListViewWrapper = withViewDocs(NotificationListViewWrapperImpl, NotificationListView);

const meta = {
    title: "Room List/NotificationListView",
    component: NotificationListViewWrapper,
    tags: ["autodocs"],
    args: {
        isLoading: false,
        items: [
            {
                id: "$1",
                roomId: "!a",
                roomName: "Design",
                preview: "Alice: @bob can you look at the Figma?",
                timestamp: "10:42",
                isMention: true,
            },
            {
                id: "$2",
                roomId: "!b",
                roomName: "Bob",
                preview: "See you tomorrow",
                timestamp: "Yesterday",
                isMention: false,
            },
        ],
        onItemClick: fn(),
        loadMore: fn(),
    },
} satisfies Meta<typeof NotificationListViewWrapper>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Empty: Story = {
    args: { items: [] },
};

export const Loading: Story = {
    args: { items: [], isLoading: true },
};

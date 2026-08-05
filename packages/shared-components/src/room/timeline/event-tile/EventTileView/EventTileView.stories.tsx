/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";

import styles from "./EventTileView.stories.module.css";
import {
    EventTileViewStory,
    eventTileStoryDefaults,
    Slot,
    StoryActionBar,
    StoryAvatar,
    StoryBody,
    StoryContextMenu,
    StoryReceipt,
    StorySender,
    StoryThreadListInfo,
    StoryTimestamp,
} from "./EventTile.stories.helpers";

const meta = {
    title: "Timeline/EventTileView",
    component: EventTileViewStory,
    tags: ["autodocs"],
    render: (args) => <EventTileViewStory {...args} />,
    argTypes: {
        shape: {
            control: "select",
            options: ["Room", "Thread", "ThreadsList", "File", "Notification", "Search", "Pinned"],
        },
        classNames: { table: { disable: true } },
        state: {
            control: "object",
        },
        onMouseEnter: { table: { disable: true } },
        onMouseLeave: { table: { disable: true } },
        onFocus: { table: { disable: true } },
        onBlur: { table: { disable: true } },
        onClick: { table: { disable: true } },
        onContextMenu: { table: { disable: true } },
        onPermalinkClick: { table: { disable: true } },
        onPermalinkContextMenu: { table: { disable: true } },
        refs: { table: { disable: true } },
        slots: { table: { category: "Slots" } },
    },
    args: {
        shape: "Room",
        state: {},
        ...eventTileStoryDefaults,
    },
} satisfies Meta<typeof EventTileViewStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Room: Story = {};

export const ThreadsList: Story = {
    args: {
        shape: "ThreadsList",
        slots: {
            sender: (
                <Slot name="sender">
                    <StorySender />
                </Slot>
            ),
            avatar: (
                <Slot name="avatar">
                    <StoryAvatar />
                </Slot>
            ),
            body: (
                <Slot name="body">
                    <StoryBody />
                </Slot>
            ),
            timestamp: (
                <Slot name="timestamp">
                    <StoryTimestamp />
                </Slot>
            ),
            notificationBadge: (
                <Slot name="notificationBadge">
                    <span className={styles.notificationDot} role="img" aria-label="Unread notifications" />
                </Slot>
            ),
            threadInfo: (
                <Slot name="threadInfo">
                    <StoryThreadListInfo />
                </Slot>
            ),
            actionBar: (
                <Slot name="actionBar">
                    <StoryActionBar />
                </Slot>
            ),
        },
    },
};

export const Thread: Story = {
    args: {
        shape: "Thread",
    },
};

export const Notification: Story = {
    args: {
        shape: "Notification",
        slots: {
            sender: (
                <Slot name="sender">
                    <StorySender />
                </Slot>
            ),
            body: (
                <Slot name="body">
                    <StoryBody />
                </Slot>
            ),
            timestamp: (
                <Slot name="timestamp">
                    <StoryTimestamp />
                </Slot>
            ),
            roomAvatar: (
                <Slot name="roomAvatar">
                    <StoryAvatar room size="28px" />
                </Slot>
            ),
            notificationRoomLabel: (
                <Slot name="notificationRoomLabel">
                    <span className={styles.roomLabel}>in Example room</span>
                </Slot>
            ),
            notificationBadge: (
                <Slot name="notificationBadge">
                    <span className={styles.notificationDot} role="img" aria-label="Unread notifications" />
                </Slot>
            ),
            threadInfo: (
                <Slot name="threadInfo">
                    <StoryThreadListInfo />
                </Slot>
            ),
            receipt: (
                <Slot name="receipt">
                    <StoryReceipt />
                </Slot>
            ),
        },
    },
};

export const File: Story = {
    args: {
        shape: "File",
        slots: {
            sender: (
                <Slot name="sender">
                    <StorySender />
                </Slot>
            ),
            avatar: (
                <Slot name="avatar">
                    <StoryAvatar />
                </Slot>
            ),
            timestamp: (
                <Slot name="timestamp">
                    <StoryTimestamp />
                </Slot>
            ),
            body: (
                <Slot name="body">
                    <StoryBody />
                </Slot>
            ),
            contextMenu: (
                <Slot name="contextMenu">
                    <StoryContextMenu />
                </Slot>
            ),
        },
    },
};

export const Highlighted: Story = {
    args: {
        shape: "Thread",
        state: { highlighted: true },
        slots: {
            sender: (
                <Slot name="sender">
                    <StorySender />
                </Slot>
            ),
            avatar: (
                <Slot name="avatar">
                    <StoryAvatar />
                </Slot>
            ),
            timestamp: (
                <Slot name="timestamp">
                    <StoryTimestamp />
                </Slot>
            ),
            body: (
                <Slot name="body">
                    <StoryBody />
                </Slot>
            ),
        },
    },
};

export const Selected: Story = {
    args: {
        shape: "Thread",
        state: { selected: true },
        slots: {
            sender: (
                <Slot name="sender">
                    <StorySender />
                </Slot>
            ),
            avatar: (
                <Slot name="avatar">
                    <StoryAvatar />
                </Slot>
            ),
            timestamp: (
                <Slot name="timestamp">
                    <StoryTimestamp />
                </Slot>
            ),
            body: (
                <Slot name="body">
                    <StoryBody />
                </Slot>
            ),
        },
    },
};

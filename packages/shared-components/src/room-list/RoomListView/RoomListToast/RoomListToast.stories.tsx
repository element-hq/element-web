/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";
import { fn } from "storybook/test";

import type { Meta, StoryObj } from "@storybook/react-vite";
import { RoomListToast } from "./RoomListToast";

const meta = {
    title: "Room List/RoomListToast",
    component: RoomListToast,
    tags: ["autodocs"],
    args: {
        type: "section_created",
        onClose: fn(),
        onClick: fn(),
    },
    argTypes: {
        type: {
            control: "select",
            options: ["section_created", "chat_moved", "unread_activity"],
        },
    },
    decorators: [
        (Story) => (
            <div style={{ position: "relative", width: "320px", height: "100px", backgroundColor: "grey" }}>
                <Story />
            </div>
        ),
    ],
    parameters: {
        design: {
            type: "figma",
            url: "https://www.figma.com/design/qurBlLqjf3mRNpyZ1ffamm/ER-213---Sections?node-id=1233-22137&t=ftTEpAma7PgRaaqB-4",
        },
    },
} satisfies Meta<typeof RoomListToast>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SectionCreated: Story = {};

export const ChatMoved: Story = {
    args: {
        type: "chat_moved",
    },
};

export const UnreadActivity: Story = {
    args: {
        type: "unread_activity",
    },
};

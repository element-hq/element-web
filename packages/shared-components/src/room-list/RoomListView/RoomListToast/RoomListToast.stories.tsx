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
    title: "Room List/RoomListView/RoomListToast",
    component: RoomListToast,
    tags: ["autodocs"],
    args: {
        type: "section_created",
        onClose: fn(),
    },
    argTypes: {
        type: {
            control: "select",
            options: ["section_created"],
        },
    },
    decorators: [
        (Story) => (
            <div style={{ position: "relative", width: "320px", height: "100px", backgroundColor: "grey" }}>
                <Story />
            </div>
        ),
    ],
} satisfies Meta<typeof RoomListToast>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SectionCreated: Story = {};

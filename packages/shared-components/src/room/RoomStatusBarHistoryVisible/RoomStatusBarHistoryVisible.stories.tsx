/*
 * Copyright (c) 2025 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { type Meta, type StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";

import { RoomStatusBarHistoryVisible } from "./RoomStatusBarHistoryVisible";

const meta = {
    title: "Structures/RoomStatusBarHistoryVisible",
    component: RoomStatusBarHistoryVisible,
    tags: ["autodocs"],
    args: {
        onClose: fn(),
    },
    parameters: {
        design: {
            type: "figma",
            url: "https://www.figma.com/design/96hBf15is3HCxTt3X7nnLW/ER-144--Encrypted-Room-History?node-id=1-62053&t=zFsl3I946nBW8qq0-4",
        },
    },
} satisfies Meta<typeof RoomStatusBarHistoryVisible>;

export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};

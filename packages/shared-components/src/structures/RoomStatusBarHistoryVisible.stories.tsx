/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { type Meta, type StoryObj } from "@storybook/react-vite/*";

import { RoomStatusBarHistoryVisible } from "./RoomStatusBarHistoryVisible";

const meta = {
    title: "Structures/RoomStatusBarHistoryVisible",
    component: RoomStatusBarHistoryVisible,
    tags: ["autodocs"],
    args: {
        onClose: () => {},
    },
} satisfies Meta<typeof RoomStatusBarHistoryVisible>;

export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};

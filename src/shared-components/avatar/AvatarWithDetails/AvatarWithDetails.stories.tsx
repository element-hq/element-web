/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";
import { type Meta, type StoryObj } from "@storybook/react-vite/*";

import { AvatarWithDetails } from "./AvatarWithDetails";

const meta = {
    title: "Avatar/AvatarWithDetails",
    component: AvatarWithDetails,
    tags: ["autodocs"],
    args: {
        avatar: <div style={{ width: 40, height: 40, backgroundColor: "#888", borderRadius: "50%" }} />,
        details: "Details about the avatar go here",
        title: "Room Name",
    },
} satisfies Meta<typeof AvatarWithDetails>;

export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};

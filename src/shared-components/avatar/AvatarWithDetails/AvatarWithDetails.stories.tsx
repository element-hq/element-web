/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";

import { AvatarWithDetails } from "./AvatarWithDetails";
import type { Meta, StoryFn } from "@storybook/react-vite";

export default {
    title: "Avatar/AvatarWithDetails",
    component: AvatarWithDetails,
    tags: ["autodocs"],
    args: {
        avatar: <div style={{ width: 40, height: 40, backgroundColor: "#888", borderRadius: "50%" }} />,
        details: "Details about the avatar go here",
        roomName: "Room Name",
    },
} as Meta<typeof AvatarWithDetails>;

const Template: StoryFn<typeof AvatarWithDetails> = (args) => <AvatarWithDetails {...args} />;

export const Default = Template.bind({});

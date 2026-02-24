/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";
import { LockSolidIcon, ErrorSolidIcon } from "@vector-im/compound-design-tokens/assets/web/icons";

import type { Meta, StoryObj } from "@storybook/react-vite";
import { EventTileBubble } from "./EventTileBubble";

const meta = {
    title: "Event/EventTileBubble",
    component: EventTileBubble,
    tags: ["autodocs"],
    args: {
        icon: <ErrorSolidIcon />,
        title: "Title goes here",
        subtitle: "Subtitle goes here",
        className: "custom-class",
    },
} satisfies Meta<typeof EventTileBubble>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const HasLockSolidIcon: Story = {
    args: {
        className: undefined,
        icon: <LockSolidIcon />,
        children: undefined,
    },
};

export const HasChildren: Story = {
    args: {
        className: undefined,
        children: <div>children</div>,
    },
};

export const IsCryptoEventBubble: Story = {
    args: {
        className: undefined,
        icon: <LockSolidIcon />,
        title: "Encryption enabled",
        subtitle: "Messages here are end-to-end encrypted. Verify XYZ in their profile - tap on their profile picture.",
    },
};

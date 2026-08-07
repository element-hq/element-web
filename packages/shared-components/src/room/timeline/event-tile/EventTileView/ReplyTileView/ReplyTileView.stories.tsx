/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { fn } from "storybook/test";

import type { Meta, StoryObj } from "@storybook/react-vite";
import { ReplyTileView } from "./ReplyTileView";

const meta = {
    title: "Timeline/EventTile/ReplyTileView",
    component: ReplyTileView,
    tags: ["autodocs"],
    args: {
        href: "#/room/!example:example.org/$event",
        onClick: fn(),
        sender: "Alice",
        children: "This is a reply preview shown inside the timeline.",
    },
} satisfies Meta<typeof ReplyTileView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Inline: Story = {
    args: {
        inline: true,
        children: "Alice waves hello",
    },
};

export const Informational: Story = {
    args: {
        info: true,
        sender: undefined,
        children: "Alice joined the room",
    },
};

export const WithoutSender: Story = {
    args: {
        sender: undefined,
        children: "A reply without sender presentation",
    },
};

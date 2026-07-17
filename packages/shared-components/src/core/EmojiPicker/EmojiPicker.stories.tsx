/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { type Meta, type StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";

import { EmojiPicker } from "./EmojiPicker";

const meta = {
    title: "Core/EmojiPicker",
    component: EmojiPicker,
    tags: ["autodocs"],
    args: {
        onChoose: fn(() => true),
        onFinished: fn(),
        onRecordRecent: fn(),
    },
} satisfies Meta<typeof EmojiPicker>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithRecents: Story = {
    args: {
        recentEmojis: ["👍", "🎉", "❤️", "🚀"],
    },
};

export const WithSelected: Story = {
    args: {
        selectedEmojis: new Set(["😀", "🙂"]),
    },
};

export const DisabledEmoji: Story = {
    args: {
        isEmojiDisabled: (unicode: string) => unicode === "😀",
    },
};

/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type Meta, type StoryObj } from "@storybook/react-vite";

import { SasEmoji } from "./SasEmoji";

const meta = {
    title: "Crypto/SasEmoji",
    component: SasEmoji,
    tags: ["autodocs"],
    args: {
        emoji: ["🍕", "🌽", "🚀", "🔒", "🔧", "🍓", "⌛"],
    },
} satisfies Meta<typeof SasEmoji>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WorstCaseAlbanian: Story = {
    globals: {
        language: "sq",
    },
    args: {
        emoji: ["🎅", "🎅", "🎅", "🎅", "🎅", "🎅", "🎅"],
    },
};

export const WorstCaseGerman: Story = {
    globals: {
        language: "de",
    },
    args: {
        emoji: ["🔧", "🔧", "🔧", "🔧", "🔧", "🔧", "🔧"],
    },
};

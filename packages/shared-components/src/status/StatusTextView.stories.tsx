/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { type Meta, type StoryObj } from "@storybook/react-vite";

import { StatusTextView } from "./StatusTextView";

const meta = {
    title: "Status/StatusTextView",
    component: StatusTextView,
    tags: ["autodocs"],
    args: {
        status: { emoji: "🦩", text: "Flamboyant" },
    },
} satisfies Meta<typeof StatusTextView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithLongText: Story = {
    args: {
        status: {
            emoji: "🐈",
            text: "This is a very long status text in order to test that the component truncates it appropriately when it inevitably overflows the available space on account of being really unnecessary verbose, to the extent that one might think it will never end.",
        },
    },
};

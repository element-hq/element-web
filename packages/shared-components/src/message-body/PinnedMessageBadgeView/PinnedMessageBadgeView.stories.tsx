/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import type { Meta, StoryObj } from "@storybook/react-vite";
import { PinnedMessageBadge } from "./PinnedMessageBadgeView";

const meta = {
    title: "Message body/PinnedMessageBadge",
    component: PinnedMessageBadge,
    tags: ["autodocs"],
} satisfies Meta<typeof PinnedMessageBadge>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithAriaDescription: Story = {
    args: {
        "aria-describedby": "event-tile-description",
        "tabIndex": 0,
    },
};

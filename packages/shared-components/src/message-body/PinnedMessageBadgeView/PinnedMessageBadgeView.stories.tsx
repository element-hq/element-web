/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import type { Meta, StoryObj } from "@storybook/react-vite";
import { PinnedMessageBadgeView } from "./PinnedMessageBadgeView";

const meta = {
    title: "Message body/PinnedMessageBadge",
    component: PinnedMessageBadgeView,
    args: {
        "aria-describedby": "event-tile-description",
        "tabIndex": 0,
    },
    tags: ["autodocs"],
} satisfies Meta<typeof PinnedMessageBadgeView>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

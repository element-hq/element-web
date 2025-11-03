/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import type { Meta, StoryObj } from "@storybook/react";

import { DateSeparator } from "./DateSeparator";

const now = Date.now();
const DAY_MS = 24 * 60 * 60 * 1000;

const meta: Meta<typeof DateSeparator> = {
    title: "Event Tiles/DateSeparator",
    component: DateSeparator,
    tags: ["autodocs"],
    args: {
        locale: "en",
    },
};

export default meta;
type Story = StoryObj<typeof DateSeparator>;

export const Today: Story = {
    args: {
        ts: now,
    },
};

export const Yesterday: Story = {
    args: {
        ts: now - DAY_MS,
    },
};

export const LastWeek: Story = {
    args: {
        ts: now - 4 * DAY_MS,
    },
};

export const LongAgo: Story = {
    args: {
        ts: now - 365 * DAY_MS,
    },
};

export const DisableRelativeTimestamps: Story = {
    args: {
        ts: now,
        disableRelativeTimestamps: true,
    },
};

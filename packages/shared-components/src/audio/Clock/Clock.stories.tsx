/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import type { Meta, StoryObj } from "@storybook/react-vite";
import { Clock } from "./Clock";

const meta = {
    title: "Audio/Clock",
    component: Clock,
    tags: ["autodocs"],
    args: {
        seconds: 20,
    },
} satisfies Meta<typeof Clock>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const LotOfSeconds: Story = {
    args: {
        seconds: 99999999999999,
    },
};

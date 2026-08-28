/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { type Meta, type StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";

import { CustomStatusView } from "./CustomStatusView";

const meta = {
    title: "Status/CustomStatusView",
    component: CustomStatusView,
    tags: ["autodocs"],
    args: {
        onSave: fn(),
        onCancel: fn(),
    },
} satisfies Meta<typeof CustomStatusView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

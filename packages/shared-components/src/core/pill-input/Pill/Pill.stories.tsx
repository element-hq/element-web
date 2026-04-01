/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";
import { fn } from "storybook/test";

import type { Meta, StoryObj } from "@storybook/react-vite";
import { Pill } from "./Pill";

const meta = {
    title: "PillInput/Pill",
    component: Pill,
    tags: ["autodocs"],
    args: {
        label: "Pill",
        children: <div style={{ width: 20, height: 20, borderRadius: "100%", backgroundColor: "#ccc" }} />,
        onClick: fn(),
    },
} satisfies Meta<typeof Pill>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const WithoutCloseButton: Story = {
    args: {
        onClick: undefined,
    },
};

/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";
import { fn } from "storybook/test";

import type { Meta, StoryObj } from "@storybook/react-vite";
import { PillInput } from "./PillInput";

const meta = {
    title: "PillInput/PillInput",
    component: PillInput,
    tags: ["autodocs"],
    args: {
        children: (
            <>
                <div style={{ minWidth: 162, height: 28, backgroundColor: "#ccc", borderRadius: "99px" }} />
                <div style={{ minWidth: 162, height: 28, backgroundColor: "#ccc", borderRadius: "99px" }} />
            </>
        ),
        onChange: fn(),
        onRemoveChildren: fn(),
        inputProps: {
            "placeholder": "Type something...",
            "aria-label": "pill input",
        },
    },
} satisfies Meta<typeof PillInput>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const NoChild: Story = { args: { children: undefined } };

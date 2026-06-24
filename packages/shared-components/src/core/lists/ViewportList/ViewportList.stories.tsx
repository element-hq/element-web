/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";

import type { Meta, StoryObj } from "@storybook/react-vite";
import { ViewportList, type ViewportListProps } from "./ViewportList";

const items = Array.from({ length: 50 }, (_, index) => `Row ${index + 1}`);

const meta = {
    title: "Core/ViewportList",
    component: ViewportList<string>,
    tags: ["autodocs"],
    decorators: [
        (Story) => (
            <div style={{ width: "320px", border: "1px solid black", padding: "8px" }}>
                <Story />
            </div>
        ),
    ],
    args: {
        as: "ul",
        itemHeight: 28,
        items,
        scrollTop: 0,
        height: 140,
        overflowItems: 3,
        overflowMargin: 1,
        className: "viewport-list-stories",
        renderItem: (item) => (
            <li
                style={{
                    listStyle: "none",
                    height: "28px",
                    display: "flex",
                    alignItems: "center",
                    padding: "0 4px",
                    borderBottom: "1px solid black",
                }}
            >
                {item}
            </li>
        ),
    },
} satisfies Meta<ViewportListProps<string>>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Scrolled: Story = {
    args: {
        scrollTop: 280,
    },
};

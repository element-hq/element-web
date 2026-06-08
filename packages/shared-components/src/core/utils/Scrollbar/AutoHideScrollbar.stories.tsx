/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";

import type { Meta, StoryObj } from "@storybook/react-vite";
import { AutoHideScrollbar } from "./AutoHideScrollbar";

const containerStyle: React.CSSProperties = {
    border: "1px solid",
    width: "200px",
    height: "150px",
};

const meta = {
    title: "Core/AutoHideScrollbar",
    component: AutoHideScrollbar,
    tags: ["autodocs", "skip-test"],
    args: {
        as: "div",
        role: "container",
        style: containerStyle,
        children: (
            <ul>
                <li>Item 1</li>
                <li>Item 2</li>
                <li>Item 3</li>
                <li>Item 4</li>
                <li>Item 5</li>
                <li>Item 6</li>
                <li>Item 7</li>
                <li>Item 8</li>
                <li>Item 9</li>
            </ul>
        ),
    },
} satisfies Meta<typeof AutoHideScrollbar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const NoOverflowY: Story = {
    args: {
        children: (
            <ul>
                <li>Item 1</li>
                <li>Item 2</li>
                <li>Item 3</li>
            </ul>
        ),
    },
};

export const NoOverflowX: Story = {
    args: {
        children: (
            <ul>
                <li>Item 1 with a very long text</li>
                <li>Item 2 with a very long text</li>
                <li>Item 3 with a very long text</li>
                <li>Item 4 with a very long text</li>
                <li>Item 5 with a very long text</li>
                <li>Item 6 with a very long text</li>
                <li>Item 7 with a very long text</li>
                <li>Item 8 with a very long text</li>
                <li>Item 9 with a very long text</li>
            </ul>
        ),
    },
};

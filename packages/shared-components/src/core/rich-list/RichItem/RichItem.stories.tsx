/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";
import { fn } from "storybook/test";

import type { Meta, StoryObj } from "@storybook/react-vite";
import { RichItem } from "./RichItem";

const currentTimestamp = new Date("2025-03-09T12:00:00Z").getTime();

const meta = {
    title: "RichList/RichItem",
    component: RichItem,
    tags: ["autodocs"],
    args: {
        avatar: <div style={{ width: 32, height: 32, backgroundColor: "#ccc", borderRadius: "50%" }} />,
        title: "Rich Item Title",
        description: "This is a description of the rich item.",
        timestamp: currentTimestamp,
        onClick: fn(),
    },
    beforeEach: () => {
        Date.now = () => new Date("2025-08-01T12:00:00Z").getTime();
    },
    parameters: {
        a11y: {
            context: "button",
        },
    },
    render: (args) => (
        <ul role="listbox" style={{ all: "unset", listStyle: "none" }}>
            <RichItem {...args} />
        </ul>
    ),
} satisfies Meta<typeof RichItem>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Selected: Story = {
    args: {
        selected: true,
    },
};

export const WithoutTimestamp: Story = {
    args: {
        timestamp: undefined,
    },
};

export const Hover: Story = {
    parameters: { pseudo: { hover: true } },
};

export const Separator: Story = {
    render: (args) => (
        <ul role="listbox" style={{ all: "unset", listStyle: "none" }}>
            <RichItem {...args} />
            <RichItem {...args} />
        </ul>
    ),
};

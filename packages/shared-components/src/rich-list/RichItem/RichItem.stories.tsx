/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";
import { fn } from "storybook/test";

import type { Meta, StoryFn } from "@storybook/react-vite";
import { RichItem } from "./RichItem";

const currentTimestamp = new Date("2025-03-09T12:00:00Z").getTime();

export default {
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
} as Meta<typeof RichItem>;

const Template: StoryFn<typeof RichItem> = (args) => (
    <ul role="listbox" style={{ all: "unset", listStyle: "none" }}>
        <RichItem {...args} />
    </ul>
);

export const Default = Template.bind({});

export const Selected = Template.bind({});
Selected.args = {
    selected: true,
};

export const WithoutTimestamp = Template.bind({});
WithoutTimestamp.args = {
    timestamp: undefined,
};

export const Hover = Template.bind({});
Hover.parameters = { pseudo: { hover: true } };

const TemplateSeparator: StoryFn<typeof RichItem> = (args) => (
    <ul role="listbox" style={{ all: "unset", listStyle: "none" }}>
        <RichItem {...args} />
        <RichItem {...args} />
    </ul>
);
export const Separator = TemplateSeparator.bind({});

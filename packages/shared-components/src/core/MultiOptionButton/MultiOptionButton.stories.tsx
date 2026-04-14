/*
 * Copyright (c) 2025 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";
import { type Meta, type StoryFn } from "@storybook/react-vite";
import SearchIcon from "@vector-im/compound-design-tokens/assets/web/icons/search";
import OverflowHorizontalIcon from "@vector-im/compound-design-tokens/assets/web/icons/overflow-horizontal";
import HelpIcon from "@vector-im/compound-design-tokens/assets/web/icons/help";

import { MultiOptionButton } from "./MultiOptionButton";
import { fn } from "storybook/test";

const meta = {
    title: "core/MultiOptionButton",
    component: MultiOptionButton,
    tags: ["autodocs"],
    args: {
        multipleOptionsButton: {
            label: "Options",
            icon: HelpIcon,
        },
    },
} satisfies Meta<typeof MultiOptionButton>;

export default meta;

const Template: StoryFn<typeof MultiOptionButton> = (args) => <MultiOptionButton {...args} />;

export const Default = Template.bind({});
Default.args = {
    options: [
        {
            label: "Split up",
            icon: OverflowHorizontalIcon,
            onSelect: fn(),
        },
        {
            label: "Search for clues",
            icon: SearchIcon,
            onSelect: fn(),
        },
    ],
};

export const WithOneOption = Template.bind({});

WithOneOption.args = {
    options: [
        {
            label: "Search for clues",
            icon: SearchIcon,
            onSelect: fn(),
        },
    ],
};

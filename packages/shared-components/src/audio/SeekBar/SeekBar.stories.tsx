/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";
import { useArgs } from "storybook/preview-api";

import { SeekBar } from "./SeekBar";
import type { Meta, StoryFn } from "@storybook/react-vite";

export default {
    title: "Audio/SeekBar",
    component: SeekBar,
    tags: ["autodocs"],
    argTypes: {
        value: {
            control: { type: "range", min: 0, max: 100, step: 1 },
        },
    },
    args: {
        value: 50,
    },
} as Meta<typeof SeekBar>;

const Template: StoryFn<typeof SeekBar> = (args) => {
    const [, updateArgs] = useArgs();
    return <SeekBar onChange={(evt) => updateArgs({ value: parseInt(evt.target.value, 10) })} {...args} />;
};

export const Default = Template.bind({});

export const Disabled = Template.bind({});
Disabled.args = {
    disabled: true,
};

/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";

import { ReactionsRowButtonTooltip } from "./ReactionsRowButtonTooltip";
import type { Meta, StoryFn } from "@storybook/react-vite";

export default {
    title: "MessageBody/ReactionsRowButtonTooltip",
    component: ReactionsRowButtonTooltip,
    tags: ["autodocs"],
    args: {
        children: "Media content goes here",
    },
} as Meta<typeof ReactionsRowButtonTooltip>;

const Template: StoryFn<typeof ReactionsRowButtonTooltip> = (args) => <ReactionsRowButtonTooltip {...args} />;

export const Default = Template.bind({});

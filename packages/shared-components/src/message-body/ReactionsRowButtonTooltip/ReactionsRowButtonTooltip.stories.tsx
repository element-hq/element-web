/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";

import { ReactionsRowButtonTooltipView } from "./ReactionsRowButtonTooltipView";
import type { Meta, StoryFn } from "@storybook/react-vite";

export default {
    title: "MessageBody/ReactionsRowButtonTooltip",
    component: ReactionsRowButtonTooltipView,
    tags: ["autodocs"],
    args: {
        children: "Media content goes here",
    },
} as Meta<typeof ReactionsRowButtonTooltipView>;

const Template: StoryFn<typeof ReactionsRowButtonTooltipView> = (args) => <ReactionsRowButtonTooltipView {...args} />;

export const Default = Template.bind({});

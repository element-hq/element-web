/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX } from "react";
import type { Meta, StoryFn } from "@storybook/react-vite";

import { useMockedViewModel } from "../../useMockedViewModel";
import {
    ReactionsRowButtonTooltipView,
    type ReactionsRowButtonTooltipViewSnapshot,
} from "./ReactionsRowButtonTooltipView";

const ReactionsRowButtonTooltipViewWrapper = (props: ReactionsRowButtonTooltipViewSnapshot): JSX.Element => {
    const vm = useMockedViewModel(props, {});
    return <ReactionsRowButtonTooltipView vm={vm} />;
};

export default {
    title: "MessageBody/ReactionsRowButtonTooltip",
    component: ReactionsRowButtonTooltipViewWrapper,
    tags: ["autodocs"],
    argTypes: {
        formattedSenders: { control: "text" },
        caption: { control: "text" },
    },
    args: {
        children: <button>👍 3</button>,
    },
} as Meta<typeof ReactionsRowButtonTooltipViewWrapper>;

const Template: StoryFn<typeof ReactionsRowButtonTooltipViewWrapper> = (args) => (
    <ReactionsRowButtonTooltipViewWrapper {...args} />
);

/**
 * Default state with formatted senders and a caption.
 */
export const Default = Template.bind({});
Default.args = {
    formattedSenders: "Alice, Bob and Charlie",
    caption: ":thumbsup:",
};

/**
 * Tooltip with many senders (truncated).
 */
export const ManySenders = Template.bind({});
ManySenders.args = {
    formattedSenders: "Alice, Bob, Charlie, David, Eve, Frank and 2 others",
    caption: ":heart:",
    children: <button>❤️ 8</button>,
};

/**
 * Tooltip without a caption (no shortcode available).
 */
export const WithoutCaption = Template.bind({});
WithoutCaption.args = {
    formattedSenders: "Alice and Bob",
    caption: undefined,
    children: <button>🎉 2</button>,
};

/**
 * When formattedSenders is undefined, no tooltip is shown.
 */
export const NoTooltip = Template.bind({});
NoTooltip.args = {
    formattedSenders: undefined,
    caption: undefined,
    children: <button>👍 1</button>,
};

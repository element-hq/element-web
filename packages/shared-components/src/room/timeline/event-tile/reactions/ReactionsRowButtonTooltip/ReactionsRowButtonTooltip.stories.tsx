/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX, type PropsWithChildren } from "react";

import type { Meta, StoryObj } from "@storybook/react-vite";
import { useMockedViewModel } from "../../../../../core/viewmodel";
import { withViewDocs } from "../../../../../../.storybook/withViewDocs";
import {
    ReactionsRowButtonTooltipView,
    type ReactionsRowButtonTooltipViewSnapshot,
} from "./ReactionsRowButtonTooltipView";

type WrapperProps = ReactionsRowButtonTooltipViewSnapshot & PropsWithChildren;

const ReactionsRowButtonTooltipViewWrapperImpl = ({ children, ...snapshotProps }: WrapperProps): JSX.Element => {
    const vm = useMockedViewModel(snapshotProps, {});
    return <ReactionsRowButtonTooltipView vm={vm}>{children}</ReactionsRowButtonTooltipView>;
};
const ReactionsRowButtonTooltipViewWrapper = withViewDocs(
    ReactionsRowButtonTooltipViewWrapperImpl,
    ReactionsRowButtonTooltipView,
);

const meta = {
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
} satisfies Meta<typeof ReactionsRowButtonTooltipViewWrapper>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
    args: {
        formattedSenders: "Alice, Bob and Charlie",
        caption: ":thumbsup:",
        tooltipOpen: true,
    },
};

export const ManySenders: Story = {
    args: {
        formattedSenders: "Alice, Bob, Charlie, David, Eve, Frank and 2 others",
        caption: ":heart:",
        children: <button>❤️ 8</button>,
        tooltipOpen: true,
    },
};

export const WithoutCaption: Story = {
    args: {
        formattedSenders: "Alice and Bob",
        caption: undefined,
        children: <button>🎉 2</button>,
        tooltipOpen: true,
    },
};

export const NoTooltip: Story = {
    args: {
        formattedSenders: undefined,
        caption: undefined,
        children: <button>👍 1</button>,
    },
};

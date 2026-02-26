/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX } from "react";
import { fn } from "storybook/test";

import type { Meta, StoryObj } from "@storybook/react-vite";
import { useMockedViewModel } from "../../viewmodel";
import { type ReactionsRowButtonTooltipViewSnapshot } from "../ReactionsRowButtonTooltip";
import {
    ReactionsRowButtonView,
    type ReactionsRowButtonViewSnapshot,
    type ReactionsRowButtonViewActions,
} from "./ReactionsRowButtonView";

type WrapperProps = Omit<ReactionsRowButtonViewSnapshot, "tooltipVm"> &
    Partial<ReactionsRowButtonViewActions> & {
        ariaLabel?: string;
        tooltipFormattedSenders?: ReactionsRowButtonTooltipViewSnapshot["formattedSenders"];
        tooltipCaption?: ReactionsRowButtonTooltipViewSnapshot["caption"];
        tooltipOpen?: ReactionsRowButtonTooltipViewSnapshot["tooltipOpen"];
    };

const ReactionsRowButtonViewWrapper = ({
    tooltipFormattedSenders,
    tooltipCaption,
    tooltipOpen,
    onClick,
    ...snapshotProps
}: WrapperProps): JSX.Element => {
    const tooltipVm = useMockedViewModel(
        {
            formattedSenders: tooltipFormattedSenders,
            caption: tooltipCaption,
            tooltipOpen,
        },
        {},
    );

    const vm = useMockedViewModel(
        {
            ...snapshotProps,
            tooltipVm,
        },
        {
            onClick: onClick ?? fn(),
        },
    );

    return <ReactionsRowButtonView vm={vm} />;
};

const meta = {
    title: "MessageBody/ReactionsRowButton",
    component: ReactionsRowButtonViewWrapper,
    tags: ["autodocs"],
    args: {
        content: "👍",
        count: 2,
        ariaLabel: "Alice and Bob reacted with 👍",
        isSelected: false,
        isDisabled: false,
        imageSrc: undefined,
        imageAlt: undefined,
        tooltipFormattedSenders: undefined,
        tooltipCaption: undefined,
        tooltipOpen: true,
    },
} satisfies Meta<typeof ReactionsRowButtonViewWrapper>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Selected: Story = {
    args: {
        isSelected: true,
    },
};

export const WithTooltip: Story = {
    args: {
        count: 3,
        tooltipFormattedSenders: "Alice, Bob and Charlie",
        tooltipCaption: ":thumbsup:",
        tooltipOpen: true,
    },
};

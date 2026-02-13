/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX } from "react";
import { fn } from "storybook/test";

import type { Meta, StoryFn } from "@storybook/react-vite";
import { useMockedViewModel } from "../../viewmodel";
import { type ReactionsRowButtonTooltipViewSnapshot } from "../ReactionsRowButtonTooltip";
import {
    ReactionsRowButtonView,
    type ReactionsRowButtonViewSnapshot,
    type ReactionsRowButtonViewActions,
} from "./ReactionsRowButtonView";

type WrapperProps = ReactionsRowButtonViewSnapshot &
    Partial<ReactionsRowButtonViewActions> & {
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

    const vm = useMockedViewModel(snapshotProps, {
        onClick: onClick ?? fn(),
        tooltipVm,
    });

    return <ReactionsRowButtonView vm={vm} />;
};

export default {
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
} as Meta<typeof ReactionsRowButtonViewWrapper>;

const Template: StoryFn<typeof ReactionsRowButtonViewWrapper> = (args) => <ReactionsRowButtonViewWrapper {...args} />;

export const Default = Template.bind({});

export const Selected = Template.bind({});
Selected.args = {
    isSelected: true,
};

export const WithTooltip = Template.bind({});
WithTooltip.args = {
    count: 3,
    tooltipFormattedSenders: "Alice, Bob and Charlie",
    tooltipCaption: ":thumbsup:",
    tooltipOpen: true,
};

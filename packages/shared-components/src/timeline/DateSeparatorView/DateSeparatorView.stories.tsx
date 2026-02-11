/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX } from "react";

import type { Meta, StoryFn } from "@storybook/react-vite";
import { DateSeparatorView, type DateSeparatorViewSnapshot } from "./DateSeparatorView";
import { useMockedViewModel } from "../../viewmodel/useMockedViewModel";

type DateSeparatorProps = DateSeparatorViewSnapshot;

const DateSeparatorViewWrapper = ({ ...rest }: DateSeparatorProps): JSX.Element => {
    const vm = useMockedViewModel(rest, {});
    return <DateSeparatorView vm={vm} />;
};

export default {
    title: "Timeline/DateSeparatorView",
    component: DateSeparatorViewWrapper,
    tags: ["autodocs"],
    args: {
        label: "Today",
        className: "",
    },
} as Meta<typeof DateSeparatorViewWrapper>;

const Template: StoryFn<typeof DateSeparatorViewWrapper> = (args) => <DateSeparatorViewWrapper {...args} />;

export const Default = Template.bind({});

export const HasExtraClassNames = Template.bind({});
HasExtraClassNames.args = {
    className: "extra_class_1 extra_class_2",
};

export const WithCustomContent = Template.bind({});
WithCustomContent.args = {
    customContent: (
        <div data-testid="custom-content" role="presentation">
            Custom content
        </div>
    ),
};

export const LongLocalizedLabel = Template.bind({});
LongLocalizedLabel.args = {
    label: "Wednesday, December 17, 2025 at 11:59 PM Coordinated Universal Time",
};

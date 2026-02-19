/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX } from "react";
import { expect, userEvent, within } from "storybook/test";

import type { Meta, StoryFn } from "@storybook/react-vite";
import { DateSeparatorView, type DateSeparatorViewSnapshot, type DateSeparatorViewActions } from "./DateSeparatorView";
import { useMockedViewModel } from "../../viewmodel/useMockedViewModel";

type DateSeparatorProps = DateSeparatorViewSnapshot & DateSeparatorViewActions;

const DateSeparatorViewWrapper = ({
    onLastWeekPicked,
    onLastMonthPicked,
    onBeginningPicked,
    onDatePicked,
    ...rest
}: DateSeparatorProps): JSX.Element => {
    const vm = useMockedViewModel(rest, { onLastWeekPicked, onLastMonthPicked, onBeginningPicked, onDatePicked });
    return <DateSeparatorView vm={vm} />;
};

export default {
    title: "Timeline/DateSeparatorView",
    component: DateSeparatorViewWrapper,
    tags: ["autodocs"],
    args: {
        label: "Today",
        jumpToEnabled: false,
        className: "",
        onLastWeekPicked: () => console.log("onLastWeekPicked"),
        onLastMonthPicked: () => console.log("onLastMonthPicked"),
        onBeginningPicked: () => console.log("onBeginningPicked"),
        onDatePicked: () => console.log("onDatePicked"),
    },
} as Meta<typeof DateSeparatorViewWrapper>;

const Template: StoryFn<typeof DateSeparatorViewWrapper> = (args) => <DateSeparatorViewWrapper {...args} />;

export const Default = Template.bind({});

export const HasExtraClassNames = Template.bind({});
HasExtraClassNames.args = {
    className: "extra_class_1 extra_class_2",
};

export const WithJumpToTooltip = Template.bind({});
WithJumpToTooltip.args = {
    jumpToEnabled: true,
};
WithJumpToTooltip.play = async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.hover(canvas.getByText("Today"));
    await expect(within(canvasElement.ownerDocument.body).findByRole("tooltip")).resolves.toBeInTheDocument();
};

export const WithJumpToDatePicker = Template.bind({});
WithJumpToDatePicker.args = {
    jumpToEnabled: true,
};
WithJumpToDatePicker.play = async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByText("Today"));
    await expect(within(canvasElement.ownerDocument.body).findByText("Jump to date")).resolves.toBeInTheDocument();
};

export const LongLocalizedLabel = Template.bind({});
LongLocalizedLabel.args = {
    label: "Wednesday, December 17, 2025 at 11:59 PM Coordinated Universal Time",
};

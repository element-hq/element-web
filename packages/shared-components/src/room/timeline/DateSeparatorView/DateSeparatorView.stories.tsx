/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX } from "react";
import { expect, userEvent, within } from "storybook/test";

import type { Meta, StoryObj } from "@storybook/react-vite";
import { DateSeparatorView, type DateSeparatorViewSnapshot, type DateSeparatorViewActions } from "./DateSeparatorView";
import { useMockedViewModel } from "../../../core/viewmodel/useMockedViewModel";
import { withViewDocs } from "../../../../.storybook/withViewDocs";

type DateSeparatorProps = DateSeparatorViewSnapshot & DateSeparatorViewActions;

const DateSeparatorViewWrapperImpl = ({
    onLastWeekPicked,
    onLastMonthPicked,
    onBeginningPicked,
    onDatePicked,
    className,
    ...rest
}: DateSeparatorProps & { className?: string }): JSX.Element => {
    const vm = useMockedViewModel(rest, { onLastWeekPicked, onLastMonthPicked, onBeginningPicked, onDatePicked });
    return <DateSeparatorView vm={vm} className={className} />;
};
const DateSeparatorViewWrapper = withViewDocs(DateSeparatorViewWrapperImpl, DateSeparatorView);

const meta = {
    title: "Timeline/DateSeparatorView",
    component: DateSeparatorViewWrapper,
    tags: ["autodocs"],
    argTypes: {
        jumpToEnabled: { control: "boolean" },
        jumpFromDate: { control: "text" },
        className: { control: "text" },
    },
    args: {
        label: "Today",
    },
} satisfies Meta<typeof DateSeparatorViewWrapper>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const HasExtraClassNames: Story = {
    args: {
        className: "extra_class_1 extra_class_2",
    },
};

export const WithJumpToTooltip: Story = {
    args: {
        jumpToEnabled: true,
        jumpFromDate: "2025-01-15",
        onLastWeekPicked: () => console.log("onLastWeekPicked"),
        onLastMonthPicked: () => console.log("onLastMonthPicked"),
        onBeginningPicked: () => console.log("onBeginningPicked"),
        onDatePicked: () => console.log("onDatePicked"),
    },
    play: async ({ canvasElement }) => {
        const canvas = within(canvasElement);
        await userEvent.hover(canvas.getByText("Today"));
        await expect(within(canvasElement.ownerDocument.body).findByRole("tooltip")).resolves.toBeInTheDocument();
    },
};

export const WithJumpToDatePicker: Story = {
    args: {
        jumpToEnabled: true,
        jumpFromDate: "2025-01-15",
        onLastWeekPicked: () => console.log("onLastWeekPicked"),
        onLastMonthPicked: () => console.log("onLastMonthPicked"),
        onBeginningPicked: () => console.log("onBeginningPicked"),
        onDatePicked: () => console.log("onDatePicked"),
    },
    play: async ({ canvasElement }) => {
        const canvas = within(canvasElement);
        await userEvent.click(canvas.getByText("Today"));
        await expect(within(canvasElement.ownerDocument.body).findByText("Jump to date")).resolves.toBeInTheDocument();
    },
};

export const LongLocalizedLabel: Story = {
    args: {
        label: "Wednesday, December 17, 2025 at 11:59 PM Coordinated Universal Time",
    },
};

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
import {
    TileErrorView,
    type TileErrorViewActions,
    type TileErrorViewLayout,
    type TileErrorViewSnapshot,
} from "./TileErrorView";

type WrapperProps = TileErrorViewSnapshot &
    Partial<TileErrorViewActions> & {
        className?: string;
        layout?: TileErrorViewLayout;
    };

const TileErrorViewWrapper = ({
    className,
    layout,
    onBugReportClick,
    onViewSourceClick,
    ...snapshotProps
}: WrapperProps): JSX.Element => {
    const vm = useMockedViewModel(snapshotProps, {
        onBugReportClick: onBugReportClick ?? fn(),
        onViewSourceClick: onViewSourceClick ?? fn(),
    });

    return (
        <ul>
            <TileErrorView vm={vm} className={className} layout={layout} />
        </ul>
    );
};

const meta = {
    title: "MessageBody/TileErrorView",
    component: TileErrorViewWrapper,
    tags: ["autodocs"],
    args: {
        message: "Can't load this message",
        eventType: "m.room.message",
        bugReportCtaLabel: "Submit debug logs",
        viewSourceCtaLabel: "View source",
        layout: "group",
    },
} satisfies Meta<typeof TileErrorViewWrapper>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const BubbleLayout: Story = {
    args: {
        layout: "bubble",
    },
};

export const WithoutActions: Story = {
    args: {
        bugReportCtaLabel: undefined,
        viewSourceCtaLabel: undefined,
    },
};

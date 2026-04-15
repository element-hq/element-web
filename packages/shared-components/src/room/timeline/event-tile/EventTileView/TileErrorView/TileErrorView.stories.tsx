/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type ComponentProps, type JSX } from "react";
import { fn } from "storybook/test";

import type { Meta, StoryObj } from "@storybook/react-vite";
import { withViewDocs } from "../../../../../../.storybook/withViewDocs";
import { useMockedViewModel } from "../../../../../core/viewmodel";
import { TileErrorView, type TileErrorViewActions, type TileErrorViewSnapshot } from "./TileErrorView";

type WrapperProps = TileErrorViewSnapshot &
    Partial<TileErrorViewActions> &
    Omit<ComponentProps<typeof TileErrorView>, "vm">;

const TileErrorViewWrapperImpl = ({
    className,
    onBugReportClick = fn(),
    onViewSourceClick = fn(),
    ...snapshotProps
}: WrapperProps): JSX.Element => {
    const vm = useMockedViewModel(snapshotProps, {
        onBugReportClick,
        onViewSourceClick,
    });

    return <TileErrorView vm={vm} className={className} />;
};

const TileErrorViewWrapper = withViewDocs(TileErrorViewWrapperImpl, TileErrorView);

const meta = {
    title: "Room/Timeline/EventTile/EventTileView/TileErrorView",
    component: TileErrorViewWrapper,
    tags: ["autodocs"],
    decorators: [
        (Story): JSX.Element => (
            <ul>
                <Story />
            </ul>
        ),
    ],
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

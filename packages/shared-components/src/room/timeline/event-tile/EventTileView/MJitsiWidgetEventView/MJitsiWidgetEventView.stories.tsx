/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX } from "react";

import type { Meta, StoryObj } from "@storybook/react-vite";
import { useMockedViewModel } from "../../../../../core/viewmodel";
import { withViewDocs } from "../../../../../../.storybook/withViewDocs";
import { MJitsiWidgetEventView, type MJitsiWidgetEventViewSnapshot } from "./MJitsiWidgetEventView";

type MJitsiWidgetEventViewProps = MJitsiWidgetEventViewSnapshot & {
    className?: string;
};

const MJitsiWidgetEventViewWrapperImpl = ({
    className,
    ...snapshot
}: MJitsiWidgetEventViewProps): JSX.Element | null => {
    const vm = useMockedViewModel(snapshot, {});

    return <MJitsiWidgetEventView vm={vm} className={className} />;
};

const MJitsiWidgetEventViewWrapper = withViewDocs(MJitsiWidgetEventViewWrapperImpl, MJitsiWidgetEventView);

const meta = {
    title: "Timeline/Timeline Event/MJitsiWidgetEventView",
    component: MJitsiWidgetEventViewWrapper,
    tags: ["autodocs"],
    args: {
        isVisible: true,
        title: "Video conference started by Alice",
        subtitle: "Join the conference at the top of this room",
        className: "",
    },
} satisfies Meta<typeof MJitsiWidgetEventViewWrapper>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Started: Story = {};

export const Updated: Story = {
    args: {
        title: "Video conference updated by Alice",
        subtitle: "Join the conference from the room information card on the right",
    },
};

export const Ended: Story = {
    args: {
        title: "Video conference ended by Alice",
        subtitle: null,
    },
};

export const Hidden: Story = {
    args: {
        isVisible: false,
        title: "",
        subtitle: null,
    },
};

export const WithTimestamp: Story = {
    args: {
        timestamp: <span>14:56</span>,
    },
};

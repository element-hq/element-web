/*
Copyright 2026 Element Creations Ltd.
Copyright 2024 New Vector Ltd.
Copyright 2019 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX } from "react";
import { fn } from "storybook/test";

import type { Meta, StoryObj } from "@storybook/react-vite";
import { useMockedViewModel } from "../../../../../core/viewmodel";
import { withViewDocs } from "../../../../../../.storybook/withViewDocs";
import {
    ViewSourceEventView,
    type ViewSourceEventViewActions,
    type ViewSourceEventViewSnapshot,
} from "./ViewSourceEventView";

type ViewSourceEventViewProps = ViewSourceEventViewSnapshot &
    ViewSourceEventViewActions & {
        className?: string;
        expandedClassName?: string;
    };

const source = JSON.stringify(
    {
        type: "m.room.message",
        sender: "@alice:example.org",
        content: {
            msgtype: "m.text",
            body: "Hello",
        },
    },
    null,
    4,
);

const ViewSourceEventViewWrapperImpl = ({
    onToggle,
    className,
    expandedClassName,
    ...snapshot
}: ViewSourceEventViewProps): JSX.Element => {
    const vm = useMockedViewModel(snapshot, { onToggle });

    return <ViewSourceEventView vm={vm} className={className} expandedClassName={expandedClassName} />;
};

const ViewSourceEventViewWrapper = withViewDocs(ViewSourceEventViewWrapperImpl, ViewSourceEventView);

const meta = {
    title: "Timeline/Timeline Event/ViewSourceEventView",
    component: ViewSourceEventViewWrapper,
    tags: ["autodocs"],
    args: {
        expanded: false,
        preview: '{ "type": m.room.message }',
        source,
        onToggle: fn(),
        className: "",
        expandedClassName: "",
    },
} satisfies Meta<typeof ViewSourceEventViewWrapper>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Expanded: Story = {
    args: {
        expanded: true,
    },
};

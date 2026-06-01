/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX } from "react";
import { fn } from "storybook/test";

import type { Meta, StoryObj } from "@storybook/react-vite";
import { useMockedViewModel } from "../../../../../core/viewmodel";
import { withViewDocs } from "../../../../../../.storybook/withViewDocs";
import {
    ThreadSummaryView,
    type ThreadMessagePreviewViewSnapshot,
    type ThreadSummaryViewActions,
    type ThreadSummaryViewSnapshot,
} from "./ThreadSummaryView";

type WrapperProps = Omit<ThreadSummaryViewSnapshot, "previewVm"> &
    Partial<ThreadSummaryViewActions> & {
        preview: ThreadMessagePreviewViewSnapshot;
    };

const ThreadSummaryViewWrapperImpl = ({ onClick, preview, ...snapshotProps }: Readonly<WrapperProps>): JSX.Element => {
    const previewVm = useMockedViewModel(preview, {});
    const vm = useMockedViewModel(
        {
            ...snapshotProps,
            previewVm,
        },
        {
            onClick: onClick ?? fn(),
        },
    );

    return <ThreadSummaryView vm={vm} />;
};

const ThreadSummaryViewWrapper = withViewDocs(ThreadSummaryViewWrapperImpl, ThreadSummaryView);

const defaultPreview: ThreadMessagePreviewViewSnapshot = {
    isVisible: true,
    avatar: {
        id: "@alice:example.org",
        name: "Alice",
        label: "User avatar",
    },
    showDisplayName: true,
    senderName: "Alice",
    previewContent: "Can you review the draft?",
    previewTooltip: "Can you review the draft?",
};

const meta = {
    title: "Timeline/Timeline Event/ThreadSummary",
    component: ThreadSummaryViewWrapper,
    tags: ["autodocs"],
    args: {
        isVisible: true,
        replyCountLabel: "3 replies",
        openThreadLabel: "Open thread",
        notificationIndicator: undefined,
        narrow: false,
        preview: defaultPreview,
    },
} satisfies Meta<typeof ThreadSummaryViewWrapper>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Narrow: Story = {
    args: {
        replyCountLabel: "3",
        narrow: true,
        preview: {
            ...defaultPreview,
            showDisplayName: false,
        },
    },
};

export const WithNotification: Story = {
    args: {
        notificationIndicator: "critical",
    },
};

export const DecryptionFailure: Story = {
    args: {
        preview: {
            ...defaultPreview,
            previewContent: "Unable to decrypt message",
            previewTooltip: "Unable to decrypt message",
        },
    },
};

export const Hidden: Story = {
    args: {
        isVisible: false,
    },
};

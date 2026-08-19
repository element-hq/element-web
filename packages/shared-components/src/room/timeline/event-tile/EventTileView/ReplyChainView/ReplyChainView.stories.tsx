/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";

import { useMockedViewModel } from "../../../../../core/viewmodel";
import layoutMeta from "../EventTileView.stories";
import {
    ReplyChainView,
    type ReplyChainViewModel,
    type ReplyChainViewProps,
    type ReplyChainViewSnapshot,
} from "./index";

const { StoryReplyChainPill, StoryReplyTile } = layoutMeta.storyHelpers;

function ReplyChainViewStory({ snapshot }: { snapshot: ReplyChainViewSnapshot }): JSX.Element {
    const vm = Object.assign(useMockedViewModel(snapshot, {}), {
        onQuoteClick: fn(),
        setQuoteExpanded: fn(),
    }) as ReplyChainViewModel;

    const props: ReplyChainViewProps = {
        vm,
        renderHeaderPill: () => <StoryReplyChainPill />,
        renderReplyTile: (event) => <StoryReplyTile eventId={event.id} />,
    };

    return <ReplyChainView {...props} />;
}

const meta = {
    title: "Timeline/EventTile/ReplyChainView",
    component: ReplyChainViewStory,
    tags: ["autodocs"],
    args: {
        snapshot: {
            status: "ready",
            events: [{ id: "$event-1", color: 2 }],
            headerEventId: "$event-1",
            isQuoteExpanded: undefined,
        },
    },
} satisfies Meta<typeof ReplyChainViewStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithoutReplyHeader: Story = {
    args: {
        snapshot: {
            status: "ready",
            events: [{ id: "$event-1", color: 2 }],
            isQuoteExpanded: undefined,
        },
    },
};

export const Expanded: Story = {
    args: {
        snapshot: {
            status: "ready",
            events: [
                { id: "$event-1", color: 2 },
                { id: "$event-2", color: 4 },
            ],
            headerEventId: "$event-1",
            isQuoteExpanded: true,
        },
    },
};

export const Collapsed: Story = {
    args: {
        snapshot: {
            status: "ready",
            events: [{ id: "$event-1", color: 2 }],
            headerEventId: "$event-1",
            isQuoteExpanded: false,
        },
    },
};

export const Loading: Story = {
    args: {
        snapshot: { status: "loading", events: [] },
    },
};

export const Error: Story = {
    args: {
        snapshot: { status: "error", events: [] },
    },
};

export const Export: Story = {
    args: {
        snapshot: {
            status: "export",
            events: [],
            parentEventId: "$parent-event",
        },
    },
};

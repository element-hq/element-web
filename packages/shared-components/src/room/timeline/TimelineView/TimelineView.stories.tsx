/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX } from "react";
import { fn, expect, waitFor } from "storybook/test";
import type { Meta, StoryObj } from "@storybook/react-vite";

import { TimelineView } from "./TimelineView";
import type { TimelineItem, TimelineViewActions, TimelineViewSnapshot } from "./types";
import { useMockedViewModel } from "../../../core/viewmodel";
import { withViewDocs } from "../../../../.storybook/withViewDocs";

// A handful of deterministic, fixed-height message rows so the virtualizer lays
// out predictably for the visual snapshot (no avatars/media to decode).
const SENDERS = ["Alice", "Bob", "Carol"];
const LINES = [
    "Morning! Did the deploy go out?",
    "Yep, green across the board.",
    "Nice. I'll close the ticket then.",
    "One flaky test on CI, re-running.",
    "Passed on the second go.",
    "Great, merging now.",
];
const mockEvents = Array.from({ length: 12 }, (_, i) => ({
    key: `evt-${i}`,
    sender: SENDERS[i % SENDERS.length],
    body: LINES[i % LINES.length],
}));
const mockContent = new Map(mockEvents.map((e) => [e.key, e]));

const mockItems: TimelineItem[] = mockEvents.map((e) => ({
    key: e.key,
    kind: "event",
    continuation: false,
    lastInSection: true,
}));

const renderItem = (item: TimelineItem): React.ReactNode => {
    const content = mockContent.get(item.key);
    if (!content) return null;
    return (
        <div style={{ padding: "6px 12px", minHeight: "44px", boxSizing: "border-box" }}>
            <div style={{ fontWeight: 600, fontSize: "13px", color: "var(--cpd-color-text-primary)" }}>
                {content.sender}
            </div>
            <div style={{ fontSize: "14px", color: "var(--cpd-color-text-primary)" }}>{content.body}</div>
        </div>
    );
};

type TimelineStoryProps = TimelineViewSnapshot & TimelineViewActions;

const TimelineViewWrapperImpl = ({
    onStartReached,
    onEndReached,
    onAnchorReached,
    onVisibleRangeChanged,
    onAtBottomStateChange,
    onJumpToReadMarker,
    onMarkAllAsRead,
    onJumpToLive,
    ...snapshot
}: TimelineStoryProps): JSX.Element => {
    const vm = useMockedViewModel(snapshot, {
        onStartReached,
        onEndReached,
        onAnchorReached,
        onVisibleRangeChanged,
        onAtBottomStateChange,
        onJumpToReadMarker,
        onMarkAllAsRead,
        onJumpToLive,
    });
    return (
        <div style={{ height: "400px", border: "1px solid #ccc" }}>
            <TimelineView vm={vm} renderItem={renderItem} />
        </div>
    );
};
const TimelineViewWrapper = withViewDocs(TimelineViewWrapperImpl, TimelineView);

// The timeline lays out hidden behind a cover and reveals once the anchor settles
// (a couple of animation frames). Wait for that before the snapshot is captured.
const waitForReveal: NonNullable<StoryObj["play"]> = async ({ canvasElement }) => {
    const scroller = canvasElement.querySelector<HTMLElement>('[data-testid="timeline-scroller"]');
    await waitFor(() => expect(scroller).toBeVisible());
};

const meta = {
    title: "Timeline/TimelineView",
    component: TimelineViewWrapper,
    tags: ["autodocs"],
    args: {
        items: mockItems,
        atLiveEnd: true,
        pendingAnchor: null,
        highlightedEventId: null,
        isAtBottom: true,
        canJumpToReadMarker: false,
        numUnreadMessages: 0,
        hasHighlights: false,
        onStartReached: fn(),
        onEndReached: fn(),
        onAnchorReached: fn(),
        onVisibleRangeChanged: fn(),
        onAtBottomStateChange: fn(),
        onJumpToReadMarker: fn(),
        onMarkAllAsRead: fn(),
        onJumpToLive: fn(),
    },
    decorators: [
        (Story) => (
            <div style={{ width: "420px" }}>
                <Story />
            </div>
        ),
    ],
    play: waitForReveal,
    // The virtualizer measures real DOM and reveals over a couple of frames; allow a
    // little more pixel slack than the global default to absorb sub-pixel layout jitter.
    parameters: {
        snapshot: {
            failureThreshold: 30,
        },
    },
} satisfies Meta<typeof TimelineViewWrapper>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A live timeline pinned to the bottom — no overlay controls. */
export const Default: Story = {};

/** Scrolled up off the live end, with unread messages: the jump-to-bottom badge shows. */
export const WithJumpToBottom: Story = {
    args: {
        atLiveEnd: false,
        isAtBottom: false,
        numUnreadMessages: 3,
    },
};

/** A read marker above the viewport surfaces the unread bar. */
export const WithUnreadMarker: Story = {
    args: {
        canJumpToReadMarker: "above",
    },
};

/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX } from "react";
import { fn } from "storybook/test";
import type { Meta, StoryObj } from "@storybook/react-vite";

import { TimelineOverlayButtons } from "./TimelineOverlayButtons";
import type { ImmediateScroll, TimelineViewActions, TimelineViewSnapshot } from "./types";

// The overlay takes an already-split snapshot + actions (not a ViewModel), so the
// story flattens them into props — this lets interaction tests override a single
// action (e.g. onJumpToLive) without rebuilding the whole object.
type OverlayStoryProps = TimelineViewSnapshot & TimelineViewActions & { scrollNow: ImmediateScroll };

const TimelineOverlayButtonsWrapper = ({
    onStartReached,
    onEndReached,
    onAnchorReached,
    onVisibleRangeChanged,
    onAtBottomStateChange,
    onJumpToReadMarker,
    onMarkAllAsRead,
    onJumpToLive,
    scrollNow,
    ...snapshot
}: OverlayStoryProps): JSX.Element => {
    const vm: TimelineViewActions = {
        onStartReached,
        onEndReached,
        onAnchorReached,
        onVisibleRangeChanged,
        onAtBottomStateChange,
        onJumpToReadMarker,
        onMarkAllAsRead,
        onJumpToLive,
    };
    return <TimelineOverlayButtons snapshot={snapshot} vm={vm} scrollNow={scrollNow} />;
};

const meta = {
    title: "Timeline/TimelineOverlayButtons",
    component: TimelineOverlayButtonsWrapper,
    tags: ["autodocs"],
    args: {
        // Snapshot defaults: scrolled up off the live end so the jump-to-bottom shows.
        items: [],
        atLiveEnd: false,
        pendingAnchor: null,
        highlightedEventId: null,
        isAtBottom: false,
        canJumpToReadMarker: false,
        numUnreadMessages: 0,
        hasHighlights: false,
        // Actions.
        onStartReached: fn(),
        onEndReached: fn(),
        onAnchorReached: fn(),
        onVisibleRangeChanged: fn(),
        onAtBottomStateChange: fn(),
        onJumpToReadMarker: fn(),
        onMarkAllAsRead: fn(),
        onJumpToLive: fn(),
        scrollNow: fn(),
    },
    // The overlay absolutely fills its positioned parent; give it a sized box to sit in.
    decorators: [
        (Story) => (
            <div style={{ position: "relative", width: "360px", height: "260px", border: "1px solid #ccc" }}>
                <Story />
            </div>
        ),
    ],
} satisfies Meta<typeof TimelineOverlayButtonsWrapper>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Scrolled up off the live end: the jump-to-bottom button, no unread. */
export const JumpToBottom: Story = {};

/** Jump-to-bottom carrying an unread-message badge. */
export const JumpToBottomWithUnread: Story = {
    args: { numUnreadMessages: 5 },
};

/** Jump-to-bottom with the highlight (mention/keyword) colouring. */
export const JumpToBottomWithHighlight: Story = {
    args: { numUnreadMessages: 3, hasHighlights: true },
};

/** Read marker sits above the viewport: scroll-up + mark-as-read bar (top-right). */
export const UnreadMarkerAbove: Story = {
    args: { atLiveEnd: true, isAtBottom: true, canJumpToReadMarker: "above" },
};

/** Read marker sits below the viewport: scroll-down + mark-as-read bar. */
export const UnreadMarkerBelow: Story = {
    args: { atLiveEnd: true, isAtBottom: true, canJumpToReadMarker: "below" },
};

/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";
import { render, screen } from "@test-utils";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";

import { TimelineOverlayButtons } from "./TimelineOverlayButtons";
import type { TimelineViewActions, TimelineViewSnapshot } from "./types";

const baseSnapshot: TimelineViewSnapshot = {
    items: [],
    atLiveEnd: true,
    pendingAnchor: null,
    highlightedEventId: null,
    isAtBottom: true,
    canJumpToReadMarker: false,
    numUnreadMessages: 0,
    hasHighlights: false,
};

// vi.fn() carries a constructable signature that trips assignability to the
// action method types, so cast the record of spies to the interface.
function makeActions(): TimelineViewActions {
    return {
        onStartReached: vi.fn(),
        onEndReached: vi.fn(),
        onAnchorReached: vi.fn(),
        onVisibleRangeChanged: vi.fn(),
        onAtBottomStateChange: vi.fn(),
        onJumpToReadMarker: vi.fn(),
        onMarkAllAsRead: vi.fn(),
        onJumpToLive: vi.fn(),
    } as unknown as TimelineViewActions;
}

// The jump controls must be exposed to AT/keyboard (the overlay is not aria-hidden),
// so plain role queries (which exclude hidden elements) are expected to find them.
const button = (name: string): HTMLElement => screen.getByRole("button", { name });
const queryButton = (name: string): HTMLElement | null => screen.queryByRole("button", { name });

const JUMP_TO_BOTTOM = "Scroll to most recent messages";
const JUMP_READ_MARKER = "Scroll to first unread message.";
const MARK_ALL_READ = "Mark all as read";

describe("<TimelineOverlayButtons />", () => {
    it("renders no buttons at the live bottom with no read marker", () => {
        const actions = makeActions();
        render(<TimelineOverlayButtons snapshot={baseSnapshot} vm={actions} scrollNow={vi.fn()} />);

        expect(queryButton(JUMP_TO_BOTTOM)).toBeNull();
        expect(queryButton(JUMP_READ_MARKER)).toBeNull();
        expect(queryButton(MARK_ALL_READ)).toBeNull();
    });

    describe("jump-to-bottom button", () => {
        it("shows when not at the live end", () => {
            render(
                <TimelineOverlayButtons
                    snapshot={{ ...baseSnapshot, atLiveEnd: false }}
                    vm={makeActions()}
                    scrollNow={vi.fn()}
                />,
            );
            expect(button(JUMP_TO_BOTTOM)).toBeInTheDocument();
        });

        it("shows when at the live end but scrolled up off the bottom", () => {
            render(
                <TimelineOverlayButtons
                    snapshot={{ ...baseSnapshot, atLiveEnd: true, isAtBottom: false }}
                    vm={makeActions()}
                    scrollNow={vi.fn()}
                />,
            );
            expect(button(JUMP_TO_BOTTOM)).toBeInTheDocument();
        });

        it("calls onJumpToLive with the imperative scroll handle when clicked", async () => {
            const user = userEvent.setup();
            const actions = makeActions();
            const scrollNow = vi.fn();
            render(
                <TimelineOverlayButtons
                    snapshot={{ ...baseSnapshot, isAtBottom: false }}
                    vm={actions}
                    scrollNow={scrollNow}
                />,
            );

            await user.click(button(JUMP_TO_BOTTOM));

            expect(actions.onJumpToLive).toHaveBeenCalledWith(scrollNow);
        });

        it("renders the unread badge count", () => {
            render(
                <TimelineOverlayButtons
                    snapshot={{ ...baseSnapshot, isAtBottom: false, numUnreadMessages: 7 }}
                    vm={makeActions()}
                    scrollNow={vi.fn()}
                />,
            );
            expect(screen.getByText("7")).toBeInTheDocument();
        });

        it("omits the badge when there are no unread messages", () => {
            render(
                <TimelineOverlayButtons
                    snapshot={{ ...baseSnapshot, isAtBottom: false, numUnreadMessages: 0 }}
                    vm={makeActions()}
                    scrollNow={vi.fn()}
                />,
            );
            expect(screen.queryByText("0")).toBeNull();
        });

        it("applies the highlight style when there are highlight messages", () => {
            const { container } = render(
                <TimelineOverlayButtons
                    snapshot={{ ...baseSnapshot, isAtBottom: false, numUnreadMessages: 1, hasHighlights: true }}
                    vm={makeActions()}
                    scrollNow={vi.fn()}
                />,
            );
            expect(container.querySelector('[class*="highlight"]')).not.toBeNull();
        });
    });

    describe("unread bar", () => {
        it("shows scroll-up and mark-as-read when the marker is above the viewport", () => {
            render(
                <TimelineOverlayButtons
                    snapshot={{ ...baseSnapshot, canJumpToReadMarker: "above" }}
                    vm={makeActions()}
                    scrollNow={vi.fn()}
                />,
            );
            expect(button(JUMP_READ_MARKER)).toBeInTheDocument();
            expect(button(MARK_ALL_READ)).toBeInTheDocument();
        });

        it("shows the bar when the marker is below the viewport", () => {
            render(
                <TimelineOverlayButtons
                    snapshot={{ ...baseSnapshot, canJumpToReadMarker: "below" }}
                    vm={makeActions()}
                    scrollNow={vi.fn()}
                />,
            );
            expect(button(JUMP_READ_MARKER)).toBeInTheDocument();
            expect(button(MARK_ALL_READ)).toBeInTheDocument();
        });

        it("calls onJumpToReadMarker with the scroll handle and onMarkAllAsRead on click", async () => {
            const user = userEvent.setup();
            const actions = makeActions();
            const scrollNow = vi.fn();
            render(
                <TimelineOverlayButtons
                    snapshot={{ ...baseSnapshot, canJumpToReadMarker: "above" }}
                    vm={actions}
                    scrollNow={scrollNow}
                />,
            );

            await user.click(button(JUMP_READ_MARKER));
            expect(actions.onJumpToReadMarker).toHaveBeenCalledWith(scrollNow);

            await user.click(button(MARK_ALL_READ));
            expect(actions.onMarkAllAsRead).toHaveBeenCalledTimes(1);
        });
    });
});

/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import type { ReactNode } from "react";
import type { ViewModel } from "../../../core/viewmodel/ViewModel";

// ─── Timeline item: one renderable row ─────────────────────────────

/** Discriminated union of every row kind the timeline can render. */
export type TimelineItemKind =
    | "event"
    | "date-separator"
    | "read-marker"
    | "loading"
    | "gap";

export interface EventTimelineItem {
    key: string;
    kind: "event";
    /** Whether this event continues unbroken from the previous sender (suppresses avatar/name). */
    continuation: boolean;
}

export interface DateSeparatorTimelineItem {
    key: string;
    kind: "date-separator";
    label: string;
}

export interface ReadMarkerTimelineItem {
    key: string;
    kind: "read-marker";
}

export interface LoadingTimelineItem {
    key: string;
    kind: "loading";
}

export interface GapTimelineItem {
    key: string;
    kind: "gap";
}

export type TimelineItem =
    | EventTimelineItem
    | DateSeparatorTimelineItem
    | ReadMarkerTimelineItem
    | LoadingTimelineItem
    | GapTimelineItem;

// ─── Navigation anchor ─────────────────────────────────────────────

/** Where in the viewport to place the target when scrolling to an anchor. */
export type AnchorAlign = "start" | "center" | "end";

export interface NavigationAnchor {
    /** The `TimelineItem.key` to scroll to. */
    targetKey: string;
    /** Where in the viewport to place the target. */
    align: AnchorAlign;
    /** Whether to visually highlight the target item after scrolling. */
    highlight?: boolean;
}

/**
 * An imperative scroll capability provided by the View to ViewModel actions.
 *
 * The View closes over its `VirtuosoHandle` ref to scroll to a given anchor
 * immediately, without depending on a subsequent data update. The ViewModel
 * invokes it only when the target is already in the loaded window — otherwise
 * the VM falls back to setting `pendingAnchor` and letting a load() drive the
 * scroll once new data arrives.
 *
 * Must be invoked synchronously inside the action; the View's closure captures
 * the current items snapshot to resolve the target's array index.
 */
export type ImmediateScroll = (anchor: NavigationAnchor) => void;

// ─── Loading & error ───────────────────────────────────────────────

export type PaginationState = "idle" | "loading" | "error";

// ─── Timeline view model contract ──────────────────────────────────

export interface TimelineViewSnapshot {
    /** The ordered list of items to render. */
    items: TimelineItem[];

    /**
     * Virtuoso firstItemIndex — starts high and decreases as backward
     * pagination prepends items. Kept in the snapshot so it updates
     * atomically with `items`.
     */
    firstItemIndex: number;

    /** Pagination state at each end of the loaded window. */
    backwardPagination: PaginationState;
    forwardPagination: PaginationState;

    /**
     * True when the timeline window has reached the live end — i.e. there are
     * no more forward events to paginate to. Used to gate `followOutput` so
     * that Virtuoso only auto-scrolls to the bottom when we are actually
     * viewing the live end of the room.
     */
    atLiveEnd: boolean;

    /**
     * If set, the container should scroll to this anchor on the
     * next render. The container clears it after executing the scroll.
     */
    pendingAnchor: NavigationAnchor | null;

    /**
     * The event ID that should be visually highlighted (e.g. permalink target).
     * Unlike `pendingAnchor`, this is not cleared after scrolling — it persists
     * so the event tile stays highlighted.
     */
    highlightedEventId: string | null;

    /** True when Virtuoso reports the list is scrolled to the bottom (within the default 4px threshold). */
    isAtBottom: boolean;

    /**
     * Whether a read-marker is visible above (`"above"`) or below (`"below"`) the
     * current viewport, or not reachable/applicable (`false`).
     * - `"above"` — marker is above the viewport (or above the loaded window).
     * - `"below"` — marker is below the viewport but within the loaded window.
     * Controls visibility and direction of the "Jump to unread" / "Mark as read" bar.
     */
    canJumpToReadMarker: "above" | "below" | false;

    /**
     * Number of new messages that have arrived since the user last scrolled
     * to the live bottom. Reset to zero when the user reaches the live bottom.
     * Used as the badge count on the "Jump to bottom" button.
     */
    numUnreadMessages: number;

    /**
     * True when at least one of the new-since-leaving-bottom messages is a
     * highlight (mention / keyword). Drives the highlight style on the
     * "Jump to bottom" button.
     */
    hasHighlights: boolean;
}

export interface TimelineViewActions {
    /** Called when Virtuoso fires startReached; VM decides whether to paginate. */
    onStartReached(): void;

    /** Called when Virtuoso fires endReached; VM decides whether to paginate. */
    onEndReached(): void;

    /** Report that the container has scrolled to the pending anchor. */
    onAnchorReached(): void;

    /**
     * Called by Virtuoso's rangeChanged on every visible-range update.
     * The VM uses this to track the bottommost visible event for scroll-position persistence.
     * Indices are 0-based into the items array.
     */
    onVisibleRangeChanged(startIndex: number, endIndex: number): void;

    /** Called by Virtuoso's atBottomStateChange; VM uses this to decide whether to clear the saved scroll position on dispose. */
    onAtBottomStateChange(atBottom: boolean): void;

    /**
     * Scroll to the read-marker item (jump to unread messages).
     *
     * `scrollNow` is invoked synchronously when the marker is already in the
     * loaded window (no data update needed). Otherwise the VM triggers a load
     * at the marker and the scroll happens via `pendingAnchor` after the load.
     */
    onJumpToReadMarker(scrollNow: ImmediateScroll): void;

    /** Mark all currently-visible messages as read, clearing the read marker. */
    onMarkAllAsRead(): void;

    /**
     * Navigate to the live end of the timeline.
     *
     * `scrollNow` is invoked synchronously when the window already reaches
     * the live end (no data update needed). Otherwise the VM reloads the
     * timeline window at the live end and the scroll happens via
     * `pendingAnchor` after the load.
     */
    onJumpToLive(scrollNow: ImmediateScroll): void;
}

export type TimelineViewModel = ViewModel<TimelineViewSnapshot, TimelineViewActions>;

// ─── Shared timeline view props ────────────────────────────────────

export interface TimelineViewProps {
    vm: TimelineViewModel;

    /**
     * Render callback for each timeline item.
     * The shared container calls this for every visible item.
     */
    renderItem: (item: TimelineItem) => ReactNode;
}

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

export interface NavigationAnchor {
    /** The `TimelineItem.key` to scroll to. */
    targetKey: string;
    /** Where in the viewport to place the target. 0 = top, 0.5 = centre, 1 = bottom. */
    position?: number;
    /** Whether to visually highlight the target item after scrolling. */
    highlight?: boolean;
}

// ─── Visible range ─────────────────────────────────────────────────

export interface VisibleRange {
    /** Index of the first visible item in the items array. */
    startIndex: number;
    /** Index of the last visible item in the items array. */
    endIndex: number;
}

// ─── Loading & error ───────────────────────────────────────────────

export type PaginationState = "idle" | "loading" | "error";

// ─── Focus state ───────────────────────────────────────────────────

export interface FocusState {
    /** The key of the item that currently holds keyboard focus, if any. */
    focusedKey: string | null;
    /** Whether the timeline container itself is focused. */
    containerFocused: boolean;
}

// ─── Timeline view model contract ──────────────────────────────────

export interface TimelineViewSnapshot {
    /** The ordered list of items to render. */
    items: TimelineItem[];

    /** Whether the viewport is pinned to the live (bottom) end. */
    stuckAtBottom: boolean;

    /** Pagination state at each end of the loaded window. */
    backwardPagination: PaginationState;
    forwardPagination: PaginationState;

    /** Current focus state for keyboard navigation and a11y. */
    focus: FocusState;

    /**
     * If set, the container should scroll to this anchor on the
     * next render. The container clears it after executing the scroll.
     */
    pendingAnchor: NavigationAnchor | null;
}

export interface TimelineViewActions {
    /** Called when Virtuoso fires startReached; VM decides whether to paginate. */
    onStartReached(): void;

    /** Called when Virtuoso fires endReached; VM decides whether to paginate. */
    onEndReached(): void;

    /** Report the currently visible range after every scroll. */
    onVisibleRangeChanged(range: VisibleRange): void;

    /** Report that the container has scrolled to the pending anchor. */
    onAnchorReached(): void;

    /** Move keyboard focus to a specific item. */
    setFocus(key: string | null): void;

    /** Report that the user has scrolled to or away from the bottom. */
    onStuckAtBottomChanged(stuckAtBottom: boolean): void;

    /**
     * Return the Virtuoso firstItemIndex for proper prepend handling.
     * Starts high and decreases as backward pagination adds items.
     */
    getFirstItemIndex(): number;
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

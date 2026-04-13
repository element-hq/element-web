/*
Copyright 2026 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import type { ReactNode } from "react";
import type { ViewModel } from "../../../core/viewmodel/ViewModel";

// ─── Timeline item: one renderable row ─────────────────────────────

export interface TimelineItem {
    /** Stable, unique key for React reconciliation and scroll-token anchoring. */
    key: string;
    /** Discriminated union of every row kind the timeline can render. */
    kind: "event" | "virtual" | "group";
}

// ─── Navigation anchor ─────────────────────────────────────────────

export interface NavigationAnchor {
    /** The `TimelineItem.key` to scroll to. */
    targetKey: string;
    /** Where in the viewport to place the target. */
    position?: "top" | "center" | "bottom";
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

// ─── Timeline view model contract ──────────────────────────────────

export interface TimelineViewSnapshot<TItem extends TimelineItem = TimelineItem> {
    /** The ordered list of items to render. */
    items: TItem[];

    /** Whether the viewport is pinned to the live (bottom) end. */
    isAtLiveEdge: boolean;

    /** Whether another backward pagination request is currently possible. */
    canPaginateBackward: boolean;
    /** Whether another forward pagination request is currently possible. */
    canPaginateForward: boolean;

    /** Pagination state at each end of the loaded window. */
    backwardPagination: PaginationState;
    forwardPagination: PaginationState;

    /**
     * If set, the container should scroll to this target on the
     * next render. The container clears it after executing the scroll.
     */
    scrollTarget: NavigationAnchor | null;
}

export interface TimelineViewActions {
    /** Request more items at the given end. */
    onRequestMoreItems(direction: "backward" | "forward"): void;

    /** Report that the shared mount-time initial fill has completed. */
    onInitialFillCompleted(): void;

    /** Report the currently visible range after every scroll. */
    onVisibleRangeChanged(range: VisibleRange): void;

    /** Report that the container has scrolled to the current scroll target. */
    onScrollTargetReached(): void;

    /** Report that the user has scrolled to or away from the live end. */
    onIsAtLiveEdgeChanged(isAtLiveEdge: boolean): void;
}

export type TimelineViewModel<TItem extends TimelineItem = TimelineItem> = ViewModel<
    TimelineViewSnapshot<TItem>,
    TimelineViewActions
>;

// ─── Shared timeline view props ────────────────────────────────────

export interface TimelineViewProps<TItem extends TimelineItem = TimelineItem> {
    vm: TimelineViewModel<TItem>;
    /** Optional CSS class names to apply to the component container.*/
    className?: string;
    /**
     * Render callback for each timeline item.
     * The shared container calls this for every visible item.
     */
    renderItem: (item: TItem) => ReactNode;
}

/*
Copyright 2026 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import type { ReactNode } from "react";
import type { ViewModel } from "../../../core/viewmodel/ViewModel";

/**
 * Minimal row contract consumed by {@link TimelineView}.
 *
 * Concrete products can extend this shape with the data needed to render each
 * timeline entry while preserving a stable key and row classification.
 */
export interface TimelineItem {
    /** Stable, unique key for React reconciliation and scroll-token anchoring. */
    key: string;
    /** Discriminated union of every row kind the timeline can render. */
    kind: "event" | "virtual" | "group";
}

/**
 * Describes a timeline item that should be brought into view and where it should
 * be aligned within the viewport.
 */
export interface NavigationAnchor {
    /** The `TimelineItem.key` to scroll to. */
    targetKey: string;
    /** Where in the viewport to place the target. */
    position?: "top" | "center" | "bottom";
}

/**
 * Reports which portion of the loaded timeline window is currently visible.
 */
export interface VisibleRange {
    /** Key of the first visible item in the items array. */
    startKey: string;
    /** Key of the last visible item in the items array. */
    endKey: string;
}

/**
 * Represents the loading state for pagination at either end of the timeline.
 */
export type PaginationState = "idle" | "loading" | "error";

/**
 * Snapshot consumed by {@link TimelineView} on each render.
 *
 * It combines the loaded item window with pagination, live-edge, and scroll
 * target state so the presenter can keep the viewport stable.
 */
export interface TimelineViewSnapshot<TItem extends TimelineItem = TimelineItem> {
    /** The ordered list of items to render. */
    items: TItem[];

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

/**
 * Callbacks emitted by {@link TimelineView} to let the owning view model drive
 * pagination, live-edge state, and one-shot scroll targets.
 */
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

/**
 * View model contract required by {@link TimelineView}.
 */
export type TimelineViewModel<TItem extends TimelineItem = TimelineItem> = ViewModel<
    TimelineViewSnapshot<TItem>,
    TimelineViewActions
>;

/**
 * Props for rendering a virtualized timeline against a {@link TimelineViewModel}.
 */
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

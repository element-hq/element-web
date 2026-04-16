/*
Copyright 2026 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import type { ScrollIntoViewLocation } from "react-virtuoso";
import type { NavigationAnchor, PaginationState, TimelineItem, VisibleRange } from "./types";

/**
 * Pure behavior helpers for `TimelineView`.
 *
 * This module encodes the timeline's implicit state machines as small predicates
 * and selectors so the presenter can stay imperative while the decision logic
 * remains easy to test.
 *
 * The behavior is split into five cooperating flows:
 * 1. Window shift detection identifies when the loaded slice moved contiguously.
 * 2. Initial fill bootstraps the first stable viewport before normal callbacks
 *    are allowed to drive more behavior.
 * 3. Anchor navigation turns one-shot scroll targets into concrete scroll
 *    requests and avoids replaying fulfilled anchors.
 * 4. Live-edge tracking distinguishes "at the bottom of the loaded window" from
 *    "at the true live edge" and controls follow-output.
 * 5. Pagination continuity decides when backward or forward pagination may run
 *    and how to preserve viewport position when newer items arrive.
 *
 * These helpers are intentionally pure. `TimelineViewPresenter` owns refs,
 * effects, and callback ordering.
 */
export const OVERSCAN_PX = 600;
export const MAX_INITIAL_FILL_ROUNDS = 3;
export const INITIAL_FIRST_ITEM_INDEX = 100_000;
export const TOP_SCROLL_THRESHOLD_PX = 1;

type TimelineScrollLocation = ScrollIntoViewLocation | false;

// Window shift detection ----------------------------------------------------

function findFirstOverlap<TItem extends TimelineItem>(
    prevItems: TItem[],
    nextIndexesByKey: Map<string, number>,
): { prevOverlapStart: number; nextOverlapStart: number } | null {
    for (let index = 0; index < prevItems.length; index += 1) {
        const candidateIndex = nextIndexesByKey.get(prevItems[index].key);
        if (candidateIndex !== undefined) {
            return {
                prevOverlapStart: index,
                nextOverlapStart: candidateIndex,
            };
        }
    }

    return null;
}

function getOverlapLength<TItem extends TimelineItem>(
    prevItems: TItem[],
    nextItems: TItem[],
    prevOverlapStart: number,
    nextOverlapStart: number,
): number {
    let overlapLength = 0;
    while (
        prevOverlapStart + overlapLength < prevItems.length &&
        nextOverlapStart + overlapLength < nextItems.length &&
        prevItems[prevOverlapStart + overlapLength].key === nextItems[nextOverlapStart + overlapLength].key
    ) {
        overlapLength += 1;
    }

    return overlapLength;
}

function hasUnexpectedLeadingOverlap<TItem extends TimelineItem>(
    prevItems: TItem[],
    prevOverlapStart: number,
    nextIndexesByKey: Map<string, number>,
): boolean {
    for (let index = 0; index < prevOverlapStart; index += 1) {
        if (nextIndexesByKey.has(prevItems[index].key)) {
            return true;
        }
    }

    return false;
}

function hasUnexpectedTrailingOverlap<TItem extends TimelineItem>(
    nextItems: TItem[],
    nextOverlapStart: number,
    overlapLength: number,
    prevKeys: Set<string>,
): boolean {
    for (let index = nextOverlapStart + overlapLength; index < nextItems.length; index += 1) {
        if (prevKeys.has(nextItems[index].key)) {
            return true;
        }
    }

    return false;
}

/**
 * Computes how far the loaded item window moved when two arrays still describe
 * the same contiguous slice after pagination.
 *
 * The result is intentionally conservative. If the overlap is ambiguous,
 * duplicated, or non-contiguous, the function returns `0` so the presenter does
 * not make unsafe index-preservation assumptions.
 */
export function getContiguousWindowShift<TItem extends TimelineItem>(prevItems: TItem[], nextItems: TItem[]): number {
    if (prevItems === nextItems || prevItems.length === 0 || nextItems.length === 0) {
        return 0;
    }

    const previousFirstKey = prevItems[0]?.key;
    const previousLastKey = prevItems[prevItems.length - 1]?.key;
    const nextFirstKey = nextItems[0]?.key;
    const nextLastKey = nextItems[nextItems.length - 1]?.key;

    if (prevItems.length === nextItems.length && previousFirstKey === nextFirstKey && previousLastKey === nextLastKey) {
        return 0;
    }

    const nextIndexesByKey = new Map<string, number>();
    for (let index = 0; index < nextItems.length; index += 1) {
        nextIndexesByKey.set(nextItems[index].key, index);
    }

    const overlap = findFirstOverlap(prevItems, nextIndexesByKey);
    if (!overlap) {
        return 0;
    }

    const { prevOverlapStart, nextOverlapStart } = overlap;
    const overlapLength = getOverlapLength(prevItems, nextItems, prevOverlapStart, nextOverlapStart);
    if (overlapLength === 0) {
        return 0;
    }

    const prevKeys = new Set<string>();
    for (const item of prevItems) {
        prevKeys.add(item.key);
    }

    if (
        hasUnexpectedLeadingOverlap(prevItems, prevOverlapStart, nextIndexesByKey) ||
        hasUnexpectedTrailingOverlap(nextItems, nextOverlapStart, overlapLength, prevKeys)
    ) {
        return 0;
    }

    return nextOverlapStart - prevOverlapStart;
}

// Initial fill --------------------------------------------------------------

/**
 * Initial fill state machine.
 *
 * The timeline starts in `"filling"` while it acquires enough content to make
 * the initial viewport meaningful. During this phase the presenter suppresses
 * callback paths that would otherwise misinterpret startup layout churn as user
 * intent.
 *
 * Once the presenter transitions to `"done"`, normal pagination and live-edge
 * behavior can resume.
 */
function getInitialBottomScrollLocation({
    isAtLiveEdge,
    totalCount,
    initialBottomSnapDone,
}: {
    isAtLiveEdge: boolean;
    totalCount: number;
    initialBottomSnapDone: boolean;
}): TimelineScrollLocation {
    if (!isAtLiveEdge || initialBottomSnapDone) {
        return false;
    }

    if (!Number.isFinite(totalCount) || totalCount <= 0) {
        return false;
    }

    return {
        index: totalCount - 1,
        align: "end",
        behavior: "auto",
    };
}

// Anchor navigation ---------------------------------------------------------

function getScrollAlign(position: NavigationAnchor["position"]): ScrollIntoViewLocation["align"] {
    if (position === undefined || position === "top") {
        return "start";
    }

    if (position === "bottom") {
        return "end";
    }

    return "center";
}

function getAnchorScrollLocation<TItem extends TimelineItem>(
    items: TItem[],
    scrollTarget: NavigationAnchor,
): TimelineScrollLocation {
    const targetIndex = items.findIndex((item) => item.key === scrollTarget.targetKey);
    if (targetIndex === -1) {
        return false;
    }

    return {
        index: targetIndex,
        align: getScrollAlign(scrollTarget.position),
        behavior: "auto",
    };
}

/**
 * Anchor navigation state machine.
 *
 * A `scrollTarget` is a one-shot request from the view model to bring a
 * specific item into view. Explicit anchors take priority over the default
 * startup snap to the live end, and anchors that were already satisfied are not
 * replayed.
 */
export function getScrollLocationOnChange<TItem extends TimelineItem>({
    items,
    scrollTarget,
    isAtLiveEdge,
    totalCount,
    lastAnchoredKey,
    allowReplayPendingAnchor,
    initialBottomSnapDone,
}: {
    items: TItem[];
    scrollTarget: NavigationAnchor | null;
    isAtLiveEdge: boolean;
    totalCount: number;
    lastAnchoredKey: string | null;
    allowReplayPendingAnchor: boolean;
    initialBottomSnapDone: boolean;
}): TimelineScrollLocation {
    if (!Number.isFinite(totalCount) || totalCount <= 0) {
        return false;
    }

    if (!scrollTarget) {
        return getInitialBottomScrollLocation({
            isAtLiveEdge,
            totalCount,
            initialBottomSnapDone,
        });
    }

    if (lastAnchoredKey === scrollTarget.targetKey && !allowReplayPendingAnchor) {
        return false;
    }

    return getAnchorScrollLocation(items, scrollTarget);
}

/**
 * Treats a bottom-aligned anchor to the terminal item as satisfying the initial
 * live-edge snap, so startup does not attempt an additional redundant scroll.
 */
export function shouldMarkInitialBottomSnapDoneOnScrollTarget<TItem extends TimelineItem>({
    items,
    scrollTarget,
    isAtLiveEdge,
    initialBottomSnapDone,
}: {
    items: TItem[];
    scrollTarget: NavigationAnchor | null;
    isAtLiveEdge: boolean;
    initialBottomSnapDone: boolean;
}): boolean {
    if (initialBottomSnapDone || !isAtLiveEdge || !scrollTarget) {
        return false;
    }

    const lastItem = items.at(-1);
    if (!lastItem || lastItem.key !== scrollTarget.targetKey) {
        return false;
    }

    return scrollTarget.position === undefined || scrollTarget.position === "bottom";
}

/**
 * After the initial backfill settles, requests a final snap to the terminal
 * item so live timelines end in a stable bottom-aligned state.
 */
export function getPostInitialFillBottomSnapIndex({
    initialFillState,
    isAtLiveEdge,
    hasScrollTarget,
    itemCount,
    firstItemIndex,
    postInitialFillBottomSnapDone,
    suppressForUpwardScrollDuringInitialFill,
}: {
    initialFillState: "filling" | "settling" | "done";
    isAtLiveEdge: boolean;
    hasScrollTarget: boolean;
    itemCount: number;
    firstItemIndex: number;
    postInitialFillBottomSnapDone: boolean;
    suppressForUpwardScrollDuringInitialFill?: boolean;
}): number | null {
    if (
        initialFillState !== "done" ||
        !isAtLiveEdge ||
        hasScrollTarget ||
        itemCount === 0 ||
        postInitialFillBottomSnapDone ||
        suppressForUpwardScrollDuringInitialFill
    ) {
        return null;
    }

    return firstItemIndex + itemCount - 1;
}

/**
 * Ignores transient `atBottom` notifications during startup while the timeline
 * is still performing its initial fill and no explicit anchor is being sought.
 */
export function shouldIgnoreAtBottomStateChange({
    initialFillState,
    hasScrollTarget,
}: {
    initialFillState: "filling" | "settling" | "done";
    hasScrollTarget: boolean;
}): boolean {
    return initialFillState !== "done" && !hasScrollTarget;
}

// Live-edge tracking --------------------------------------------------------

/**
 * Live-edge tracking state machine.
 *
 * Being at the bottom of the currently loaded window only counts as being at
 * the true live edge when forward pagination is exhausted.
 */
export function getIsAtLiveEdgeFromBottomState({
    atBottom,
    canPaginateForward,
}: {
    atBottom: boolean;
    canPaginateForward: boolean;
}): boolean {
    return atBottom && !canPaginateForward;
}

/**
 * Disables follow-output once the user scrolls upward while the timeline was
 * previously following live content.
 */
export function shouldDisableFollowOutputOnScroll({
    previousScrollTop,
    currentScrollTop,
    isAtLiveEdge,
    followOutputEnabled,
}: {
    previousScrollTop: number | null;
    currentScrollTop: number;
    isAtLiveEdge: boolean;
    followOutputEnabled: boolean;
}): boolean {
    return followOutputEnabled && isAtLiveEdge && previousScrollTop !== null && currentScrollTop < previousScrollTop;
}

// Backward pagination -------------------------------------------------------

/**
 * Backward pagination trigger state machine.
 *
 * Older-history pagination is only allowed once startup is complete and the
 * user is no longer pinned to the live end or navigating to an explicit anchor.
 */
export function shouldIgnoreStartReached({
    initialFillState,
    isAtLiveEdge,
    hasScrollTarget,
}: {
    initialFillState: "filling" | "settling" | "done";
    isAtLiveEdge: boolean;
    hasScrollTarget: boolean;
}): boolean {
    return initialFillState === "done" && isAtLiveEdge && !hasScrollTarget;
}

export function shouldPaginateBackwardAtTopScroll({
    initialFillState,
    isAtLiveEdge,
    hasScrollTarget,
    backwardPagination,
    canPaginateBackward,
    scrollTop,
}: {
    initialFillState: "filling" | "settling" | "done";
    isAtLiveEdge: boolean;
    hasScrollTarget: boolean;
    backwardPagination: PaginationState;
    canPaginateBackward: boolean;
    scrollTop: number;
}): boolean {
    return (
        initialFillState === "done" &&
        !isAtLiveEdge &&
        !hasScrollTarget &&
        backwardPagination === "idle" &&
        canPaginateBackward &&
        scrollTop <= TOP_SCROLL_THRESHOLD_PX
    );
}

// Forward pagination continuity --------------------------------------------

/**
 * Forward pagination continuity state machine.
 *
 * End-reached signals that occur during startup may need to be replayed once
 * initial fill completes and the forward edge is allowed to paginate normally.
 */
export function shouldReplayPendingForwardPaginationAfterInitialFill({
    initialFillState,
    hasPendingEndReached,
    forwardPagination,
    canPaginateForward,
}: {
    initialFillState: "filling" | "settling" | "done";
    hasPendingEndReached: boolean;
    forwardPagination: PaginationState;
    canPaginateForward: boolean;
}): boolean {
    return initialFillState === "done" && hasPendingEndReached && forwardPagination === "idle" && canPaginateForward;
}

/**
 * When newer items are appended while the user is browsing away from the live
 * edge, returns the absolute index of the anchor item that should be restored
 * to preserve viewport position.
 *
 * Restoration is skipped for live-edge requests, anchor jumps, and
 * non-contiguous window shifts.
 */
export function getForwardPaginationAnchorIndex<TItem extends TimelineItem>({
    previousItems,
    nextItems,
    forwardPaginationContext,
    previousForwardPagination,
    forwardPagination,
    hasScrollTarget,
    firstItemIndex,
    windowShift,
}: {
    previousItems: TItem[];
    nextItems: TItem[];
    forwardPaginationContext: {
        anchorKey: string | null;
        lastVisibleRange: VisibleRange | null;
        bottomOffsetPx: number | null;
        requestedAtLiveEdge: boolean;
        requestedWhileSeekingLiveEdge: boolean;
    } | null;
    previousForwardPagination: PaginationState;
    forwardPagination: PaginationState;
    hasScrollTarget: boolean;
    firstItemIndex: number;
    windowShift: number;
}): number | null {
    if (
        previousForwardPagination !== "loading" ||
        forwardPagination !== "idle" ||
        hasScrollTarget ||
        previousItems.length === 0 ||
        !forwardPaginationContext ||
        forwardPaginationContext.requestedAtLiveEdge ||
        forwardPaginationContext.requestedWhileSeekingLiveEdge ||
        !forwardPaginationContext.anchorKey ||
        windowShift !== 0
    ) {
        return null;
    }

    const nextAnchorIndex = nextItems.findIndex((item) => item.key === forwardPaginationContext.anchorKey);
    return nextAnchorIndex >= 0 ? firstItemIndex + nextAnchorIndex : null;
}

/**
 * Computes the scroll adjustment needed to restore the previous bottom offset of
 * the chosen anchor after forward pagination settles.
 */
export function getForwardPaginationAnchorAdjustment({
    desiredBottomOffset,
    currentBottomOffset,
}: {
    desiredBottomOffset: number;
    currentBottomOffset: number;
}): number {
    return desiredBottomOffset - currentBottomOffset;
}

/**
 * Determines whether a completed forward pagination may use the original
 * Virtuoso sliding-rebase location for the current range.
 *
 * A range that already fell back to DOM-based recovery must not re-arm the
 * Virtuoso path again, but later ranges may still use it.
 */
export function shouldUseForwardSlidingRebaseLocation({
    previousForwardPagination,
    forwardPagination,
    continuityMode,
    windowShift,
    hasShiftedVisibleRange,
    currentRangeKey,
    blockedRangeKey,
    handledRangeKey,
}: {
    previousForwardPagination: PaginationState;
    forwardPagination: PaginationState;
    continuityMode: "anchor" | "bottom" | "shifted-range" | null;
    windowShift: number;
    hasShiftedVisibleRange: boolean;
    currentRangeKey: string;
    blockedRangeKey: string | null;
    handledRangeKey: string | null;
}): boolean {
    return (
        previousForwardPagination === "loading" &&
        forwardPagination === "idle" &&
        continuityMode === "shifted-range" &&
        windowShift < 0 &&
        hasShiftedVisibleRange &&
        blockedRangeKey !== currentRangeKey &&
        handledRangeKey !== currentRangeKey
    );
}

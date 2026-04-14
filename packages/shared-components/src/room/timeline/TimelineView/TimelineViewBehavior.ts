/*
Copyright 2026 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import type { ScrollIntoViewLocation } from "react-virtuoso";
import type { NavigationAnchor, PaginationState, TimelineItem, VisibleRange } from "./types";

export const OVERSCAN_PX = 600;
export const MAX_INITIAL_FILL_ROUNDS = 3;
export const INITIAL_FIRST_ITEM_INDEX = 100_000;
export const TOP_SCROLL_THRESHOLD_PX = 1;

type TimelineScrollLocation = ScrollIntoViewLocation | false;

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

    return {
        index: totalCount - 1,
        align: "end",
        behavior: "auto",
    };
}

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

export function getScrollLocationOnChange<TItem extends TimelineItem>({
    items,
    scrollTarget,
    isAtLiveEdge,
    totalCount,
    lastAnchoredKey,
    initialBottomSnapDone,
}: {
    items: TItem[];
    scrollTarget: NavigationAnchor | null;
    isAtLiveEdge: boolean;
    totalCount: number;
    lastAnchoredKey: string | null;
    initialBottomSnapDone: boolean;
}): TimelineScrollLocation {
    if (totalCount === 0) {
        return false;
    }

    if (!scrollTarget) {
        return getInitialBottomScrollLocation({
            isAtLiveEdge,
            totalCount,
            initialBottomSnapDone,
        });
    }

    if (lastAnchoredKey === scrollTarget.targetKey) {
        return false;
    }

    return getAnchorScrollLocation(items, scrollTarget);
}

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

export function getPostInitialFillBottomSnapIndex({
    initialFillState,
    isAtLiveEdge,
    hasScrollTarget,
    itemCount,
    firstItemIndex,
    postInitialFillBottomSnapDone,
}: {
    initialFillState: "filling" | "done";
    isAtLiveEdge: boolean;
    hasScrollTarget: boolean;
    itemCount: number;
    firstItemIndex: number;
    postInitialFillBottomSnapDone: boolean;
}): number | null {
    if (
        initialFillState !== "done" ||
        !isAtLiveEdge ||
        hasScrollTarget ||
        itemCount === 0 ||
        postInitialFillBottomSnapDone
    ) {
        return null;
    }

    return firstItemIndex + itemCount - 1;
}

export function shouldIgnoreAtBottomStateChange({
    initialFillState,
    hasScrollTarget,
}: {
    initialFillState: "filling" | "done";
    hasScrollTarget: boolean;
}): boolean {
    return initialFillState === "filling" && !hasScrollTarget;
}

export function getIsAtLiveEdgeFromBottomState({
    atBottom,
    canPaginateForward,
}: {
    atBottom: boolean;
    canPaginateForward: boolean;
}): boolean {
    return atBottom && !canPaginateForward;
}

export function shouldIgnoreStartReached({
    initialFillState,
    isAtLiveEdge,
    hasScrollTarget,
}: {
    initialFillState: "filling" | "done";
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
    initialFillState: "filling" | "done";
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

export function shouldReplayPendingForwardPaginationAfterInitialFill({
    initialFillState,
    hasPendingEndReached,
    forwardPagination,
    canPaginateForward,
}: {
    initialFillState: "filling" | "done";
    hasPendingEndReached: boolean;
    forwardPagination: PaginationState;
    canPaginateForward: boolean;
}): boolean {
    return initialFillState === "done" && hasPendingEndReached && forwardPagination === "idle" && canPaginateForward;
}

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
        !forwardPaginationContext.anchorKey ||
        windowShift !== 0
    ) {
        return null;
    }

    const nextAnchorIndex = nextItems.findIndex((item) => item.key === forwardPaginationContext.anchorKey);
    return nextAnchorIndex >= 0 ? firstItemIndex + nextAnchorIndex : null;
}

export function getForwardPaginationAnchorAdjustment({
    desiredBottomOffset,
    currentBottomOffset,
}: {
    desiredBottomOffset: number;
    currentBottomOffset: number;
}): number {
    return desiredBottomOffset - currentBottomOffset;
}

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

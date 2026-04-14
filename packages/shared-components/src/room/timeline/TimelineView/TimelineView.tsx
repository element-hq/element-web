/*
Copyright 2026 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type JSX } from "react";
import { Virtuoso, type ListRange, type ScrollIntoViewLocation } from "react-virtuoso";
import classNames from "classnames";

import type { ScrollIntoViewOnChange } from "../../../core/VirtualizedList";
import { useVirtualizedList } from "../../../core/VirtualizedList/virtualized-list";
import { useViewModel } from "../../../core/viewmodel/useViewModel";
import type { NavigationAnchor, PaginationState, TimelineItem, TimelineViewProps, VisibleRange } from "./types";
import styles from "./TimelineView.module.css";

/**
 * Shared virtualized timeline container.
 *
 * Renders an ordered list of timeline items using react-virtuoso.
 * The consuming app controls what each row looks like via `renderItem`;
 * this component owns layout, scrolling, pagination triggers, and
 * stuck-at-bottom tracking.
 */

/** Pre-render this many pixels above and below the visible viewport. */
const OVERSCAN_PX = 600;
const MAX_INITIAL_FILL_ROUNDS = 3;
const MAX_LOCAL_ANCHOR_CORRECTION_ATTEMPTS = 6;
const INITIAL_FIRST_ITEM_INDEX = 100_000;
const TOP_SCROLL_THRESHOLD_PX = 1;
const VISIBILITY_EPSILON_PX = 1;
const REQUIRED_STABLE_ANCHOR_ALIGNMENT_CHECKS = 2;
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

    // Most updates keep the same visible window; avoid rebuilding overlap indexes for that case.
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

function getScrollAlign(position: NavigationAnchor["position"]): ScrollIntoViewLocation["align"] {
    if (position === undefined || position === "top") {
        return "start";
    }

    if (position === "bottom") {
        return "end";
    }

    return "center";
}

function isScrollTargetAligned({
    scrollerElement,
    targetElement,
    position,
}: {
    scrollerElement: HTMLElement;
    targetElement: HTMLElement;
    position: NavigationAnchor["position"];
}): boolean {
    const scrollerRect = scrollerElement.getBoundingClientRect();
    const targetRect = targetElement.getBoundingClientRect();

    if (position === undefined || position === "top") {
        return Math.abs(targetRect.top - scrollerRect.top) <= VISIBILITY_EPSILON_PX;
    }

    if (position === "bottom") {
        return Math.abs(scrollerRect.bottom - targetRect.bottom) <= VISIBILITY_EPSILON_PX;
    }

    const scrollerCenter = (scrollerRect.top + scrollerRect.bottom) / 2;
    const targetCenter = (targetRect.top + targetRect.bottom) / 2;
    return Math.abs(targetCenter - scrollerCenter) <= VISIBILITY_EPSILON_PX;
}

function getScrollTargetAdjustment({
    scrollerElement,
    targetElement,
    position,
}: {
    scrollerElement: HTMLElement;
    targetElement: HTMLElement;
    position: NavigationAnchor["position"];
}): number {
    const scrollerRect = scrollerElement.getBoundingClientRect();
    const targetRect = targetElement.getBoundingClientRect();

    if (position === undefined || position === "top") {
        return targetRect.top - scrollerRect.top;
    }

    if (position === "bottom") {
        return targetRect.bottom - scrollerRect.bottom;
    }

    const scrollerCenter = (scrollerRect.top + scrollerRect.bottom) / 2;
    const targetCenter = (targetRect.top + targetRect.bottom) / 2;
    return targetCenter - scrollerCenter;
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

export function getLastVisibleTimelineItemElement(scrollerElement: HTMLElement): HTMLElement | null {
    const scrollerRect = scrollerElement.getBoundingClientRect();
    const itemElements = scrollerElement.querySelectorAll<HTMLElement>("[data-timeline-item-key]");

    let lastFullyVisibleElement: HTMLElement | null = null;
    let lastFullyVisibleBottom = Number.NEGATIVE_INFINITY;
    let lastIntersectingElement: HTMLElement | null = null;
    let lastIntersectingBottom = Number.NEGATIVE_INFINITY;

    for (const itemElement of itemElements) {
        const itemRect = itemElement.getBoundingClientRect();
        const intersectsViewport =
            itemRect.bottom > scrollerRect.top + VISIBILITY_EPSILON_PX &&
            itemRect.top < scrollerRect.bottom - VISIBILITY_EPSILON_PX;
        if (!intersectsViewport) {
            continue;
        }

        if (itemRect.bottom >= lastIntersectingBottom) {
            lastIntersectingBottom = itemRect.bottom;
            lastIntersectingElement = itemElement;
        }

        const isFullyVisible =
            itemRect.top >= scrollerRect.top - VISIBILITY_EPSILON_PX &&
            itemRect.bottom <= scrollerRect.bottom + VISIBILITY_EPSILON_PX;
        if (!isFullyVisible) {
            continue;
        }

        if (itemRect.bottom >= lastFullyVisibleBottom) {
            lastFullyVisibleBottom = itemRect.bottom;
            lastFullyVisibleElement = itemElement;
        }
    }

    return lastFullyVisibleElement ?? lastIntersectingElement;
}

/**
 * Renders a virtualized timeline backed by a timeline view model.
 *
 * This shared container owns the scrolling and pagination lifecycle for a
 * timeline window:
 * - subscribes to the supplied view model snapshot
 * - restores scroll position when the loaded window shifts
 * - resolves one-shot anchor navigation requests
 * - performs the mount-time initial fill/backfill flow
 * - reports visible-range and live-edge changes back to the view model
 *
 * Row rendering remains application-owned through `renderItem`.
 *
 * @typeParam TItem - The concrete timeline item shape used by the caller.
 * @param props - Timeline view model, optional class name, and row renderer.
 * @returns A virtualized timeline view driven by `react-virtuoso`.
 */
export function TimelineView<TItem extends TimelineItem>({
    vm,
    className,
    renderItem,
}: Readonly<TimelineViewProps<TItem>>): JSX.Element {
    const snapshot = useViewModel(vm);
    // Track when the view model instance changes so all scroll/fill bookkeeping can be reset.
    const previousVmRef = useRef(vm);
    // Anchor navigation is one-shot: remember the last resolved anchor key so repeated renders
    // do not keep requesting the same scroll.
    const lastAnchoredKeyRef = useRef<string | null>(null);
    // Live timelines perform an initial snap to the bottom on first mount, then a second snap
    // after startup backfill completes. These refs ensure each step only runs once.
    const initialBottomSnapDoneRef = useRef(false);
    const postInitialFillBottomSnapDoneRef = useRef(false);
    const initialFillCompletedNotifiedRef = useRef(false);
    // Cache previous render state so prepend and forward-pagination restore can preserve the viewport.
    const previousRenderStateRef = useRef<{
        items: TItem[];
        backwardPagination: PaginationState;
        forwardPagination: PaginationState;
    }>({
        items: [],
        backwardPagination: snapshot.backwardPagination,
        forwardPagination: snapshot.forwardPagination,
    });
    // Cache the latest visible range for forward-pagination and focus/scroll restoration decisions.
    const lastVisibleRangeRef = useRef<VisibleRange | null>(null);
    // Startup fill is a small state machine: keep backfilling upward until the viewport is full
    // or a hard stop is reached, then switch to normal scrolling behavior.
    const [initialFillState, setInitialFillState] = useState<"filling" | "done">("filling");
    // Virtuoso uses this synthetic index space to preserve viewport position when older items are prepended.
    // Keep it in a ref-backed render state so item-window updates and index preservation happen together.
    const firstItemIndexRenderStateRef = useRef<{
        vm: typeof vm;
        items: TItem[];
        firstItemIndex: number;
    }>({
        vm,
        items: snapshot.items,
        firstItemIndex: INITIAL_FIRST_ITEM_INDEX,
    });
    // The top-scroll listener is attached to the actual scroller element once it becomes available.
    const [scrollerElement, setScrollerElement] = useState<HTMLElement | null>(null);
    const initialFillRoundsRef = useRef(0);
    const sawInitialRangeRef = useRef(false);
    const [followOutputEnabled, setFollowOutputEnabled] = useState(snapshot.isAtLiveEdge);
    const forwardPaginationContextRef = useRef<{
        anchorKey: string | null;
        lastVisibleRange: VisibleRange | null;
        bottomOffsetPx: number | null;
        requestedAtLiveEdge: boolean;
    } | null>(null);
    // Prevent repeated top-edge pagination requests until the outstanding request resolves.
    const topScrollPaginationRequestedRef = useRef(false);
    const previousForwardPaginationRef = useRef(snapshot.forwardPagination);
    const lastForwardRequestedTailKeyRef = useRef<string | null>(null);
    const wasAtBottomRef = useRef(false);
    // If the viewport reaches the bottom while startup fill is still active, replay that
    // forward-pagination request once the timeline switches into normal scrolling mode.
    const pendingForwardPaginationAfterInitialFillRef = useRef(false);
    // Explicit anchor navigation can itself trigger Virtuoso's endReached callback; ignore the
    // first such callback so programmatic anchor scrolls do not immediately paginate forward.
    const ignoreNextEndReachedRef = useRef(false);
    const ignoreNextStartReachedRef = useRef(false);
    const ignoreNextTopScrollPaginationRef = useRef(false);
    // Treat explicit startup anchor navigation as terminating the initial-fill state machine
    // immediately, even before React has committed the state update.
    const initialAnchorResolvedRef = useRef(false);
    const lastScrollTopRef = useRef<number | null>(null);
    // Keep the latest gating state in a ref so the native scroll listener stays stable while still
    // reading fresh pagination flags on every event.
    const latestTopScrollStateRef = useRef({
        vm,
        initialFillState,
        isAtLiveEdge: snapshot.isAtLiveEdge,
        hasScrollTarget: !!snapshot.scrollTarget,
        backwardPagination: snapshot.backwardPagination,
        canPaginateBackward: snapshot.canPaginateBackward,
    });

    if (firstItemIndexRenderStateRef.current.vm !== vm) {
        firstItemIndexRenderStateRef.current = {
            vm,
            items: snapshot.items,
            firstItemIndex: INITIAL_FIRST_ITEM_INDEX,
        };
    } else if (firstItemIndexRenderStateRef.current.items !== snapshot.items) {
        const windowShift = getContiguousWindowShift(firstItemIndexRenderStateRef.current.items, snapshot.items);
        firstItemIndexRenderStateRef.current = {
            vm,
            items: snapshot.items,
            firstItemIndex: firstItemIndexRenderStateRef.current.firstItemIndex - windowShift,
        };
    }

    const firstItemIndex = firstItemIndexRenderStateRef.current.firstItemIndex;
    const increaseViewportBy = useMemo(() => ({ top: OVERSCAN_PX, bottom: OVERSCAN_PX }), []);

    useEffect(() => {
        latestTopScrollStateRef.current = {
            vm,
            initialFillState,
            isAtLiveEdge: snapshot.isAtLiveEdge,
            hasScrollTarget: !!snapshot.scrollTarget,
            backwardPagination: snapshot.backwardPagination,
            canPaginateBackward: snapshot.canPaginateBackward,
        };
    }, [
        vm,
        initialFillState,
        snapshot.isAtLiveEdge,
        snapshot.scrollTarget,
        snapshot.backwardPagination,
        snapshot.canPaginateBackward,
    ]);

    useEffect(() => {
        if (previousVmRef.current === vm) {
            return;
        }

        // A new view model means a new timeline window; drop all scroll/fill bookkeeping so the
        // component behaves like a fresh mount for the new source data.
        previousVmRef.current = vm;
        setInitialFillState("filling");
        lastAnchoredKeyRef.current = null;
        initialBottomSnapDoneRef.current = false;
        postInitialFillBottomSnapDoneRef.current = false;
        initialFillCompletedNotifiedRef.current = false;
        lastVisibleRangeRef.current = null;
        initialFillRoundsRef.current = 0;
        sawInitialRangeRef.current = false;
        setFollowOutputEnabled(snapshot.isAtLiveEdge);
        forwardPaginationContextRef.current = null;
        pendingForwardPaginationAfterInitialFillRef.current = false;
        ignoreNextEndReachedRef.current = false;
        ignoreNextStartReachedRef.current = false;
        ignoreNextTopScrollPaginationRef.current = false;
        lastForwardRequestedTailKeyRef.current = null;
        wasAtBottomRef.current = false;
        initialAnchorResolvedRef.current = false;
        previousRenderStateRef.current = {
            items: [],
            backwardPagination: "idle",
            forwardPagination: "idle",
        };
        firstItemIndexRenderStateRef.current = {
            vm,
            items: snapshot.items,
            firstItemIndex: INITIAL_FIRST_ITEM_INDEX,
        };
    }, [vm, snapshot.isAtLiveEdge, snapshot.items]);

    useEffect(() => {
        setFollowOutputEnabled(snapshot.isAtLiveEdge);
    }, [snapshot.isAtLiveEdge]);

    useEffect(() => {
        if (initialFillState !== "done") {
            return;
        }

        // Once startup fill is complete, notify the VM exactly once per timeline lifecycle.
        if (!initialFillCompletedNotifiedRef.current) {
            initialFillCompletedNotifiedRef.current = true;
            vm.onInitialFillCompleted();
        }
    }, [initialFillState, snapshot.items.length, snapshot.isAtLiveEdge, vm]);

    useEffect(() => {
        if (initialFillState !== "filling" || snapshot.scrollTarget || !initialAnchorResolvedRef.current) {
            return;
        }

        pendingForwardPaginationAfterInitialFillRef.current = false;
        setInitialFillState("done");
    }, [initialFillState, snapshot.scrollTarget]);

    useEffect(() => {
        if (
            !shouldReplayPendingForwardPaginationAfterInitialFill({
                initialFillState,
                hasPendingEndReached: pendingForwardPaginationAfterInitialFillRef.current,
                forwardPagination: snapshot.forwardPagination,
                canPaginateForward: snapshot.canPaginateForward,
            })
        ) {
            return;
        }

        pendingForwardPaginationAfterInitialFillRef.current = false;
        vm.onRequestMoreItems("forward");
    }, [initialFillState, snapshot.forwardPagination, snapshot.canPaginateForward, vm]);

    useEffect(() => {
        if (initialFillState !== "filling") {
            return;
        }

        // During startup fill, forward pagination can be used to finish filling the viewport,
        // but once initial fill is done all forward pagination should be user-driven.
        const lastVisibleRange = lastVisibleRangeRef.current;
        const isAtEnd =
            lastVisibleRange !== null && lastVisibleRange.endIndex >= Math.max(0, snapshot.items.length - 1);
        const shouldAutoPaginateForward =
            isAtEnd &&
            snapshot.forwardPagination === "idle" &&
            snapshot.canPaginateForward &&
            !snapshot.canPaginateBackward &&
            !snapshot.scrollTarget;

        if (shouldAutoPaginateForward) {
            vm.onRequestMoreItems("forward");
        }
    }, [
        initialFillState,
        snapshot.items.length,
        snapshot.forwardPagination,
        snapshot.canPaginateForward,
        snapshot.canPaginateBackward,
        snapshot.scrollTarget,
        vm,
    ]);

    useEffect(() => {
        if (snapshot.backwardPagination !== "loading") {
            topScrollPaginationRequestedRef.current = false;
        }
    }, [snapshot.backwardPagination]);

    useEffect(() => {
        const previousForwardPagination = previousForwardPaginationRef.current;
        previousForwardPaginationRef.current = snapshot.forwardPagination;

        if (previousForwardPagination === "loading" && snapshot.forwardPagination !== "loading") {
            const currentTailKey = snapshot.items.at(-1)?.key ?? null;
            if (currentTailKey !== lastForwardRequestedTailKeyRef.current) {
                lastForwardRequestedTailKeyRef.current = null;
            }
        }
    }, [snapshot.forwardPagination, snapshot.items]);

    const requestForwardPagination = useCallback(() => {
        const tailKey = snapshot.items.at(-1)?.key ?? null;
        if (tailKey !== null && tailKey === lastForwardRequestedTailKeyRef.current) {
            return false;
        }

        lastForwardRequestedTailKeyRef.current = tailKey;
        const lastVisibleRange = lastVisibleRangeRef.current;
        const anchorElement = scrollerElement ? getLastVisibleTimelineItemElement(scrollerElement) : null;
        const anchorKey = anchorElement?.dataset.timelineItemKey ?? null;
        const bottomOffsetPx =
            scrollerElement && anchorElement
                ? scrollerElement.getBoundingClientRect().bottom - anchorElement.getBoundingClientRect().bottom
                : null;

        forwardPaginationContextRef.current = {
            anchorKey,
            lastVisibleRange,
            bottomOffsetPx,
            requestedAtLiveEdge: snapshot.isAtLiveEdge,
        };
        vm.onRequestMoreItems("forward");
        return true;
    }, [scrollerElement, snapshot.isAtLiveEdge, snapshot.items, vm]);

    useLayoutEffect(() => {
        if (!snapshot.scrollTarget || !scrollerElement) {
            return;
        }

        const targetElement = scrollerElement.querySelector<HTMLElement>(
            `[data-timeline-item-key="${snapshot.scrollTarget.targetKey}"]`,
        );
        if (!targetElement) {
            if (
                initialFillState === "filling" &&
                snapshot.backwardPagination === "idle" &&
                snapshot.canPaginateBackward
            ) {
                lastAnchoredKeyRef.current = null;
                ignoreNextStartReachedRef.current = true;
                ignoreNextTopScrollPaginationRef.current = true;
                vm.onRequestMoreItems("backward");
            }
            return;
        }

        if (scrollerElement.clientHeight === 0) {
            ignoreNextEndReachedRef.current = true;
            initialAnchorResolvedRef.current = initialFillState === "filling";
            if (initialAnchorResolvedRef.current) {
                pendingForwardPaginationAfterInitialFillRef.current = false;
            }
            vm.onScrollTargetReached();
            return;
        }

        const isAligned = isScrollTargetAligned({
            scrollerElement,
            targetElement,
            position: snapshot.scrollTarget.position,
        });
        const scrollAdjustment = getScrollTargetAdjustment({
            scrollerElement,
            targetElement,
            position: snapshot.scrollTarget.position,
        });
        const nextScrollTop = scrollerElement.scrollTop + scrollAdjustment;
        const clampedScrollTop = Math.max(0, nextScrollTop);
        const canAdjustWithinLoadedWindow =
            Math.abs(clampedScrollTop - scrollerElement.scrollTop) > VISIBILITY_EPSILON_PX;
        const cannotAlignWithinLoadedWindow = nextScrollTop < 0;

        if (
            !isAligned &&
            initialFillState === "filling" &&
            snapshot.backwardPagination === "loading" &&
            !canAdjustWithinLoadedWindow
        ) {
            return;
        }

        if (!isAligned && canAdjustWithinLoadedWindow) {
            scrollerElement.scrollTo({
                top: clampedScrollTop,
            });

            const targetKey = snapshot.scrollTarget.targetKey;
            const targetPosition = snapshot.scrollTarget.position;
            const verifyLocalAnchorCorrection = (attempt = 0, stableAlignmentChecks = 0): void => {
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        const latestTargetElement = scrollerElement.querySelector<HTMLElement>(
                            `[data-timeline-item-key="${targetKey}"]`,
                        );
                        if (!latestTargetElement) {
                            return;
                        }

                        const alignedAfterAdjustment = isScrollTargetAligned({
                            scrollerElement,
                            targetElement: latestTargetElement,
                            position: targetPosition,
                        });
                        const adjustmentAfterCorrection = getScrollTargetAdjustment({
                            scrollerElement,
                            targetElement: latestTargetElement,
                            position: targetPosition,
                        });
                        const nextScrollTopAfterCorrection = Math.max(
                            0,
                            scrollerElement.scrollTop + adjustmentAfterCorrection,
                        );
                        const canAdjustAfterCorrection =
                            Math.abs(nextScrollTopAfterCorrection - scrollerElement.scrollTop) > VISIBILITY_EPSILON_PX;

                        if (alignedAfterAdjustment) {
                            if (snapshot.backwardPagination === "loading") {
                                return;
                            }

                            if (stableAlignmentChecks + 1 < REQUIRED_STABLE_ANCHOR_ALIGNMENT_CHECKS) {
                                verifyLocalAnchorCorrection(attempt + 1, stableAlignmentChecks + 1);
                                return;
                            }

                            ignoreNextEndReachedRef.current = true;
                            initialAnchorResolvedRef.current = initialFillState === "filling";
                            if (initialAnchorResolvedRef.current) {
                                pendingForwardPaginationAfterInitialFillRef.current = false;
                            }
                            vm.onScrollTargetReached();
                            return;
                        }

                        if (canAdjustAfterCorrection && attempt < MAX_LOCAL_ANCHOR_CORRECTION_ATTEMPTS) {
                            scrollerElement.scrollTo({
                                top: nextScrollTopAfterCorrection,
                            });
                            verifyLocalAnchorCorrection(attempt + 1, 0);
                        }
                    });
                });
            };

            verifyLocalAnchorCorrection();
            return;
        }

        if (
            !isAligned &&
            cannotAlignWithinLoadedWindow &&
            initialFillState === "filling" &&
            snapshot.backwardPagination === "idle" &&
            snapshot.canPaginateBackward
        ) {
            lastAnchoredKeyRef.current = null;
            ignoreNextStartReachedRef.current = true;
            ignoreNextTopScrollPaginationRef.current = true;
            vm.onRequestMoreItems("backward");
            return;
        }

        if (
            !isAligned &&
            cannotAlignWithinLoadedWindow &&
            initialFillState === "filling" &&
            snapshot.canPaginateBackward
        ) {
            return;
        }

        ignoreNextEndReachedRef.current = true;
        initialAnchorResolvedRef.current = initialFillState === "filling";
        if (initialAnchorResolvedRef.current) {
            pendingForwardPaginationAfterInitialFillRef.current = false;
        }
        vm.onScrollTargetReached();
    }, [
        vm,
        initialFillState,
        scrollerElement,
        snapshot.scrollTarget,
        snapshot.items,
        snapshot.backwardPagination,
        snapshot.canPaginateBackward,
    ]);

    const handleRangeChanged = useCallback(
        (range: ListRange) => {
            // Keep range notifications cheap: only allocate/report when the visible indices changed.
            const previousRange = lastVisibleRangeRef.current;
            const hasRangeChanged =
                previousRange === null ||
                previousRange.startIndex !== range.startIndex ||
                previousRange.endIndex !== range.endIndex;

            const visibleRange: VisibleRange =
                hasRangeChanged && previousRange !== null
                    ? { startIndex: range.startIndex, endIndex: range.endIndex }
                    : (previousRange ?? { startIndex: range.startIndex, endIndex: range.endIndex });

            if (hasRangeChanged) {
                lastVisibleRangeRef.current = visibleRange;
                vm.onVisibleRangeChanged(visibleRange);
            }

            if (initialFillState !== "filling" || initialAnchorResolvedRef.current) {
                return;
            }

            // During startup fill, the visible range owns the backfill loop: as long as the
            // viewport still begins at index 0 and more history is available, keep paginating
            // backward until the viewport is filled or limits are reached.
            if (snapshot.backwardPagination === "loading") {
                return;
            }

            if (initialFillRoundsRef.current === 0 && snapshot.canPaginateBackward && !snapshot.scrollTarget) {
                return;
            }

            const canContinueInitialFill =
                snapshot.items.length > 0 &&
                visibleRange.startIndex === 0 &&
                snapshot.canPaginateBackward &&
                initialFillRoundsRef.current < MAX_INITIAL_FILL_ROUNDS &&
                !snapshot.scrollTarget;

            if (!sawInitialRangeRef.current) {
                sawInitialRangeRef.current = true;
                if (!canContinueInitialFill) {
                    setInitialFillState("done");
                    return;
                }
            } else if (!canContinueInitialFill) {
                setInitialFillState("done");
                return;
            }

            initialFillRoundsRef.current += 1;
            vm.onRequestMoreItems("backward");
        },
        [
            vm,
            initialFillState,
            snapshot.backwardPagination,
            snapshot.canPaginateBackward,
            snapshot.items.length,
            snapshot.scrollTarget,
        ],
    );

    const handleAtBottomStateChange = useCallback(
        (atBottom: boolean) => {
            const transitionedToBottom = atBottom && !wasAtBottomRef.current;
            wasAtBottomRef.current = atBottom;

            if (!atBottom) {
                setFollowOutputEnabled(false);
            }

            const nextIsAtLiveEdge = getIsAtLiveEdgeFromBottomState({
                atBottom,
                canPaginateForward: snapshot.canPaginateForward,
            });

            if (
                shouldIgnoreAtBottomStateChange({
                    initialFillState,
                    hasScrollTarget: !!snapshot.scrollTarget,
                })
            ) {
                return;
            }

            if (
                transitionedToBottom &&
                initialFillState === "done" &&
                snapshot.forwardPagination === "idle" &&
                snapshot.canPaginateForward &&
                !snapshot.scrollTarget &&
                !!scrollerElement &&
                scrollerElement.clientHeight > 0
            ) {
                requestForwardPagination();
            }
            vm.onIsAtLiveEdgeChanged(nextIsAtLiveEdge);
        },
        [
            initialFillState,
            requestForwardPagination,
            snapshot.canPaginateForward,
            snapshot.forwardPagination,
            snapshot.scrollTarget,
            scrollerElement,
            vm,
        ],
    );

    const handleStartReached = useCallback(() => {
        if (ignoreNextStartReachedRef.current) {
            ignoreNextStartReachedRef.current = false;
            return;
        }

        if (snapshot.backwardPagination !== "idle" || !snapshot.canPaginateBackward) {
            return;
        }

        // The initial top-edge probe should come from startReached, but once
        // startup fill is underway the range-change loop owns subsequent pulls.
        if (initialFillState === "filling") {
            if (initialAnchorResolvedRef.current) {
                return;
            }
            if (initialFillRoundsRef.current === 0 && !snapshot.scrollTarget) {
                initialFillRoundsRef.current = 1;
                vm.onRequestMoreItems("backward");
            }
            return;
        }

        if (
            shouldIgnoreStartReached({
                initialFillState,
                isAtLiveEdge: snapshot.isAtLiveEdge,
                hasScrollTarget: !!snapshot.scrollTarget,
            })
        ) {
            return;
        }
        vm.onRequestMoreItems("backward");
    }, [
        vm,
        initialFillState,
        snapshot.backwardPagination,
        snapshot.canPaginateBackward,
        snapshot.scrollTarget,
        snapshot.isAtLiveEdge,
    ]);

    const handleEndReached = useCallback(() => {
        if (ignoreNextEndReachedRef.current) {
            ignoreNextEndReachedRef.current = false;
            return;
        }

        if (initialFillState === "filling") {
            if (initialAnchorResolvedRef.current) {
                return;
            }
            if (!snapshot.scrollTarget) {
                pendingForwardPaginationAfterInitialFillRef.current = true;
            }
            return;
        }

        if (initialFillState === "done" && snapshot.forwardPagination === "idle" && snapshot.canPaginateForward) {
            requestForwardPagination();
        }
    }, [
        initialFillState,
        requestForwardPagination,
        snapshot.forwardPagination,
        snapshot.canPaginateForward,
        snapshot.scrollTarget,
    ]);

    const scrollIntoViewOnChange = useCallback<ScrollIntoViewOnChange<TItem, undefined>>(
        ({ totalCount }): ScrollIntoViewLocation | null | undefined | false => {
            // Centralize all data-driven scroll requests here: initial bottom snaps and explicit
            // scroll-target navigation both flow through Virtuoso's scrollIntoViewOnChange hook.
            const scrollLocation = getScrollLocationOnChange({
                items: snapshot.items,
                scrollTarget: snapshot.scrollTarget,
                isAtLiveEdge: snapshot.isAtLiveEdge,
                totalCount,
                lastAnchoredKey: lastAnchoredKeyRef.current,
                initialBottomSnapDone: initialBottomSnapDoneRef.current,
            });

            if (!scrollLocation) {
                if (!snapshot.scrollTarget) {
                    lastAnchoredKeyRef.current = null;
                }
                return false;
            }

            if (!snapshot.scrollTarget) {
                initialBottomSnapDoneRef.current = true;
                lastAnchoredKeyRef.current = null;
                return scrollLocation;
            }

            const markInitialBottomSnapDone = shouldMarkInitialBottomSnapDoneOnScrollTarget({
                items: snapshot.items,
                scrollTarget: snapshot.scrollTarget,
                isAtLiveEdge: snapshot.isAtLiveEdge,
                initialBottomSnapDone: initialBottomSnapDoneRef.current,
            });

            if (markInitialBottomSnapDone) {
                initialBottomSnapDoneRef.current = true;
            }

            lastAnchoredKeyRef.current = snapshot.scrollTarget.targetKey;
            ignoreNextEndReachedRef.current = true;
            ignoreNextStartReachedRef.current = true;
            ignoreNextTopScrollPaginationRef.current = true;
            return scrollLocation;
        },
        [snapshot.items, snapshot.scrollTarget, snapshot.isAtLiveEdge],
    );

    useEffect(() => {
        if (!scrollerElement) {
            return;
        }

        lastScrollTopRef.current = scrollerElement.scrollTop;

        const onScroll = (): void => {
            // This listener handles the "user manually scrolled to the top" pagination path.
            // It is intentionally separate from startReached because top-edge detection during
            // prepend-heavy timelines is easier to reason about from raw scrollTop.
            const currentScrollTop = scrollerElement.scrollTop;
            const previousScrollTop = lastScrollTopRef.current;
            lastScrollTopRef.current = currentScrollTop;
            const latest = latestTopScrollStateRef.current;
            const disableFollowOutput = shouldDisableFollowOutputOnScroll({
                previousScrollTop,
                currentScrollTop,
                isAtLiveEdge: latest.isAtLiveEdge,
                followOutputEnabled,
            });

            if (disableFollowOutput) {
                setFollowOutputEnabled(false);
            }

            if (ignoreNextTopScrollPaginationRef.current) {
                ignoreNextTopScrollPaginationRef.current = false;
                return;
            }

            if (topScrollPaginationRequestedRef.current) {
                return;
            }

            const shouldPaginate = shouldPaginateBackwardAtTopScroll({
                initialFillState: latest.initialFillState,
                isAtLiveEdge: latest.isAtLiveEdge,
                hasScrollTarget: latest.hasScrollTarget,
                backwardPagination: latest.backwardPagination,
                canPaginateBackward: latest.canPaginateBackward,
                scrollTop: currentScrollTop,
            });

            if (!shouldPaginate) {
                return;
            }

            topScrollPaginationRequestedRef.current = true;
            latest.vm.onRequestMoreItems("backward");
        };

        scrollerElement.addEventListener("scroll", onScroll, { passive: true });
        return () => {
            scrollerElement.removeEventListener("scroll", onScroll);
        };
    }, [followOutputEnabled, scrollerElement]);

    const {
        onFocusForGetItemComponent,
        context: listContext,
        scrollerRef: virtualizedScrollerRef,
        ...virtuosoProps
    } = useVirtualizedList<TItem, undefined>({
        items: snapshot.items,
        firstItemIndex,
        increaseViewportBy,
        getItemKey: (item) => item.key,
        isItemFocusable: () => true,
        mapRangeIndex: (virtuosoIndex) => Math.max(0, virtuosoIndex - firstItemIndex),
        rangeChanged: handleRangeChanged,
        atBottomStateChange: handleAtBottomStateChange,
        startReached: handleStartReached,
        endReached: handleEndReached,
        scrollIntoViewOnChange,
        scrollSettleFocusBehavior: "last-visible",
        followOutput: snapshot.isAtLiveEdge && followOutputEnabled ? "smooth" : false,
    });

    useLayoutEffect(() => {
        const previousRenderState = previousRenderStateRef.current;
        const windowShift = getContiguousWindowShift(previousRenderState.items, snapshot.items);

        const forwardPaginationAnchorIndex = getForwardPaginationAnchorIndex({
            previousItems: previousRenderState.items,
            nextItems: snapshot.items,
            forwardPaginationContext: forwardPaginationContextRef.current,
            previousForwardPagination: previousRenderState.forwardPagination,
            forwardPagination: snapshot.forwardPagination,
            hasScrollTarget: !!snapshot.scrollTarget,
            firstItemIndex,
            windowShift,
        });

        if (
            forwardPaginationAnchorIndex !== null &&
            scrollerElement &&
            forwardPaginationContextRef.current?.anchorKey
        ) {
            const anchorKey = forwardPaginationContextRef.current.anchorKey;
            const anchorElement = scrollerElement.querySelector<HTMLElement>(`[data-timeline-item-key="${anchorKey}"]`);
            const desiredBottomOffset = forwardPaginationContextRef.current.bottomOffsetPx;

            if (anchorElement && desiredBottomOffset !== null) {
                const scrollerRect = scrollerElement.getBoundingClientRect();
                const anchorRect = anchorElement.getBoundingClientRect();
                const currentBottomOffset = scrollerRect.bottom - anchorRect.bottom;
                const scrollAdjustment = getForwardPaginationAnchorAdjustment({
                    desiredBottomOffset,
                    currentBottomOffset,
                });

                if (scrollAdjustment !== 0) {
                    scrollerElement.scrollTo({
                        top: scrollerElement.scrollTop + scrollAdjustment,
                    });
                }
            }
        }

        previousRenderStateRef.current = {
            items: snapshot.items,
            backwardPagination: snapshot.backwardPagination,
            forwardPagination: snapshot.forwardPagination,
        };

        if (previousRenderState.forwardPagination === "loading" && snapshot.forwardPagination !== "loading") {
            forwardPaginationContextRef.current = null;
        }
    }, [
        firstItemIndex,
        scrollerElement,
        snapshot.backwardPagination,
        snapshot.items,
        snapshot.forwardPagination,
        snapshot.scrollTarget,
        virtuosoProps.ref,
    ]);

    const itemContent = useCallback(
        (index: number, item: TItem): JSX.Element => {
            return (
                // Timeline rows may contain their own interactive descendants; capture focus at
                // the wrapper so the shared VirtualizedList roving-focus model stays in sync.
                <div
                    key={item.key}
                    data-timeline-item-key={item.key}
                    onFocusCapture={(e) => onFocusForGetItemComponent(item, e)}
                >
                    {renderItem(item)}
                </div>
            );
        },
        [onFocusForGetItemComponent, renderItem],
    );

    const handleScrollerRef = useCallback(
        (element: HTMLElement | Window | null) => {
            virtualizedScrollerRef(element);
            const nextElement = element instanceof HTMLElement ? element : null;
            setScrollerElement((currentElement) => (currentElement === nextElement ? currentElement : nextElement));
        },
        [virtualizedScrollerRef],
    );

    useLayoutEffect(() => {
        const bottomSnapIndex = getPostInitialFillBottomSnapIndex({
            initialFillState,
            isAtLiveEdge: snapshot.isAtLiveEdge,
            hasScrollTarget: !!snapshot.scrollTarget,
            itemCount: snapshot.items.length,
            firstItemIndex,
            postInitialFillBottomSnapDone: postInitialFillBottomSnapDoneRef.current,
        });

        if (bottomSnapIndex === null) {
            return;
        }

        // After startup backfill completes, live timelines need one final bottom snap in the
        // adjusted firstItemIndex coordinate space to end up exactly pinned to the live edge.
        postInitialFillBottomSnapDoneRef.current = true;
        virtuosoProps.ref.current?.scrollIntoView({
            index: bottomSnapIndex,
            align: "end",
            behavior: "auto",
        });
    }, [
        initialFillState,
        firstItemIndex,
        scrollerElement,
        snapshot.isAtLiveEdge,
        snapshot.scrollTarget,
        snapshot.items.length,
        virtuosoProps.ref,
    ]);

    return (
        <Virtuoso
            className={classNames(styles.timeline, className)}
            data={snapshot.items}
            itemContent={itemContent}
            {...virtuosoProps}
            scrollerRef={handleScrollerRef}
        />
    );
}

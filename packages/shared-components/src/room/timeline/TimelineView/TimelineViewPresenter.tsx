/*
Copyright 2026 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type JSX } from "react";

import type { ListRange, ScrollIntoViewLocation, VirtuosoHandle } from "react-virtuoso";
import type { ScrollIntoViewOnChange } from "../../../core/VirtualizedList";
import { useVirtualizedList, type UseVirtualizedListResult } from "../../../core/VirtualizedList/virtualized-list";
import { useViewModel } from "../../../core/viewmodel/useViewModel";
import {
    MAX_INITIAL_FILL_ROUNDS,
    INITIAL_FIRST_ITEM_INDEX,
    OVERSCAN_PX,
    getContiguousWindowShift,
    getForwardPaginationAnchorAdjustment,
    getForwardPaginationAnchorIndex,
    getIsAtLiveEdgeFromBottomState,
    getPostInitialFillBottomSnapIndex,
    getScrollLocationOnChange,
    shouldDisableFollowOutputOnScroll,
    shouldIgnoreAtBottomStateChange,
    shouldIgnoreStartReached,
    shouldMarkInitialBottomSnapDoneOnScrollTarget,
    shouldPaginateBackwardAtTopScroll,
    shouldReplayPendingForwardPaginationAfterInitialFill,
} from "./TimelineViewBehavior";
import {
    MAX_LOCAL_ANCHOR_CORRECTION_ATTEMPTS,
    REQUIRED_STABLE_ANCHOR_ALIGNMENT_CHECKS,
    canAdjustScrollTop,
    canSnapToBottom,
    cannotAlignWithinLoadedWindow,
    findTimelineItemElement,
    getBottomOffset,
    getClampedScrollTop,
    getLastVisibleTimelineItemElement,
    getScrollTargetAdjustment,
    isScrollTargetAligned,
} from "./TimelineViewDom";
import type { PaginationState, TimelineItem, TimelineViewModel, VisibleRange } from "./types";

type InitialFillState = "filling" | "done";

interface ForwardPaginationContext {
    anchorKey: string | null;
    lastVisibleRange: VisibleRange | null;
    bottomOffsetPx: number | null;
    requestedAtLiveEdge: boolean;
    requestedWhileSeekingLiveEdge: boolean;
}

interface PreviousRenderState<TItem extends TimelineItem> {
    items: TItem[];
    isAtLiveEdge: boolean;
    backwardPagination: PaginationState;
    forwardPagination: PaginationState;
}

interface TopScrollState<TItem extends TimelineItem> {
    vm: TimelineViewModel<TItem>;
    initialFillState: InitialFillState;
    isAtLiveEdge: boolean;
    hasScrollTarget: boolean;
    backwardPagination: PaginationState;
    canPaginateBackward: boolean;
}

interface TimelineViewPresenterProps<TItem extends TimelineItem> {
    vm: TimelineViewModel<TItem>;
    renderItem: (item: TItem) => React.ReactNode;
}

interface TimelineViewPresenterResult<TItem extends TimelineItem> {
    items: TItem[];
    virtuosoProps: Omit<UseVirtualizedListResult<TItem, undefined>, "scrollerRef" | "onFocusForGetItemComponent">;
    itemContent: (index: number, item: TItem) => JSX.Element;
    handleScrollerRef: (element: HTMLElement | Window | null) => void;
}

function getEffectiveScrollerElement(scrollerElement: HTMLElement | null): HTMLElement | null {
    return scrollerElement ?? document.querySelector<HTMLElement>("[data-virtuoso-scroller='true']");
}

const FOLLOW_OUTPUT_DISABLE_SCROLL_EPSILON_PX = 4;
const VIRTUOSO_AT_BOTTOM_THRESHOLD_PX = 4;
const LIVE_EDGE_CLAMP_EPSILON_PX = 4;
const LIVE_EDGE_RECOVERY_EPSILON_PX = 64;
const STARTUP_ANCHOR_RESOLUTION_TOLERANCE_PX = 12;
const MAX_LIVE_EDGE_APPEND_CORRECTION_FRAMES = 8;
const REQUIRED_STABLE_LIVE_EDGE_APPEND_FRAMES = 2;

/**
 * Adapts a {@link TimelineViewModel} into the props and callbacks required by the
 * virtualized timeline renderer, including pagination, anchor restoration, and
 * live-edge tracking.
 */
export function useTimelineViewPresenter<TItem extends TimelineItem>({
    vm,
    renderItem,
}: TimelineViewPresenterProps<TItem>): TimelineViewPresenterResult<TItem> {
    const snapshot = useViewModel(vm);
    const previousVmRef = useRef(vm);
    const lastAnchoredKeyRef = useRef<string | null>(null);
    const acknowledgedScrollTargetKeyRef = useRef<string | null>(null);
    const initialBottomSnapDoneRef = useRef(false);
    const postInitialFillBottomSnapDoneRef = useRef(false);
    const initialFillCompletedNotifiedRef = useRef(false);
    const previousRenderStateRef = useRef<PreviousRenderState<TItem>>({
        items: [],
        isAtLiveEdge: snapshot.isAtLiveEdge,
        backwardPagination: snapshot.backwardPagination,
        forwardPagination: snapshot.forwardPagination,
    });
    const lastVisibleRangeRef = useRef<VisibleRange | null>(null);
    const [initialFillState, setInitialFillState] = useState<InitialFillState>("filling");
    const firstItemIndexRenderStateRef = useRef<{
        vm: typeof vm;
        items: TItem[];
        firstItemIndex: number;
    }>({
        vm,
        items: snapshot.items,
        firstItemIndex: INITIAL_FIRST_ITEM_INDEX,
    });
    const [scrollerElement, setScrollerElement] = useState<HTMLElement | null>(null);
    const initialFillRoundsRef = useRef(0);
    const sawInitialRangeRef = useRef(false);
    const [followOutputEnabled, setFollowOutputEnabled] = useState(snapshot.isAtLiveEdge);
    const forwardPaginationContextRef = useRef<ForwardPaginationContext | null>(null);
    const topScrollPaginationRequestedRef = useRef(false);
    const previousForwardPaginationRef = useRef(snapshot.forwardPagination);
    const lastForwardRequestedTailKeyRef = useRef<string | null>(null);
    const wasAtBottomRef = useRef(false);
    const pendingForwardPaginationAfterInitialFillRef = useRef(false);
    const ignoreNextEndReachedRef = useRef(false);
    const ignoreNextStartReachedRef = useRef(false);
    const ignoreNextTopScrollPaginationRef = useRef(false);
    const initialAnchorResolvedRef = useRef(false);
    const anchorResolutionRetryCountRef = useRef(0);
    const lastScrollTopRef = useRef<number | null>(null);
    const liveEdgeAppendCorrectionFrameIdsRef = useRef<number[]>([]);
    const liveEdgeAppendCorrectionInProgressRef = useRef(false);
    const latestLiveEdgeIntentRef = useRef({
        isAtLiveEdge: snapshot.isAtLiveEdge,
        canPaginateForward: snapshot.canPaginateForward,
        followOutputEnabled,
    });
    const [anchorResolutionRetryNonce, setAnchorResolutionRetryNonce] = useState(0);
    const latestTopScrollStateRef = useRef<TopScrollState<TItem>>({
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

    latestTopScrollStateRef.current = {
        vm,
        initialFillState,
        isAtLiveEdge: snapshot.isAtLiveEdge,
        hasScrollTarget: !!snapshot.scrollTarget,
        backwardPagination: snapshot.backwardPagination,
        canPaginateBackward: snapshot.canPaginateBackward,
    };

    const suppressNextProgrammaticCallbacks = useCallback(() => {
        ignoreNextEndReachedRef.current = true;
        ignoreNextStartReachedRef.current = true;
        ignoreNextTopScrollPaginationRef.current = true;
    }, []);

    const cancelPendingLiveEdgeAppendCorrection = useCallback(() => {
        for (const frameId of liveEdgeAppendCorrectionFrameIdsRef.current) {
            window.cancelAnimationFrame(frameId);
        }
        liveEdgeAppendCorrectionFrameIdsRef.current = [];
        liveEdgeAppendCorrectionInProgressRef.current = false;
    }, []);

    const scheduleLiveEdgeAppendCorrection = useCallback(
        (targetScrollerElement: HTMLElement) => {
            cancelPendingLiveEdgeAppendCorrection();
            liveEdgeAppendCorrectionInProgressRef.current = true;

            // Real event tiles can continue growing for a few frames after the
            // append commit (media sizing, URL previews, grouped layout, etc).
            // A single snap can therefore compute the "exact bottom" from a
            // stale scrollHeight and leave the viewport behind once layout
            // settles. Treat live-edge following as an intent and keep
            // re-checking for a short, bounded window until the measured bottom
            // stops moving.
            const scheduleFrame = (
                attempt: number,
                previousExactBottomScrollTop: number | null,
                stableFrameCount: number,
            ): void => {
                const frameId = window.requestAnimationFrame(() => {
                    liveEdgeAppendCorrectionFrameIdsRef.current = liveEdgeAppendCorrectionFrameIdsRef.current.filter(
                        (candidateId) => candidateId !== frameId,
                    );

                    if (!targetScrollerElement.isConnected) {
                        return;
                    }

                    const latestLiveEdgeIntent = latestLiveEdgeIntentRef.current;
                    if (
                        !latestLiveEdgeIntent.isAtLiveEdge ||
                        latestLiveEdgeIntent.canPaginateForward ||
                        !latestLiveEdgeIntent.followOutputEnabled
                    ) {
                        return;
                    }

                    const exactBottomScrollTop = Math.max(
                        0,
                        targetScrollerElement.scrollHeight - targetScrollerElement.clientHeight,
                    );
                    const nextStableFrameCount =
                        targetScrollerElement.scrollTop >= exactBottomScrollTop &&
                        previousExactBottomScrollTop === exactBottomScrollTop
                            ? stableFrameCount + 1
                            : 0;

                    if (targetScrollerElement.scrollTop < exactBottomScrollTop) {
                        targetScrollerElement.scrollTo({
                            top: exactBottomScrollTop,
                        });
                    }

                    if (
                        attempt >= MAX_LIVE_EDGE_APPEND_CORRECTION_FRAMES ||
                        nextStableFrameCount >= REQUIRED_STABLE_LIVE_EDGE_APPEND_FRAMES
                    ) {
                        liveEdgeAppendCorrectionInProgressRef.current = false;
                        return;
                    }

                    scheduleFrame(attempt + 1, exactBottomScrollTop, nextStableFrameCount);
                });

                liveEdgeAppendCorrectionFrameIdsRef.current.push(frameId);
            };

            scheduleFrame(1, null, 0);
        },
        [cancelPendingLiveEdgeAppendCorrection],
    );

    const markAnchorResolved = useCallback(() => {
        const currentTargetKey = snapshot.scrollTarget?.targetKey ?? null;
        if (currentTargetKey !== null && acknowledgedScrollTargetKeyRef.current === currentTargetKey) {
            return;
        }

        ignoreNextEndReachedRef.current = true;
        initialAnchorResolvedRef.current = initialFillState === "filling";
        if (initialAnchorResolvedRef.current) {
            pendingForwardPaginationAfterInitialFillRef.current = false;
        }
        acknowledgedScrollTargetKeyRef.current = currentTargetKey;
        vm.onScrollTargetReached();
    }, [initialFillState, snapshot.scrollTarget, vm]);

    const prepareBackwardAnchorFetch = useCallback(() => {
        lastAnchoredKeyRef.current = null;
        ignoreNextStartReachedRef.current = true;
        ignoreNextTopScrollPaginationRef.current = true;
    }, []);

    useEffect(() => {
        if (previousVmRef.current === vm) {
            return;
        }

        previousVmRef.current = vm;
        setInitialFillState("filling");
        lastAnchoredKeyRef.current = null;
        acknowledgedScrollTargetKeyRef.current = null;
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
        anchorResolutionRetryCountRef.current = 0;
        previousRenderStateRef.current = {
            items: [],
            isAtLiveEdge: snapshot.isAtLiveEdge,
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
        anchorResolutionRetryCountRef.current = 0;
    }, [vm, snapshot.scrollTarget]);

    useEffect(() => {
        if (!snapshot.scrollTarget) {
            acknowledgedScrollTargetKeyRef.current = null;
        }
    }, [snapshot.scrollTarget]);

    useEffect(() => {
        latestLiveEdgeIntentRef.current = {
            isAtLiveEdge: snapshot.isAtLiveEdge,
            canPaginateForward: snapshot.canPaginateForward,
            followOutputEnabled,
        };
    }, [snapshot.isAtLiveEdge, snapshot.canPaginateForward, followOutputEnabled]);

    useEffect(() => {
        return () => {
            cancelPendingLiveEdgeAppendCorrection();
        };
    }, [cancelPendingLiveEdgeAppendCorrection]);

    useEffect(() => {
        if (!snapshot.scrollTarget || acknowledgedScrollTargetKeyRef.current === snapshot.scrollTarget.targetKey) {
            return;
        }

        const timeoutId = window.setTimeout(() => {
            const effectiveScrollerElement = getEffectiveScrollerElement(scrollerElement);
            if (!effectiveScrollerElement || effectiveScrollerElement.clientHeight === 0) {
                return;
            }

            const targetElement = findTimelineItemElement(effectiveScrollerElement, snapshot.scrollTarget!.targetKey);
            if (!targetElement) {
                return;
            }

            const aligned = isScrollTargetAligned({
                scrollerElement: effectiveScrollerElement,
                targetElement,
                position: snapshot.scrollTarget!.position,
            });
            if (!aligned) {
                return;
            }

            markAnchorResolved();
        }, 0);

        return () => {
            window.clearTimeout(timeoutId);
        };
    }, [markAnchorResolved, scrollerElement, snapshot.scrollTarget]);

    useEffect(() => {
        setFollowOutputEnabled(snapshot.isAtLiveEdge);
    }, [snapshot.isAtLiveEdge]);

    useEffect(() => {
        if (initialFillState !== "done" || initialFillCompletedNotifiedRef.current) {
            return;
        }

        initialFillCompletedNotifiedRef.current = true;
        vm.onInitialFillCompleted();
    }, [initialFillState, vm]);

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

    useLayoutEffect(() => {
        if (snapshot.backwardPagination !== "loading") {
            topScrollPaginationRequestedRef.current = false;
        }
    }, [snapshot.backwardPagination]);

    const requestForwardPagination = useCallback(() => {
        const tailKey = snapshot.items.at(-1)?.key ?? null;
        if (tailKey !== null && tailKey === lastForwardRequestedTailKeyRef.current) {
            return false;
        }

        lastForwardRequestedTailKeyRef.current = tailKey;
        const anchorElement = scrollerElement ? getLastVisibleTimelineItemElement(scrollerElement) : null;

        forwardPaginationContextRef.current = {
            anchorKey: anchorElement?.dataset.timelineItemKey ?? null,
            lastVisibleRange: lastVisibleRangeRef.current,
            bottomOffsetPx: scrollerElement && anchorElement ? getBottomOffset(scrollerElement, anchorElement) : null,
            requestedAtLiveEdge: snapshot.isAtLiveEdge,
            requestedWhileSeekingLiveEdge: followOutputEnabled,
        };
        vm.onRequestMoreItems("forward");
        return true;
    }, [followOutputEnabled, scrollerElement, snapshot.isAtLiveEdge, snapshot.items, vm]);

    useEffect(() => {
        if (
            initialFillState !== "done" ||
            !snapshot.isAtLiveEdge ||
            !snapshot.canPaginateForward ||
            snapshot.forwardPagination !== "idle" ||
            !followOutputEnabled ||
            !!snapshot.scrollTarget ||
            !scrollerElement ||
            scrollerElement.clientHeight <= 0
        ) {
            return;
        }

        if (!wasAtBottomRef.current && !canSnapToBottom(scrollerElement)) {
            return;
        }

        requestForwardPagination();
    }, [
        followOutputEnabled,
        initialFillState,
        requestForwardPagination,
        scrollerElement,
        snapshot.canPaginateForward,
        snapshot.forwardPagination,
        snapshot.isAtLiveEdge,
        snapshot.scrollTarget,
    ]);

    useEffect(() => {
        const previousForwardPagination = previousForwardPaginationRef.current;
        previousForwardPaginationRef.current = snapshot.forwardPagination;

        if (previousForwardPagination !== "loading" || snapshot.forwardPagination === "loading") {
            return;
        }

        const currentTailKey = snapshot.items.at(-1)?.key ?? null;
        if (currentTailKey !== lastForwardRequestedTailKeyRef.current) {
            lastForwardRequestedTailKeyRef.current = null;
        }

        if (!scrollerElement) {
            return;
        }

        let cancelled = false;
        const frameId = window.requestAnimationFrame(() => {
            if (cancelled) {
                return;
            }

            const snapToBottomAfterLayout = canSnapToBottom(scrollerElement);
            const shouldContinueSeekingLiveEdge =
                snapshot.forwardPagination === "idle" &&
                initialFillState === "done" &&
                !snapshot.scrollTarget &&
                !snapshot.isAtLiveEdge &&
                snapshot.canPaginateForward &&
                followOutputEnabled &&
                snapToBottomAfterLayout;

            if (shouldContinueSeekingLiveEdge) {
                requestForwardPagination();
            }
        });

        return () => {
            cancelled = true;
            window.cancelAnimationFrame(frameId);
        };
    }, [
        followOutputEnabled,
        initialFillState,
        requestForwardPagination,
        scrollerElement,
        snapshot.canPaginateForward,
        snapshot.forwardPagination,
        snapshot.isAtLiveEdge,
        snapshot.items,
        snapshot.scrollTarget,
    ]);

    useLayoutEffect(() => {
        if (!scrollerElement || !snapshot.isAtLiveEdge || snapshot.canPaginateForward || snapshot.scrollTarget) {
            return;
        }

        const exactBottomScrollTop = Math.max(0, scrollerElement.scrollHeight - scrollerElement.clientHeight);
        const remainingToExactBottom = exactBottomScrollTop - scrollerElement.scrollTop;

        if (remainingToExactBottom <= 0 || remainingToExactBottom > LIVE_EDGE_CLAMP_EPSILON_PX) {
            return;
        }

        scrollerElement.scrollTo({
            top: exactBottomScrollTop,
        });
    }, [scrollerElement, snapshot.canPaginateForward, snapshot.isAtLiveEdge, snapshot.scrollTarget, snapshot.items]);

    useLayoutEffect(() => {
        if (!snapshot.scrollTarget) {
            return;
        }

        const effectiveScrollerElement = getEffectiveScrollerElement(scrollerElement);
        if (!effectiveScrollerElement) {
            return;
        }

        const targetElement = findTimelineItemElement(effectiveScrollerElement, snapshot.scrollTarget.targetKey);
        if (!targetElement) {
            if (
                initialFillState === "filling" &&
                snapshot.backwardPagination === "idle" &&
                snapshot.canPaginateBackward
            ) {
                prepareBackwardAnchorFetch();
                vm.onRequestMoreItems("backward");
            } else if (anchorResolutionRetryCountRef.current < 2) {
                anchorResolutionRetryCountRef.current += 1;
                setAnchorResolutionRetryNonce((currentNonce) => currentNonce + 1);
            }
            return;
        }

        if (effectiveScrollerElement.clientHeight === 0) {
            if (anchorResolutionRetryCountRef.current < 2) {
                anchorResolutionRetryCountRef.current += 1;
                setAnchorResolutionRetryNonce((currentNonce) => currentNonce + 1);
            }
            return;
        }

        anchorResolutionRetryCountRef.current = 0;

        const scrollAdjustment = getScrollTargetAdjustment({
            scrollerElement: effectiveScrollerElement,
            targetElement,
            position: snapshot.scrollTarget.position,
        });
        const aligned = isScrollTargetAligned({
            scrollerElement: effectiveScrollerElement,
            targetElement,
            position: snapshot.scrollTarget.position,
        });

        if (
            !aligned &&
            initialFillState === "filling" &&
            snapshot.backwardPagination !== "loading" &&
            Math.abs(scrollAdjustment) <= STARTUP_ANCHOR_RESOLUTION_TOLERANCE_PX
        ) {
            markAnchorResolved();
            return;
        }

        if (
            !aligned &&
            initialFillState === "filling" &&
            snapshot.backwardPagination === "loading" &&
            !canAdjustScrollTop(effectiveScrollerElement.scrollTop, scrollAdjustment)
        ) {
            return;
        }

        if (!aligned && canAdjustScrollTop(effectiveScrollerElement.scrollTop, scrollAdjustment)) {
            effectiveScrollerElement.scrollTo({
                top: getClampedScrollTop(effectiveScrollerElement.scrollTop, scrollAdjustment),
            });

            const targetKey = snapshot.scrollTarget.targetKey;
            const targetPosition = snapshot.scrollTarget.position;
            const verifyLocalAnchorCorrection = (attempt = 0, stableAlignmentChecks = 0): void => {
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        const latestTargetElement = findTimelineItemElement(effectiveScrollerElement, targetKey);
                        if (!latestTargetElement) {
                            return;
                        }

                        const adjustmentAfterCorrection = getScrollTargetAdjustment({
                            scrollerElement: effectiveScrollerElement,
                            targetElement: latestTargetElement,
                            position: targetPosition,
                        });
                        const alignedAfterAdjustment = isScrollTargetAligned({
                            scrollerElement: effectiveScrollerElement,
                            targetElement: latestTargetElement,
                            position: targetPosition,
                        });

                        if (alignedAfterAdjustment) {
                            if (snapshot.backwardPagination === "loading") {
                                return;
                            }

                            if (stableAlignmentChecks + 1 < REQUIRED_STABLE_ANCHOR_ALIGNMENT_CHECKS) {
                                verifyLocalAnchorCorrection(attempt + 1, stableAlignmentChecks + 1);
                                return;
                            }

                            markAnchorResolved();
                            return;
                        }

                        if (
                            canAdjustScrollTop(effectiveScrollerElement.scrollTop, adjustmentAfterCorrection) &&
                            attempt < MAX_LOCAL_ANCHOR_CORRECTION_ATTEMPTS
                        ) {
                            effectiveScrollerElement.scrollTo({
                                top: getClampedScrollTop(effectiveScrollerElement.scrollTop, adjustmentAfterCorrection),
                            });
                            verifyLocalAnchorCorrection(attempt + 1, 0);
                            return;
                        }

                        markAnchorResolved();
                    });
                });
            };

            verifyLocalAnchorCorrection();
            return;
        }

        if (
            !aligned &&
            cannotAlignWithinLoadedWindow(effectiveScrollerElement.scrollTop, scrollAdjustment) &&
            initialFillState === "filling" &&
            snapshot.backwardPagination === "idle" &&
            snapshot.canPaginateBackward
        ) {
            prepareBackwardAnchorFetch();
            vm.onRequestMoreItems("backward");
            return;
        }

        if (
            !aligned &&
            cannotAlignWithinLoadedWindow(effectiveScrollerElement.scrollTop, scrollAdjustment) &&
            initialFillState === "filling" &&
            snapshot.canPaginateBackward
        ) {
            return;
        }

        markAnchorResolved();
    }, [
        vm,
        initialFillState,
        markAnchorResolved,
        prepareBackwardAnchorFetch,
        scrollerElement,
        anchorResolutionRetryNonce,
        snapshot.scrollTarget,
        snapshot.backwardPagination,
        snapshot.canPaginateBackward,
    ]);

    useEffect(() => {
        if (!snapshot.scrollTarget) {
            return;
        }

        const effectiveScrollerElement = getEffectiveScrollerElement(scrollerElement);
        if (!effectiveScrollerElement || effectiveScrollerElement.clientHeight === 0) {
            return;
        }

        const targetElement = findTimelineItemElement(effectiveScrollerElement, snapshot.scrollTarget.targetKey);
        if (!targetElement) {
            return;
        }

        if (snapshot.backwardPagination === "loading") {
            return;
        }

        const aligned = isScrollTargetAligned({
            scrollerElement: effectiveScrollerElement,
            targetElement,
            position: snapshot.scrollTarget.position,
        });
        if (!aligned) {
            return;
        }

        markAnchorResolved();
    }, [markAnchorResolved, scrollerElement, snapshot.scrollTarget, snapshot.backwardPagination]);

    const handleRangeChanged = useCallback(
        (range: ListRange) => {
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
            const remainingToExactBottom =
                scrollerElement !== null
                    ? Math.max(0, scrollerElement.scrollHeight - scrollerElement.clientHeight - scrollerElement.scrollTop)
                    : null;

            const computedIsAtLiveEdge = getIsAtLiveEdgeFromBottomState({
                atBottom,
                canPaginateForward: snapshot.canPaginateForward,
            });
            const shouldPreserveLiveEdgeDuringCorrection =
                !atBottom &&
                snapshot.isAtLiveEdge &&
                !snapshot.scrollTarget &&
                !snapshot.canPaginateForward &&
                remainingToExactBottom !== null &&
                remainingToExactBottom <= LIVE_EDGE_RECOVERY_EPSILON_PX;
            const nextIsAtLiveEdge = shouldPreserveLiveEdgeDuringCorrection ? true : computedIsAtLiveEdge;

            if (
                shouldIgnoreAtBottomStateChange({
                    initialFillState,
                    hasScrollTarget: !!snapshot.scrollTarget,
                })
            ) {
                return;
            }

            if (
                shouldPreserveLiveEdgeDuringCorrection &&
                scrollerElement &&
                scrollerElement.clientHeight > 0
            ) {
                if (!followOutputEnabled) {
                    setFollowOutputEnabled(true);
                }
                scheduleLiveEdgeAppendCorrection(scrollerElement);
            }

            if (
                transitionedToBottom &&
                initialFillState === "done" &&
                snapshot.forwardPagination === "idle" &&
                snapshot.canPaginateForward &&
                followOutputEnabled &&
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
            scheduleLiveEdgeAppendCorrection,
            snapshot.canPaginateForward,
            snapshot.forwardPagination,
            snapshot.isAtLiveEdge,
            snapshot.scrollTarget,
            followOutputEnabled,
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
    }, [initialFillState, snapshot.scrollTarget]);

    const followOutput = useCallback((isAtBottom: boolean): "auto" | false => {
        return false;
    }, []);

    const scrollIntoViewOnChange = useCallback<ScrollIntoViewOnChange<TItem, undefined>>(
        ({ totalCount }): ScrollIntoViewLocation | null | undefined | false => {
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

            if (
                shouldMarkInitialBottomSnapDoneOnScrollTarget({
                    items: snapshot.items,
                    scrollTarget: snapshot.scrollTarget,
                    isAtLiveEdge: snapshot.isAtLiveEdge,
                    initialBottomSnapDone: initialBottomSnapDoneRef.current,
                })
            ) {
                initialBottomSnapDoneRef.current = true;
            }

            lastAnchoredKeyRef.current = snapshot.scrollTarget.targetKey;
            suppressNextProgrammaticCallbacks();
            return scrollLocation;
        },
        [snapshot.items, snapshot.scrollTarget, snapshot.isAtLiveEdge, suppressNextProgrammaticCallbacks],
    );

    useEffect(() => {
        if (!scrollerElement) {
            return;
        }

        lastScrollTopRef.current = scrollerElement.scrollTop;

        const onScroll = (): void => {
            const currentScrollTop = scrollerElement.scrollTop;
            const previousScrollTop = lastScrollTopRef.current;
            lastScrollTopRef.current = currentScrollTop;
            const latest = latestTopScrollStateRef.current;
            const snapCandidate = canSnapToBottom(scrollerElement);
            const exactBottomScrollTop = Math.max(0, scrollerElement.scrollHeight - scrollerElement.clientHeight);
            const canSnapScrollerToExactBottom = currentScrollTop < exactBottomScrollTop;
            const upwardDelta = previousScrollTop === null ? null : previousScrollTop - currentScrollTop;
            const shouldDisableFollowOutput =
                shouldDisableFollowOutputOnScroll({
                    previousScrollTop,
                    currentScrollTop,
                    isAtLiveEdge: latest.isAtLiveEdge,
                    followOutputEnabled,
                }) &&
                upwardDelta !== null &&
                upwardDelta > FOLLOW_OUTPUT_DISABLE_SCROLL_EPSILON_PX &&
                // The correction loop intentionally nudges scrollTop while
                // holding live-edge intent. Ignore those layout-driven deltas so
                // they are not mistaken for "the user scrolled up; stop
                // following live output".
                !liveEdgeAppendCorrectionInProgressRef.current &&
                !snapCandidate;

            if (shouldDisableFollowOutput) {
                setFollowOutputEnabled(false);
            }

            if (previousScrollTop !== null && currentScrollTop > previousScrollTop && snapCandidate) {
                if (!followOutputEnabled) {
                    setFollowOutputEnabled(true);
                }
                if (canSnapScrollerToExactBottom) {
                    scrollerElement.scrollTo({
                        top: exactBottomScrollTop,
                    });
                }
            }

            if (ignoreNextTopScrollPaginationRef.current) {
                ignoreNextTopScrollPaginationRef.current = false;
                return;
            }

            if (topScrollPaginationRequestedRef.current) {
                return;
            }

            if (
                !shouldPaginateBackwardAtTopScroll({
                    initialFillState: latest.initialFillState,
                    isAtLiveEdge: latest.isAtLiveEdge,
                    hasScrollTarget: latest.hasScrollTarget,
                    backwardPagination: latest.backwardPagination,
                    canPaginateBackward: latest.canPaginateBackward,
                    scrollTop: currentScrollTop,
                })
            ) {
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
        atBottomThreshold: VIRTUOSO_AT_BOTTOM_THRESHOLD_PX,
        startReached: handleStartReached,
        endReached: handleEndReached,
        scrollIntoViewOnChange,
        scrollSettleFocusBehavior: "last-visible",
        followOutput,
    });

    useLayoutEffect(() => {
        const previousRenderState = previousRenderStateRef.current;
        const windowShift = getContiguousWindowShift(previousRenderState.items, snapshot.items);
        const forwardPaginationCompleted =
            previousRenderState.forwardPagination === "loading" && snapshot.forwardPagination !== "loading";
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
            const anchorElement = findTimelineItemElement(
                scrollerElement,
                forwardPaginationContextRef.current.anchorKey,
            );
            const desiredBottomOffset = forwardPaginationContextRef.current.bottomOffsetPx;

            if (anchorElement && desiredBottomOffset !== null) {
                const scrollAdjustment = getForwardPaginationAnchorAdjustment({
                    desiredBottomOffset,
                    currentBottomOffset: getBottomOffset(scrollerElement, anchorElement),
                });

                if (scrollAdjustment !== 0) {
                    scrollerElement.scrollTo({
                        top: scrollerElement.scrollTop + scrollAdjustment,
                    });
                }
            }
        }

        const appendedWhileAtLiveEdge =
            scrollerElement &&
            previousRenderState.isAtLiveEdge &&
            snapshot.isAtLiveEdge &&
            previousRenderState.items.at(-1)?.key !== snapshot.items.at(-1)?.key;

        if (appendedWhileAtLiveEdge) {
            const exactBottomScrollTop = Math.max(0, scrollerElement.scrollHeight - scrollerElement.clientHeight);
            scrollerElement.scrollTo({
                top: exactBottomScrollTop,
            });
            scheduleLiveEdgeAppendCorrection(scrollerElement);
        }

        previousRenderStateRef.current = {
            items: snapshot.items,
            isAtLiveEdge: snapshot.isAtLiveEdge,
            backwardPagination: snapshot.backwardPagination,
            forwardPagination: snapshot.forwardPagination,
        };

        if (forwardPaginationCompleted) {
            forwardPaginationContextRef.current = null;
        }
    }, [
        firstItemIndex,
        scrollerElement,
        snapshot.backwardPagination,
        snapshot.isAtLiveEdge,
        snapshot.items,
        snapshot.forwardPagination,
        snapshot.scrollTarget,
        scheduleLiveEdgeAppendCorrection,
    ]);

    const itemContent = useCallback(
        (_index: number, item: TItem): JSX.Element => {
            return (
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

        postInitialFillBottomSnapDoneRef.current = true;
        (virtuosoProps.ref as React.RefObject<VirtuosoHandle | null>).current?.scrollIntoView({
            index: bottomSnapIndex,
            align: "end",
            behavior: "auto",
        });
    }, [
        initialFillState,
        firstItemIndex,
        snapshot.isAtLiveEdge,
        snapshot.scrollTarget,
        snapshot.items.length,
        virtuosoProps.ref,
    ]);

    return {
        items: snapshot.items,
        virtuosoProps,
        itemContent,
        handleScrollerRef,
    };
}

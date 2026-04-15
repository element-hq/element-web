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
    shouldUseForwardSlidingRebaseLocation,
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
    getFirstVisibleTimelineItemElement,
    getBottomOffset,
    getClampedScrollTop,
    getLastVisibleTimelineItemElement,
    getTopOffset,
    getScrollTargetAdjustment,
    isScrollTargetAligned,
} from "./TimelineViewDom";
import type { PaginationState, TimelineItem, TimelineViewModel, VisibleRange } from "./types";

type InitialFillState = "filling" | "settling" | "done";

interface ForwardPaginationContext {
    continuityMode: "anchor" | "bottom" | "shifted-range";
    anchorKey: string | null;
    lastVisibleRange: VisibleRange | null;
    bottomOffsetPx: number | null;
    shiftedRangeAnchorKey: string | null;
    shiftedRangeTopOffsetPx: number | null;
    requestedAtLiveEdge: boolean;
    requestedWhileSeekingLiveEdge: boolean;
}

interface BackwardPaginationContext {
    anchorKey: string | null;
    topOffsetPx: number | null;
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
const MAX_BACKWARD_PAGINATION_ANCHOR_CORRECTION_FRAMES = 8;
const REQUIRED_STABLE_BACKWARD_PAGINATION_ANCHOR_FRAMES = 2;
const MAX_FORWARD_PAGINATION_ANCHOR_CORRECTION_FRAMES = 8;
const REQUIRED_STABLE_FORWARD_PAGINATION_ANCHOR_FRAMES = 2;
const MAX_FORWARD_PAGINATION_ANCHOR_CORRECTION_STEP_PX = 96;
const MAX_FORWARD_PAGINATION_SHIFTED_RANGE_VIRTUOSO_FOLLOWUP_FRAMES = 6;
const REQUIRED_STABLE_FORWARD_PAGINATION_SHIFTED_RANGE_VIRTUOSO_FOLLOWUP_FRAMES = 2;
const BLOCKED_FORWARD_PAGINATION_SHIFTED_RANGE_RESTORE_EPSILON_PX = 24;
const REQUIRED_INITIAL_LIVE_EDGE_SETTLE_QUIET_PERIOD_MS = 200;
const MAX_INITIAL_LIVE_EDGE_SETTLE_DURATION_MS = 2000;

function summarizeTimelineItems<TItem extends TimelineItem>(items: TItem[]): string {
    const firstKey = items[0]?.key ?? "none";
    const lastKey = items.at(-1)?.key ?? "none";
    return `${firstKey}..${lastKey} (${items.length})`;
}

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
    const backwardPaginationContextRef = useRef<BackwardPaginationContext | null>(null);
    const topScrollPaginationRequestedRef = useRef(false);
    const previousForwardPaginationRef = useRef(snapshot.forwardPagination);
    const lastForwardRequestedTailKeyRef = useRef<string | null>(null);
    const wasAtBottomRef = useRef(false);
    const pendingForwardPaginationAfterInitialFillRef = useRef(false);
    const ignoreNextEndReachedRef = useRef(false);
    const ignoreNextStartReachedRef = useRef(false);
    const ignoreNextTopScrollPaginationRef = useRef(false);
    const initialAnchorResolvedRef = useRef(false);
    const suppressForwardPaginationUntilUserScrollAfterAnchorRef = useRef(false);
    const suppressForwardLiveEdgeSeekAfterAnchorRef = useRef(false);
    const anchorResolutionRetryCountRef = useRef(0);
    const lastScrollTopRef = useRef<number | null>(null);
    const liveEdgeAppendCorrectionFrameIdsRef = useRef<number[]>([]);
    const liveEdgeAppendCorrectionInProgressRef = useRef(false);
    const backwardPaginationAnchorCorrectionFrameIdsRef = useRef<number[]>([]);
    const backwardPaginationAnchorCorrectionInProgressRef = useRef(false);
    const forwardPaginationAnchorCorrectionFrameIdsRef = useRef<number[]>([]);
    const forwardPaginationAnchorCorrectionInProgressRef = useRef(false);
    const forwardPaginationShiftedRangeRestoreFrameIdsRef = useRef<number[]>([]);
    const forwardPaginationShiftedRangeRestoreInProgressRef = useRef(false);
    const forwardPaginationShiftedRangeRestoreGenerationRef = useRef(0);
    const forwardPaginationSlidingRebaseLockFrameIdsRef = useRef<number[]>([]);
    const forwardPaginationSlidingRebaseLockActiveRef = useRef(false);
    const forwardPaginationSlidingRebaseVirtuosoRestoreActiveRef = useRef(false);
    const handledForwardPaginationSlidingRebaseRangeRef = useRef<string | null>(null);
    const blockedForwardPaginationSlidingRebaseRangeRef = useRef<string | null>(null);
    const blockedForwardPaginationSlidingRebaseSettledScrollStateRef = useRef<{
        rangeKey: string | null;
        scrollTop: number | null;
    }>({
        rangeKey: null,
        scrollTop: null,
    });
    const activeForwardPaginationSlidingRebaseScrollLocationRef = useRef<ScrollIntoViewLocation | null>(null);
    const pendingVisibleRangeDuringForwardSlidingRebaseLockRef = useRef<VisibleRange | null>(null);
    const initialLiveEdgeSettleObserverRef = useRef<ResizeObserver | null>(null);
    const initialLiveEdgeSettleQuietTimeoutRef = useRef<number | null>(null);
    const initialLiveEdgeSettleMaxTimeoutRef = useRef<number | null>(null);
    const initialLiveEdgeSettleInProgressRef = useRef(false);
    const suppressPostInitialFillBottomSnapRef = useRef(false);
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
        const previousFirstItemIndex = firstItemIndexRenderStateRef.current.firstItemIndex;
        const nextFirstItemIndex = previousFirstItemIndex - windowShift;
        firstItemIndexRenderStateRef.current = {
            vm,
            items: snapshot.items,
            firstItemIndex: nextFirstItemIndex,
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

    const cancelPendingBackwardPaginationAnchorCorrection = useCallback(() => {
        for (const frameId of backwardPaginationAnchorCorrectionFrameIdsRef.current) {
            window.cancelAnimationFrame(frameId);
        }
        backwardPaginationAnchorCorrectionFrameIdsRef.current = [];
        backwardPaginationAnchorCorrectionInProgressRef.current = false;
    }, []);

    const cancelPendingForwardPaginationAnchorCorrection = useCallback(() => {
        for (const frameId of forwardPaginationAnchorCorrectionFrameIdsRef.current) {
            window.cancelAnimationFrame(frameId);
        }
        forwardPaginationAnchorCorrectionFrameIdsRef.current = [];
        forwardPaginationAnchorCorrectionInProgressRef.current = false;
    }, []);

    const cancelPendingForwardPaginationShiftedRangeRestore = useCallback(() => {
        forwardPaginationShiftedRangeRestoreGenerationRef.current += 1;
        for (const frameId of forwardPaginationShiftedRangeRestoreFrameIdsRef.current) {
            window.cancelAnimationFrame(frameId);
        }
        forwardPaginationShiftedRangeRestoreFrameIdsRef.current = [];
        forwardPaginationShiftedRangeRestoreInProgressRef.current = false;
    }, []);

    const cancelPendingForwardPaginationSlidingRebaseLock = useCallback(() => {
        for (const frameId of forwardPaginationSlidingRebaseLockFrameIdsRef.current) {
            window.cancelAnimationFrame(frameId);
        }
        forwardPaginationSlidingRebaseLockFrameIdsRef.current = [];
        forwardPaginationSlidingRebaseLockActiveRef.current = false;
        pendingVisibleRangeDuringForwardSlidingRebaseLockRef.current = null;
    }, []);

    const armForwardPaginationSlidingRebaseLock = useCallback(() => {
        cancelPendingForwardPaginationSlidingRebaseLock();
        forwardPaginationSlidingRebaseLockActiveRef.current = true;

        const scheduleReleaseFrame = (remainingFrames: number): void => {
            const frameId = window.requestAnimationFrame(() => {
                forwardPaginationSlidingRebaseLockFrameIdsRef.current =
                    forwardPaginationSlidingRebaseLockFrameIdsRef.current.filter(
                        (candidateId) => candidateId !== frameId,
                    );

                if (remainingFrames <= 1) {
                    forwardPaginationSlidingRebaseLockActiveRef.current = false;
                    forwardPaginationSlidingRebaseVirtuosoRestoreActiveRef.current = false;
                    const pendingVisibleRange = pendingVisibleRangeDuringForwardSlidingRebaseLockRef.current;
                    if (pendingVisibleRange !== null) {
                        pendingVisibleRangeDuringForwardSlidingRebaseLockRef.current = null;
                        vm.onVisibleRangeChanged(pendingVisibleRange);
                    }
                    return;
                }

                scheduleReleaseFrame(remainingFrames - 1);
            });

            forwardPaginationSlidingRebaseLockFrameIdsRef.current.push(frameId);
        };

        scheduleReleaseFrame(8);
    }, [cancelPendingForwardPaginationSlidingRebaseLock, vm]);

    const scheduleForwardPaginationShiftedRangeVirtuosoFollowupCorrection = useCallback(
        (targetScrollerElement: HTMLElement) => {
            cancelPendingForwardPaginationShiftedRangeRestore();
            forwardPaginationShiftedRangeRestoreInProgressRef.current = true;
            const restoreGeneration = forwardPaginationShiftedRangeRestoreGenerationRef.current;

            const applyCorrection = (
                attempt: number,
                stableFrameCount: number,
                phase: "frame" | "layout",
            ): { shouldContinue: boolean; nextStableFrameCount: number } => {
                if (
                    restoreGeneration !== forwardPaginationShiftedRangeRestoreGenerationRef.current ||
                    !targetScrollerElement.isConnected
                ) {
                    forwardPaginationShiftedRangeRestoreInProgressRef.current = false;
                    return { shouldContinue: false, nextStableFrameCount: stableFrameCount };
                }

                const anchorKey = forwardPaginationContextRef.current?.shiftedRangeAnchorKey;
                const desiredTopOffset = forwardPaginationContextRef.current?.shiftedRangeTopOffsetPx;
                if (!anchorKey || desiredTopOffset == null) {
                    forwardPaginationShiftedRangeRestoreInProgressRef.current = false;
                    return { shouldContinue: false, nextStableFrameCount: stableFrameCount };
                }

                const anchorElement = findTimelineItemElement(targetScrollerElement, anchorKey);
                if (!anchorElement) {
                    forwardPaginationShiftedRangeRestoreInProgressRef.current = false;
                    return { shouldContinue: false, nextStableFrameCount: stableFrameCount };
                }

                const currentTopOffset = getTopOffset(targetScrollerElement, anchorElement);
                const scrollAdjustment = currentTopOffset - desiredTopOffset;
                const nextStableFrameCount = Math.abs(scrollAdjustment) <= 1 ? stableFrameCount + 1 : 0;
                if (scrollAdjustment !== 0) {
                    targetScrollerElement.scrollTo({
                        top: targetScrollerElement.scrollTop + scrollAdjustment,
                    });
                }

                if (
                    attempt >= MAX_FORWARD_PAGINATION_SHIFTED_RANGE_VIRTUOSO_FOLLOWUP_FRAMES ||
                    nextStableFrameCount >= REQUIRED_STABLE_FORWARD_PAGINATION_SHIFTED_RANGE_VIRTUOSO_FOLLOWUP_FRAMES
                ) {
                    forwardPaginationShiftedRangeRestoreInProgressRef.current = false;
                    return { shouldContinue: false, nextStableFrameCount };
                }

                return { shouldContinue: true, nextStableFrameCount };
            };

            const scheduleFrame = (attempt: number, stableFrameCount: number): void => {
                const frameId = window.requestAnimationFrame(() => {
                    forwardPaginationShiftedRangeRestoreFrameIdsRef.current =
                        forwardPaginationShiftedRangeRestoreFrameIdsRef.current.filter(
                            (candidateId) => candidateId !== frameId,
                        );

                    const correction = applyCorrection(attempt, stableFrameCount, "frame");
                    if (!correction.shouldContinue) {
                        return;
                    }

                    scheduleFrame(attempt + 1, correction.nextStableFrameCount);
                });

                forwardPaginationShiftedRangeRestoreFrameIdsRef.current.push(frameId);
            };

            const firstLayoutFrameId = window.requestAnimationFrame(() => {
                forwardPaginationShiftedRangeRestoreFrameIdsRef.current =
                    forwardPaginationShiftedRangeRestoreFrameIdsRef.current.filter(
                        (candidateId) => candidateId !== firstLayoutFrameId,
                    );

                const secondLayoutFrameId = window.requestAnimationFrame(() => {
                    forwardPaginationShiftedRangeRestoreFrameIdsRef.current =
                        forwardPaginationShiftedRangeRestoreFrameIdsRef.current.filter(
                            (candidateId) => candidateId !== secondLayoutFrameId,
                        );

                    const correction = applyCorrection(0, 0, "layout");
                    if (!correction.shouldContinue) {
                        return;
                    }

                    scheduleFrame(1, correction.nextStableFrameCount);
                });

                forwardPaginationShiftedRangeRestoreFrameIdsRef.current.push(secondLayoutFrameId);
            });

            forwardPaginationShiftedRangeRestoreFrameIdsRef.current.push(firstLayoutFrameId);
        },
        [cancelPendingForwardPaginationShiftedRangeRestore],
    );

    const scheduleForwardPaginationShiftedRangeRestore = useCallback(
        (
            targetScrollerElement: HTMLElement,
            options?: {
                skipInitialBlockedRebasePrime?: boolean;
            },
        ) => {
            if (forwardPaginationSlidingRebaseVirtuosoRestoreActiveRef.current) {
                return;
            }

            const anchorKey = forwardPaginationContextRef.current?.shiftedRangeAnchorKey;
            const desiredTopOffset = forwardPaginationContextRef.current?.shiftedRangeTopOffsetPx;
            if (!anchorKey || desiredTopOffset === null || desiredTopOffset === undefined) {
                return;
            }

            cancelPendingForwardPaginationShiftedRangeRestore();
            forwardPaginationShiftedRangeRestoreInProgressRef.current = true;
            const restoreGeneration = forwardPaginationShiftedRangeRestoreGenerationRef.current;
            const skipInitialBlockedRebasePrime = options?.skipInitialBlockedRebasePrime ?? false;

            const applyRestoreStep = (
                attempt: number,
                stableFrameCount: number,
                phase: "layout" | "frame",
            ): { shouldContinue: boolean; nextStableFrameCount: number } => {
                const currentRangeKey = summarizeTimelineItems(snapshot.items);
                const blockedForwardSlidingRebaseRecoveryActive =
                    blockedForwardPaginationSlidingRebaseRangeRef.current === currentRangeKey;
                if (blockedForwardSlidingRebaseRecoveryActive) {
                    armForwardPaginationSlidingRebaseLock();
                }

                if (
                    restoreGeneration !== forwardPaginationShiftedRangeRestoreGenerationRef.current ||
                    forwardPaginationSlidingRebaseVirtuosoRestoreActiveRef.current
                ) {
                    forwardPaginationShiftedRangeRestoreInProgressRef.current = false;
                    return { shouldContinue: false, nextStableFrameCount: stableFrameCount };
                }

                if (!targetScrollerElement.isConnected) {
                    forwardPaginationShiftedRangeRestoreInProgressRef.current = false;
                    return { shouldContinue: false, nextStableFrameCount: stableFrameCount };
                }

                const currentAnchorKey = forwardPaginationContextRef.current?.shiftedRangeAnchorKey;
                const currentDesiredTopOffset = forwardPaginationContextRef.current?.shiftedRangeTopOffsetPx;
                if (!currentAnchorKey || currentDesiredTopOffset === null || currentDesiredTopOffset === undefined) {
                    forwardPaginationShiftedRangeRestoreInProgressRef.current = false;
                    return { shouldContinue: false, nextStableFrameCount: stableFrameCount };
                }

                const anchorElement = findTimelineItemElement(targetScrollerElement, currentAnchorKey);
                if (!anchorElement) {
                    const shouldDeferInitialBlockedForwardSlidingRebasePrime =
                        blockedForwardSlidingRebaseRecoveryActive &&
                        skipInitialBlockedRebasePrime &&
                        attempt === 0 &&
                        phase === "layout";
                    if (shouldDeferInitialBlockedForwardSlidingRebasePrime) {
                        return { shouldContinue: true, nextStableFrameCount: 0 };
                    }
                    const shouldPrimeBlockedForwardSlidingRebaseRecovery =
                        blockedForwardSlidingRebaseRecoveryActive &&
                        targetScrollerElement.clientHeight > 0 &&
                        attempt < MAX_BACKWARD_PAGINATION_ANCHOR_CORRECTION_FRAMES;
                    if (shouldPrimeBlockedForwardSlidingRebaseRecovery) {
                        const primeStepPx = Math.min(
                            MAX_FORWARD_PAGINATION_ANCHOR_CORRECTION_STEP_PX,
                            targetScrollerElement.clientHeight,
                        );
                        const nextScrollTop = getClampedScrollTop(targetScrollerElement.scrollTop, -primeStepPx);
                        if (nextScrollTop !== targetScrollerElement.scrollTop) {
                            targetScrollerElement.scrollTo({
                                top: nextScrollTop,
                            });
                        }
                        return { shouldContinue: true, nextStableFrameCount: 0 };
                    }
                    forwardPaginationShiftedRangeRestoreInProgressRef.current = false;
                    return { shouldContinue: false, nextStableFrameCount: stableFrameCount };
                }

                const currentTopOffset = getTopOffset(targetScrollerElement, anchorElement);
                const rawScrollAdjustment = currentTopOffset - currentDesiredTopOffset;
                const shouldAcceptBlockedForwardSlidingRebaseResidualOffset =
                    blockedForwardSlidingRebaseRecoveryActive &&
                    Math.abs(rawScrollAdjustment) <= BLOCKED_FORWARD_PAGINATION_SHIFTED_RANGE_RESTORE_EPSILON_PX;
                const scrollAdjustment = shouldAcceptBlockedForwardSlidingRebaseResidualOffset
                    ? 0
                    : rawScrollAdjustment;
                const nextStableFrameCount = shouldAcceptBlockedForwardSlidingRebaseResidualOffset
                    ? REQUIRED_STABLE_BACKWARD_PAGINATION_ANCHOR_FRAMES
                    : Math.abs(scrollAdjustment) <= 1
                      ? stableFrameCount + 1
                      : 0;

                if (scrollAdjustment !== 0) {
                    targetScrollerElement.scrollTo({
                        top: targetScrollerElement.scrollTop + scrollAdjustment,
                    });
                }

                if (
                    attempt >= MAX_BACKWARD_PAGINATION_ANCHOR_CORRECTION_FRAMES ||
                    nextStableFrameCount >= REQUIRED_STABLE_BACKWARD_PAGINATION_ANCHOR_FRAMES
                ) {
                    const settledBlockedForwardSlidingRebaseRange =
                        blockedForwardPaginationSlidingRebaseRangeRef.current ===
                        summarizeTimelineItems(snapshot.items);
                    if (settledBlockedForwardSlidingRebaseRange) {
                        handledForwardPaginationSlidingRebaseRangeRef.current = summarizeTimelineItems(snapshot.items);
                        blockedForwardPaginationSlidingRebaseSettledScrollStateRef.current = {
                            rangeKey: summarizeTimelineItems(snapshot.items),
                            scrollTop: targetScrollerElement.scrollTop,
                        };
                        pendingVisibleRangeDuringForwardSlidingRebaseLockRef.current = null;
                        cancelPendingForwardPaginationSlidingRebaseLock();
                    }
                    forwardPaginationShiftedRangeRestoreInProgressRef.current = false;
                    return { shouldContinue: false, nextStableFrameCount };
                }

                return { shouldContinue: true, nextStableFrameCount };
            };

            const initialStep = applyRestoreStep(0, 0, "layout");
            if (!initialStep.shouldContinue) {
                return;
            }

            const scheduleFrame = (attempt: number, stableFrameCount: number): void => {
                const frameId = window.requestAnimationFrame(() => {
                    forwardPaginationShiftedRangeRestoreFrameIdsRef.current =
                        forwardPaginationShiftedRangeRestoreFrameIdsRef.current.filter(
                            (candidateId) => candidateId !== frameId,
                        );

                    const step = applyRestoreStep(attempt, stableFrameCount, "frame");
                    if (!step.shouldContinue) {
                        return;
                    }

                    scheduleFrame(attempt + 1, step.nextStableFrameCount);
                });

                forwardPaginationShiftedRangeRestoreFrameIdsRef.current.push(frameId);
            };

            scheduleFrame(1, initialStep.nextStableFrameCount);
        },
        [
            armForwardPaginationSlidingRebaseLock,
            cancelPendingForwardPaginationShiftedRangeRestore,
            cancelPendingForwardPaginationSlidingRebaseLock,
            snapshot.items,
        ],
    );

    const cancelPendingInitialLiveEdgeSettleCorrection = useCallback(() => {
        if (initialLiveEdgeSettleObserverRef.current) {
            initialLiveEdgeSettleObserverRef.current.disconnect();
            initialLiveEdgeSettleObserverRef.current = null;
        }
        if (initialLiveEdgeSettleQuietTimeoutRef.current !== null) {
            window.clearTimeout(initialLiveEdgeSettleQuietTimeoutRef.current);
            initialLiveEdgeSettleQuietTimeoutRef.current = null;
        }
        if (initialLiveEdgeSettleMaxTimeoutRef.current !== null) {
            window.clearTimeout(initialLiveEdgeSettleMaxTimeoutRef.current);
            initialLiveEdgeSettleMaxTimeoutRef.current = null;
        }
        initialLiveEdgeSettleInProgressRef.current = false;
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

    const scheduleBackwardPaginationAnchorCorrection = useCallback(
        (targetScrollerElement: HTMLElement) => {
            const anchorKey = backwardPaginationContextRef.current?.anchorKey;
            const desiredTopOffset = backwardPaginationContextRef.current?.topOffsetPx;
            if (!anchorKey || desiredTopOffset === null) {
                return;
            }

            cancelPendingBackwardPaginationAnchorCorrection();
            backwardPaginationAnchorCorrectionInProgressRef.current = true;

            const scheduleFrame = (attempt: number, stableFrameCount: number): void => {
                const frameId = window.requestAnimationFrame(() => {
                    backwardPaginationAnchorCorrectionFrameIdsRef.current =
                        backwardPaginationAnchorCorrectionFrameIdsRef.current.filter(
                            (candidateId) => candidateId !== frameId,
                        );

                    if (!targetScrollerElement.isConnected) {
                        backwardPaginationAnchorCorrectionInProgressRef.current = false;
                        backwardPaginationContextRef.current = null;
                        return;
                    }

                    const currentAnchorKey = backwardPaginationContextRef.current?.anchorKey;
                    const currentDesiredTopOffset = backwardPaginationContextRef.current?.topOffsetPx;
                    if (!currentAnchorKey || currentDesiredTopOffset == null) {
                        backwardPaginationAnchorCorrectionInProgressRef.current = false;
                        backwardPaginationContextRef.current = null;
                        return;
                    }

                    const anchorElement = findTimelineItemElement(targetScrollerElement, currentAnchorKey);
                    if (!anchorElement) {
                        backwardPaginationAnchorCorrectionInProgressRef.current = false;
                        backwardPaginationContextRef.current = null;
                        return;
                    }

                    const currentTopOffset = getTopOffset(targetScrollerElement, anchorElement);
                    const scrollAdjustment = currentTopOffset - currentDesiredTopOffset;
                    const nextStableFrameCount = Math.abs(scrollAdjustment) <= 1 ? stableFrameCount + 1 : 0;

                    if (scrollAdjustment !== 0) {
                        targetScrollerElement.scrollTo({
                            top: targetScrollerElement.scrollTop + scrollAdjustment,
                        });
                    }

                    if (
                        attempt >= MAX_BACKWARD_PAGINATION_ANCHOR_CORRECTION_FRAMES ||
                        nextStableFrameCount >= REQUIRED_STABLE_BACKWARD_PAGINATION_ANCHOR_FRAMES
                    ) {
                        backwardPaginationAnchorCorrectionInProgressRef.current = false;
                        backwardPaginationContextRef.current = null;
                        return;
                    }

                    scheduleFrame(attempt + 1, nextStableFrameCount);
                });

                backwardPaginationAnchorCorrectionFrameIdsRef.current.push(frameId);
            };

            scheduleFrame(1, 0);
        },
        [cancelPendingBackwardPaginationAnchorCorrection],
    );

    const scheduleForwardPaginationAnchorCorrection = useCallback(
        (targetScrollerElement: HTMLElement, windowShift: number, forwardPaginationAnchorIndex: number | null) => {
            const anchorKey = forwardPaginationContextRef.current?.anchorKey;
            const desiredBottomOffset = forwardPaginationContextRef.current?.bottomOffsetPx;
            if (!anchorKey || desiredBottomOffset === null) {
                return;
            }

            cancelPendingForwardPaginationAnchorCorrection();
            forwardPaginationAnchorCorrectionInProgressRef.current = true;

            const scheduleFrame = (attempt: number, stableFrameCount: number): void => {
                const frameId = window.requestAnimationFrame(() => {
                    forwardPaginationAnchorCorrectionFrameIdsRef.current =
                        forwardPaginationAnchorCorrectionFrameIdsRef.current.filter(
                            (candidateId) => candidateId !== frameId,
                        );

                    if (!targetScrollerElement.isConnected) {
                        forwardPaginationAnchorCorrectionInProgressRef.current = false;
                        forwardPaginationContextRef.current = null;
                        return;
                    }

                    const currentAnchorKey = forwardPaginationContextRef.current?.anchorKey;
                    const currentDesiredBottomOffset = forwardPaginationContextRef.current?.bottomOffsetPx;
                    const currentRequestedAtLiveEdge =
                        forwardPaginationContextRef.current?.requestedAtLiveEdge ?? false;
                    const currentRequestedWhileSeekingLiveEdge =
                        forwardPaginationContextRef.current?.requestedWhileSeekingLiveEdge ?? false;
                    if (!currentAnchorKey || currentDesiredBottomOffset == null) {
                        forwardPaginationAnchorCorrectionInProgressRef.current = false;
                        forwardPaginationContextRef.current = null;
                        return;
                    }

                    const anchorElement = findTimelineItemElement(targetScrollerElement, currentAnchorKey);
                    if (!anchorElement) {
                        forwardPaginationAnchorCorrectionInProgressRef.current = false;
                        forwardPaginationContextRef.current = null;
                        return;
                    }

                    const currentBottomOffset = getBottomOffset(targetScrollerElement, anchorElement);
                    const rawScrollAdjustment = getForwardPaginationAnchorAdjustment({
                        desiredBottomOffset: currentDesiredBottomOffset,
                        currentBottomOffset,
                    });
                    const exactBottomScrollTop = Math.max(
                        0,
                        targetScrollerElement.scrollHeight - targetScrollerElement.clientHeight,
                    );
                    const remainingToExactBottom = exactBottomScrollTop - targetScrollerElement.scrollTop;
                    const isNearExactBottom =
                        remainingToExactBottom >= 0 && remainingToExactBottom <= LIVE_EDGE_CLAMP_EPSILON_PX;
                    const shouldDeferInitialCorrection = attempt === 1;
                    const shouldProtectNearBottomState =
                        currentRequestedAtLiveEdge || currentRequestedWhileSeekingLiveEdge;
                    const shouldAbortNearBottomCorrection =
                        shouldProtectNearBottomState &&
                        isNearExactBottom &&
                        Math.abs(rawScrollAdjustment) > MAX_FORWARD_PAGINATION_ANCHOR_CORRECTION_STEP_PX;
                    const scrollAdjustment =
                        shouldDeferInitialCorrection || shouldAbortNearBottomCorrection
                            ? 0
                            : Math.max(
                                  -MAX_FORWARD_PAGINATION_ANCHOR_CORRECTION_STEP_PX,
                                  Math.min(MAX_FORWARD_PAGINATION_ANCHOR_CORRECTION_STEP_PX, rawScrollAdjustment),
                              );
                    const nextStableFrameCount =
                        Math.abs(rawScrollAdjustment) <= 1 ||
                        shouldDeferInitialCorrection ||
                        shouldAbortNearBottomCorrection
                            ? stableFrameCount + 1
                            : 0;

                    if (scrollAdjustment !== 0) {
                        targetScrollerElement.scrollTo({
                            top: targetScrollerElement.scrollTop + scrollAdjustment,
                        });
                    }

                    if (
                        attempt >= MAX_FORWARD_PAGINATION_ANCHOR_CORRECTION_FRAMES ||
                        nextStableFrameCount >= REQUIRED_STABLE_FORWARD_PAGINATION_ANCHOR_FRAMES
                    ) {
                        forwardPaginationAnchorCorrectionInProgressRef.current = false;
                        forwardPaginationContextRef.current = null;
                        return;
                    }

                    scheduleFrame(attempt + 1, nextStableFrameCount);
                });

                forwardPaginationAnchorCorrectionFrameIdsRef.current.push(frameId);
            };

            scheduleFrame(1, 0);
        },
        [cancelPendingForwardPaginationAnchorCorrection],
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
        suppressForwardPaginationUntilUserScrollAfterAnchorRef.current = true;
        suppressForwardLiveEdgeSeekAfterAnchorRef.current = true;
        setFollowOutputEnabled(false);
        acknowledgedScrollTargetKeyRef.current = currentTargetKey;
        vm.onScrollTargetReached();
    }, [initialFillState, snapshot.scrollTarget, vm]);

    const scheduleInitialLiveEdgeSettleCorrection = useCallback(() => {
        if (initialLiveEdgeSettleInProgressRef.current || !snapshot.isAtLiveEdge || snapshot.scrollTarget) {
            return;
        }

        const effectiveScrollerElement = getEffectiveScrollerElement(scrollerElement);
        if (!effectiveScrollerElement) {
            setInitialFillState("done");
            return;
        }

        initialLiveEdgeSettleInProgressRef.current = true;

        const settleToExactBottom = (): number => {
            const exactBottomScrollTop = Math.max(
                0,
                effectiveScrollerElement.scrollHeight - effectiveScrollerElement.clientHeight,
            );

            if (effectiveScrollerElement.scrollTop < exactBottomScrollTop) {
                effectiveScrollerElement.scrollTo({
                    top: exactBottomScrollTop,
                });
            }

            return exactBottomScrollTop;
        };

        const finishSettling = (reason: "quiet-period" | "max-duration"): void => {
            if (!initialLiveEdgeSettleInProgressRef.current) {
                return;
            }

            settleToExactBottom();
            setInitialFillState("done");
        };

        const restartQuietPeriod = (): void => {
            settleToExactBottom();
            if (initialLiveEdgeSettleQuietTimeoutRef.current !== null) {
                window.clearTimeout(initialLiveEdgeSettleQuietTimeoutRef.current);
            }
            initialLiveEdgeSettleQuietTimeoutRef.current = window.setTimeout(() => {
                finishSettling("quiet-period");
            }, REQUIRED_INITIAL_LIVE_EDGE_SETTLE_QUIET_PERIOD_MS);
        };

        const observer = new ResizeObserver(() => {
            restartQuietPeriod();
        });

        observer.observe(effectiveScrollerElement);
        const viewportElement = effectiveScrollerElement.firstElementChild;
        if (viewportElement instanceof HTMLElement) {
            observer.observe(viewportElement);
            const itemListElement = viewportElement.firstElementChild;
            if (itemListElement instanceof HTMLElement) {
                observer.observe(itemListElement);
            }
        }

        restartQuietPeriod();
        initialLiveEdgeSettleMaxTimeoutRef.current = window.setTimeout(() => {
            finishSettling("max-duration");
        }, MAX_INITIAL_LIVE_EDGE_SETTLE_DURATION_MS);
    }, [scrollerElement, snapshot.isAtLiveEdge, snapshot.scrollTarget]);

    const prepareBackwardAnchorFetch = useCallback(() => {
        lastAnchoredKeyRef.current = null;
        ignoreNextStartReachedRef.current = true;
        ignoreNextTopScrollPaginationRef.current = true;
    }, []);

    const captureBackwardPaginationContext = useCallback(() => {
        const effectiveScrollerElement = getEffectiveScrollerElement(scrollerElement);
        if (!effectiveScrollerElement) {
            backwardPaginationContextRef.current = null;
            return;
        }

        const anchorElement = getFirstVisibleTimelineItemElement(effectiveScrollerElement);
        backwardPaginationContextRef.current = {
            anchorKey: anchorElement?.dataset.timelineItemKey ?? null,
            topOffsetPx:
                anchorElement instanceof HTMLElement ? getTopOffset(effectiveScrollerElement, anchorElement) : null,
        };
    }, [scrollerElement]);

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
        backwardPaginationContextRef.current = null;
        pendingForwardPaginationAfterInitialFillRef.current = false;
        ignoreNextEndReachedRef.current = false;
        ignoreNextStartReachedRef.current = false;
        ignoreNextTopScrollPaginationRef.current = false;
        lastForwardRequestedTailKeyRef.current = null;
        wasAtBottomRef.current = false;
        initialAnchorResolvedRef.current = false;
        suppressForwardPaginationUntilUserScrollAfterAnchorRef.current = false;
        suppressForwardLiveEdgeSeekAfterAnchorRef.current = false;
        anchorResolutionRetryCountRef.current = 0;
        suppressPostInitialFillBottomSnapRef.current = false;
        cancelPendingInitialLiveEdgeSettleCorrection();
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
    }, [cancelPendingInitialLiveEdgeSettleCorrection, vm, snapshot.isAtLiveEdge, snapshot.items]);

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
        if (snapshot.isAtLiveEdge) {
            suppressForwardLiveEdgeSeekAfterAnchorRef.current = false;
        }
    }, [snapshot.isAtLiveEdge]);

    useEffect(() => {
        return () => {
            cancelPendingLiveEdgeAppendCorrection();
            cancelPendingInitialLiveEdgeSettleCorrection();
            cancelPendingBackwardPaginationAnchorCorrection();
            cancelPendingForwardPaginationAnchorCorrection();
            cancelPendingForwardPaginationShiftedRangeRestore();
            cancelPendingForwardPaginationSlidingRebaseLock();
        };
    }, [
        cancelPendingBackwardPaginationAnchorCorrection,
        cancelPendingForwardPaginationAnchorCorrection,
        cancelPendingForwardPaginationSlidingRebaseLock,
        cancelPendingForwardPaginationShiftedRangeRestore,
        cancelPendingInitialLiveEdgeSettleCorrection,
        cancelPendingLiveEdgeAppendCorrection,
    ]);

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
        suppressForwardPaginationUntilUserScrollAfterAnchorRef.current = false;
        suppressForwardLiveEdgeSeekAfterAnchorRef.current = false;
        setInitialFillState("done");
    }, [firstItemIndex, initialFillState, snapshot.isAtLiveEdge, snapshot.items, snapshot.scrollTarget]);

    useEffect(() => {
        if (initialFillState === "filling") {
            return;
        }

        pendingForwardPaginationAfterInitialFillRef.current = false;
    }, [initialFillState]);

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
    }, [firstItemIndex, initialFillState, snapshot.forwardPagination, snapshot.canPaginateForward, snapshot.items, vm]);

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
        firstItemIndex,
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
    }, [firstItemIndex, snapshot.backwardPagination, snapshot.items]);

    const requestForwardPagination = useCallback(
        (reason: string) => {
            const tailKey = snapshot.items.at(-1)?.key ?? null;
            if (!tailKey || lastForwardRequestedTailKeyRef.current === tailKey) {
                return false;
            }

            lastForwardRequestedTailKeyRef.current = tailKey;
            const anchorElement = scrollerElement ? getLastVisibleTimelineItemElement(scrollerElement) : null;
            const shiftedRangeAnchorElement = scrollerElement
                ? getFirstVisibleTimelineItemElement(scrollerElement)
                : null;
            const shouldPreserveBottomContinuity =
                reason === "live-edge auto paginate" ||
                reason === "post-forward continue seeking live edge" ||
                (reason === "at-bottom state change" && (snapshot.isAtLiveEdge || followOutputEnabled));
            const continuityMode: ForwardPaginationContext["continuityMode"] = shouldPreserveBottomContinuity
                ? "bottom"
                : reason === "at-bottom state change"
                  ? "shifted-range"
                  : "anchor";

            forwardPaginationContextRef.current = {
                continuityMode,
                anchorKey: anchorElement?.dataset.timelineItemKey ?? null,
                lastVisibleRange: lastVisibleRangeRef.current,
                bottomOffsetPx:
                    scrollerElement && anchorElement ? getBottomOffset(scrollerElement, anchorElement) : null,
                shiftedRangeAnchorKey: shiftedRangeAnchorElement?.dataset.timelineItemKey ?? null,
                shiftedRangeTopOffsetPx:
                    scrollerElement && shiftedRangeAnchorElement
                        ? getTopOffset(scrollerElement, shiftedRangeAnchorElement)
                        : null,
                requestedAtLiveEdge: snapshot.isAtLiveEdge,
                requestedWhileSeekingLiveEdge: followOutputEnabled,
            };
            vm.onRequestMoreItems("forward");
            return true;
        },
        [followOutputEnabled, scrollerElement, snapshot.isAtLiveEdge, snapshot.items, vm],
    );

    useEffect(() => {
        if (
            initialFillState !== "done" ||
            !snapshot.isAtLiveEdge ||
            !snapshot.canPaginateForward ||
            snapshot.forwardPagination !== "idle" ||
            !followOutputEnabled ||
            suppressForwardLiveEdgeSeekAfterAnchorRef.current ||
            !!snapshot.scrollTarget ||
            !scrollerElement ||
            scrollerElement.clientHeight <= 0
        ) {
            return;
        }

        if (!wasAtBottomRef.current && !canSnapToBottom(scrollerElement)) {
            return;
        }
        requestForwardPagination("live-edge auto paginate");
    }, [
        followOutputEnabled,
        firstItemIndex,
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
                !suppressForwardLiveEdgeSeekAfterAnchorRef.current &&
                snapToBottomAfterLayout;
            if (shouldContinueSeekingLiveEdge) {
                requestForwardPagination("post-forward continue seeking live edge");
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

            const blockedForwardSlidingRebaseRange =
                blockedForwardPaginationSlidingRebaseRangeRef.current === summarizeTimelineItems(snapshot.items) &&
                forwardPaginationContextRef.current?.continuityMode === "shifted-range" &&
                !snapshot.scrollTarget;
            const exactBottomScrollTop = scrollerElement
                ? Math.max(0, scrollerElement.scrollHeight - scrollerElement.clientHeight)
                : null;
            const shouldSuppressBlockedForwardSlidingRebaseTailVisibleRangeRebound =
                hasRangeChanged &&
                blockedForwardSlidingRebaseRange &&
                scrollerElement !== null &&
                exactBottomScrollTop !== null &&
                scrollerElement.scrollTop < exactBottomScrollTop - 128 &&
                range.endIndex >= snapshot.items.length - 1 &&
                previousRange !== null &&
                range.startIndex > previousRange.startIndex;

            if (hasRangeChanged) {
                const suppressVisibleRangeCallbackForForwardSlidingRebaseLock =
                    forwardPaginationSlidingRebaseLockActiveRef.current;
                if (shouldSuppressBlockedForwardSlidingRebaseTailVisibleRangeRebound) {
                    return;
                }
                lastVisibleRangeRef.current = visibleRange;
                if (suppressVisibleRangeCallbackForForwardSlidingRebaseLock) {
                    pendingVisibleRangeDuringForwardSlidingRebaseLockRef.current = visibleRange;
                } else {
                    vm.onVisibleRangeChanged(visibleRange);
                }

                if (
                    scrollerElement &&
                    (forwardPaginationSlidingRebaseLockActiveRef.current ||
                        forwardPaginationShiftedRangeRestoreInProgressRef.current)
                ) {
                    if (forwardPaginationSlidingRebaseLockActiveRef.current) {
                        armForwardPaginationSlidingRebaseLock();
                    }
                    if (
                        !forwardPaginationSlidingRebaseVirtuosoRestoreActiveRef.current &&
                        !forwardPaginationShiftedRangeRestoreInProgressRef.current
                    ) {
                        scheduleForwardPaginationShiftedRangeRestore(scrollerElement);
                    }
                }
            }

            if (initialFillState !== "filling" || initialAnchorResolvedRef.current) {
                return;
            }

            if (snapshot.backwardPagination === "loading") {
                return;
            }

            if (initialFillRoundsRef.current === 0 && snapshot.canPaginateBackward && !snapshot.scrollTarget) {
                const lastLoadedIndex = Math.max(0, snapshot.items.length - 1);
                const shouldWaitForInitialLiveEdgeSettle =
                    snapshot.isAtLiveEdge && visibleRange.endIndex < lastLoadedIndex;

                if (shouldWaitForInitialLiveEdgeSettle) {
                    scheduleInitialLiveEdgeSettleCorrection();
                    return;
                }
            }

            const canContinueInitialFill =
                snapshot.items.length > 0 &&
                visibleRange.startIndex === 0 &&
                snapshot.canPaginateBackward &&
                initialFillRoundsRef.current < MAX_INITIAL_FILL_ROUNDS &&
                !snapshot.scrollTarget;
            const lastLoadedIndex = Math.max(0, snapshot.items.length - 1);
            const hasSettledAtLoadedLiveEdge =
                snapshot.isAtLiveEdge && !snapshot.scrollTarget && visibleRange.endIndex >= lastLoadedIndex;

            if (!sawInitialRangeRef.current) {
                sawInitialRangeRef.current = true;
                if (!canContinueInitialFill) {
                    if (hasSettledAtLoadedLiveEdge) {
                        initialBottomSnapDoneRef.current = true;
                    }
                    setInitialFillState("done");
                    return;
                }
            } else if (!canContinueInitialFill) {
                if (hasSettledAtLoadedLiveEdge) {
                    initialBottomSnapDoneRef.current = true;
                }
                setInitialFillState("done");
                return;
            }

            initialFillRoundsRef.current += 1;
            vm.onRequestMoreItems("backward");
        },
        [
            armForwardPaginationSlidingRebaseLock,
            vm,
            initialFillState,
            scrollerElement,
            scheduleForwardPaginationShiftedRangeRestore,
            snapshot.backwardPagination,
            snapshot.canPaginateBackward,
            snapshot.isAtLiveEdge,
            snapshot.items,
            snapshot.scrollTarget,
            scheduleInitialLiveEdgeSettleCorrection,
        ],
    );

    const handleAtBottomStateChange = useCallback(
        (atBottom: boolean) => {
            const transitionedToBottom = atBottom && !wasAtBottomRef.current;
            wasAtBottomRef.current = atBottom;
            const remainingToExactBottom =
                scrollerElement !== null
                    ? Math.max(
                          0,
                          scrollerElement.scrollHeight - scrollerElement.clientHeight - scrollerElement.scrollTop,
                      )
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
            const shouldAutoReenableFollowOutput =
                !snapshot.canPaginateForward &&
                !suppressForwardPaginationUntilUserScrollAfterAnchorRef.current &&
                !suppressForwardLiveEdgeSeekAfterAnchorRef.current;

            if (
                shouldIgnoreAtBottomStateChange({
                    initialFillState,
                    hasScrollTarget: !!snapshot.scrollTarget,
                })
            ) {
                return;
            }

            if (forwardPaginationShiftedRangeRestoreInProgressRef.current) {
                return;
            }

            if (forwardPaginationSlidingRebaseLockActiveRef.current) {
                return;
            }

            if (shouldPreserveLiveEdgeDuringCorrection && scrollerElement && scrollerElement.clientHeight > 0) {
                if (!followOutputEnabled && shouldAutoReenableFollowOutput) {
                    setFollowOutputEnabled(true);
                }
                scheduleLiveEdgeAppendCorrection(scrollerElement);
            }

            const shouldRequestForwardPagination =
                transitionedToBottom &&
                initialFillState === "done" &&
                snapshot.forwardPagination === "idle" &&
                snapshot.canPaginateForward &&
                !suppressForwardPaginationUntilUserScrollAfterAnchorRef.current &&
                !snapshot.scrollTarget &&
                !!scrollerElement &&
                scrollerElement.clientHeight > 0;

            if (shouldRequestForwardPagination) {
                requestForwardPagination("at-bottom state change");
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

        if (initialFillState !== "done") {
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
        pendingForwardPaginationAfterInitialFillRef.current = false;
        captureBackwardPaginationContext();
        vm.onRequestMoreItems("backward");
    }, [
        captureBackwardPaginationContext,
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

        if (initialFillState !== "done") {
            if (snapshot.canPaginateForward) {
                pendingForwardPaginationAfterInitialFillRef.current = true;
            }
            return;
        }

        if (snapshot.forwardPagination !== "idle" || !snapshot.canPaginateForward || snapshot.scrollTarget) {
            return;
        }
    }, [initialFillState, snapshot.canPaginateForward, snapshot.forwardPagination, snapshot.scrollTarget]);

    const followOutput = useCallback((isAtBottom: boolean): "auto" | false => {
        return false;
    }, []);

    const scrollIntoViewOnChange = useCallback<ScrollIntoViewOnChange<TItem, undefined>>(
        ({ totalCount }): ScrollIntoViewLocation | null | undefined | false => {
            const previousRenderState = previousRenderStateRef.current;
            const windowShift = getContiguousWindowShift(previousRenderState.items, snapshot.items);
            const lastVisibleRange = lastVisibleRangeRef.current;
            const currentRangeKey = summarizeTimelineItems(snapshot.items);
            const shiftedVisibleRange =
                lastVisibleRange === null
                    ? null
                    : {
                          startIndex: Math.max(0, lastVisibleRange.startIndex + windowShift),
                          endIndex: Math.max(0, lastVisibleRange.endIndex + windowShift),
                      };
            const scrollLocation = getScrollLocationOnChange({
                items: snapshot.items,
                scrollTarget: snapshot.scrollTarget,
                isAtLiveEdge: snapshot.isAtLiveEdge,
                totalCount,
                lastAnchoredKey: lastAnchoredKeyRef.current,
                initialBottomSnapDone: initialBottomSnapDoneRef.current,
            });
            const mappedScrollLocation =
                scrollLocation && "index" in scrollLocation
                    ? {
                          ...scrollLocation,
                          index: firstItemIndex + scrollLocation.index,
                      }
                    : scrollLocation;
            const activeForwardSlidingRebaseScrollLocation =
                activeForwardPaginationSlidingRebaseScrollLocationRef.current;

            if (
                handledForwardPaginationSlidingRebaseRangeRef.current === currentRangeKey &&
                activeForwardSlidingRebaseScrollLocation &&
                !snapshot.scrollTarget &&
                forwardPaginationContextRef.current?.continuityMode === "shifted-range"
            ) {
                forwardPaginationSlidingRebaseVirtuosoRestoreActiveRef.current = true;
                suppressNextProgrammaticCallbacks();
                return activeForwardSlidingRebaseScrollLocation;
            }

            const shouldUseForwardSlidingRebaseLocationForCurrentRange = shouldUseForwardSlidingRebaseLocation({
                previousForwardPagination: previousRenderState.forwardPagination,
                forwardPagination: snapshot.forwardPagination,
                continuityMode: forwardPaginationContextRef.current?.continuityMode ?? null,
                windowShift,
                hasShiftedVisibleRange: shiftedVisibleRange !== null,
                currentRangeKey,
                blockedRangeKey: blockedForwardPaginationSlidingRebaseRangeRef.current,
                handledRangeKey: handledForwardPaginationSlidingRebaseRangeRef.current,
            });

            if (shouldUseForwardSlidingRebaseLocationForCurrentRange && shiftedVisibleRange !== null) {
                const forwardSlidingRebaseScrollLocation: ScrollIntoViewLocation = {
                    align: "start",
                    behavior: "auto",
                    index: firstItemIndex + shiftedVisibleRange.startIndex,
                };
                handledForwardPaginationSlidingRebaseRangeRef.current = currentRangeKey;
                activeForwardPaginationSlidingRebaseScrollLocationRef.current = forwardSlidingRebaseScrollLocation;
                forwardPaginationSlidingRebaseVirtuosoRestoreActiveRef.current = true;
                suppressNextProgrammaticCallbacks();
                return forwardSlidingRebaseScrollLocation;
            }

            if (
                blockedForwardPaginationSlidingRebaseRangeRef.current === currentRangeKey &&
                !snapshot.scrollTarget &&
                forwardPaginationContextRef.current?.continuityMode === "shifted-range"
            ) {
                lastAnchoredKeyRef.current = null;
                return false;
            }

            if (!mappedScrollLocation) {
                if (!snapshot.scrollTarget) {
                    lastAnchoredKeyRef.current = null;
                }
                return false;
            }

            if (!snapshot.scrollTarget) {
                initialBottomSnapDoneRef.current = true;
                lastAnchoredKeyRef.current = null;
                return mappedScrollLocation;
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
            return mappedScrollLocation;
        },
        [
            snapshot.isAtLiveEdge,
            firstItemIndex,
            snapshot.forwardPagination,
            snapshot.items,
            snapshot.scrollTarget,
            suppressNextProgrammaticCallbacks,
        ],
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
            const currentRangeKey = summarizeTimelineItems(snapshot.items);
            const snapCandidate = canSnapToBottom(scrollerElement);
            const exactBottomScrollTop = Math.max(0, scrollerElement.scrollHeight - scrollerElement.clientHeight);
            const upwardDelta = previousScrollTop === null ? null : previousScrollTop - currentScrollTop;
            const activeForwardSlidingRebaseRange =
                handledForwardPaginationSlidingRebaseRangeRef.current === currentRangeKey &&
                !!activeForwardPaginationSlidingRebaseScrollLocationRef.current &&
                forwardPaginationContextRef.current?.continuityMode === "shifted-range" &&
                !latest.hasScrollTarget;
            const blockedForwardSlidingRebaseRange =
                blockedForwardPaginationSlidingRebaseRangeRef.current === currentRangeKey &&
                forwardPaginationContextRef.current?.continuityMode === "shifted-range" &&
                !latest.hasScrollTarget;

            if (
                (activeForwardSlidingRebaseRange || blockedForwardSlidingRebaseRange) &&
                previousScrollTop !== null &&
                currentScrollTop - previousScrollTop > 128 &&
                (exactBottomScrollTop - currentScrollTop <= 96 || ignoreNextEndReachedRef.current)
            ) {
                if (activeForwardSlidingRebaseRange) {
                    forwardPaginationSlidingRebaseVirtuosoRestoreActiveRef.current = false;
                    handledForwardPaginationSlidingRebaseRangeRef.current = null;
                    blockedForwardPaginationSlidingRebaseRangeRef.current = currentRangeKey;
                    activeForwardPaginationSlidingRebaseScrollLocationRef.current = null;
                }
                const blockedRecoverySettledScrollState =
                    blockedForwardPaginationSlidingRebaseSettledScrollStateRef.current;
                const settledBlockedRecoveryScrollTop =
                    blockedForwardSlidingRebaseRange &&
                    blockedRecoverySettledScrollState.rangeKey === currentRangeKey &&
                    blockedRecoverySettledScrollState.scrollTop !== null
                        ? blockedRecoverySettledScrollState.scrollTop
                        : null;
                const blockedRecoveryAnchorKey = forwardPaginationContextRef.current?.shiftedRangeAnchorKey;
                const blockedRecoveryDesiredTopOffset = forwardPaginationContextRef.current?.shiftedRangeTopOffsetPx;
                const blockedRecoveryAnchorElement =
                    blockedRecoveryAnchorKey != null
                        ? findTimelineItemElement(scrollerElement, blockedRecoveryAnchorKey)
                        : null;
                if (settledBlockedRecoveryScrollTop !== null) {
                    cancelPendingForwardPaginationShiftedRangeRestore();
                    cancelPendingForwardPaginationSlidingRebaseLock();
                    forwardPaginationSlidingRebaseVirtuosoRestoreActiveRef.current = false;
                    pendingVisibleRangeDuringForwardSlidingRebaseLockRef.current = null;
                    scrollerElement.scrollTo({
                        top: settledBlockedRecoveryScrollTop,
                    });
                    return;
                }
                if (
                    blockedForwardSlidingRebaseRange &&
                    blockedRecoveryAnchorElement &&
                    blockedRecoveryDesiredTopOffset != null
                ) {
                    const currentTopOffset = getTopOffset(scrollerElement, blockedRecoveryAnchorElement);
                    const scrollAdjustment = currentTopOffset - blockedRecoveryDesiredTopOffset;
                    if (scrollAdjustment !== 0) {
                        scrollerElement.scrollTo({
                            top: scrollerElement.scrollTop + scrollAdjustment,
                        });
                    }
                } else {
                    const shouldRevertForwardSlidingRebaseRecoveryToPreviousScrollTop =
                        previousScrollTop !== null &&
                        previousScrollTop < currentScrollTop &&
                        (activeForwardSlidingRebaseRange || blockedForwardSlidingRebaseRange);
                    const primeStepPx = Math.min(
                        MAX_FORWARD_PAGINATION_ANCHOR_CORRECTION_STEP_PX,
                        scrollerElement.clientHeight,
                    );
                    const primedScrollTop = shouldRevertForwardSlidingRebaseRecoveryToPreviousScrollTop
                        ? previousScrollTop
                        : getClampedScrollTop(currentScrollTop, -primeStepPx);
                    if (primedScrollTop !== currentScrollTop) {
                        scrollerElement.scrollTo({
                            top: primedScrollTop,
                        });
                    }
                }
                armForwardPaginationSlidingRebaseLock();
                scheduleForwardPaginationShiftedRangeRestore(scrollerElement, {
                    skipInitialBlockedRebasePrime: blockedRecoveryAnchorElement === null,
                });
                return;
            }

            if (forwardPaginationShiftedRangeRestoreInProgressRef.current) {
                return;
            }

            if (forwardPaginationSlidingRebaseLockActiveRef.current) {
                if (
                    !forwardPaginationSlidingRebaseVirtuosoRestoreActiveRef.current &&
                    !forwardPaginationShiftedRangeRestoreInProgressRef.current
                ) {
                    scheduleForwardPaginationShiftedRangeRestore(scrollerElement);
                }
                return;
            }

            if (
                latest.initialFillState === "filling" &&
                upwardDelta !== null &&
                upwardDelta > FOLLOW_OUTPUT_DISABLE_SCROLL_EPSILON_PX &&
                !liveEdgeAppendCorrectionInProgressRef.current
            ) {
                suppressPostInitialFillBottomSnapRef.current = true;
            }

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

            const isLikelyUserScroll =
                previousScrollTop !== null &&
                Math.abs(currentScrollTop - previousScrollTop) > FOLLOW_OUTPUT_DISABLE_SCROLL_EPSILON_PX &&
                !liveEdgeAppendCorrectionInProgressRef.current;
            if (
                activeForwardSlidingRebaseRange &&
                isLikelyUserScroll &&
                !forwardPaginationSlidingRebaseLockActiveRef.current
            ) {
                handledForwardPaginationSlidingRebaseRangeRef.current = null;
                activeForwardPaginationSlidingRebaseScrollLocationRef.current = null;
            }
            if (
                blockedForwardSlidingRebaseRange &&
                isLikelyUserScroll &&
                !forwardPaginationSlidingRebaseLockActiveRef.current &&
                !forwardPaginationShiftedRangeRestoreInProgressRef.current &&
                currentScrollTop < exactBottomScrollTop - 128
            ) {
                handledForwardPaginationSlidingRebaseRangeRef.current = currentRangeKey;
            }
            if (
                suppressForwardPaginationUntilUserScrollAfterAnchorRef.current &&
                latest.initialFillState === "done" &&
                !latest.hasScrollTarget &&
                isLikelyUserScroll
            ) {
                suppressForwardPaginationUntilUserScrollAfterAnchorRef.current = false;
                suppressForwardLiveEdgeSeekAfterAnchorRef.current = false;
            }

            if (previousScrollTop !== null && currentScrollTop > previousScrollTop && snapCandidate) {
                const shouldAutoReenableFollowOutput =
                    !snapshot.canPaginateForward &&
                    !suppressForwardPaginationUntilUserScrollAfterAnchorRef.current &&
                    !suppressForwardLiveEdgeSeekAfterAnchorRef.current;
                if (!followOutputEnabled && shouldAutoReenableFollowOutput) {
                    setFollowOutputEnabled(true);
                }
                if (
                    !forwardPaginationAnchorCorrectionInProgressRef.current &&
                    !forwardPaginationShiftedRangeRestoreInProgressRef.current &&
                    !blockedForwardSlidingRebaseRange
                ) {
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
    }, [
        firstItemIndex,
        armForwardPaginationSlidingRebaseLock,
        cancelPendingForwardPaginationShiftedRangeRestore,
        cancelPendingForwardPaginationSlidingRebaseLock,
        followOutputEnabled,
        scrollerElement,
        scheduleForwardPaginationShiftedRangeRestore,
        snapshot.canPaginateForward,
        snapshot.items,
    ]);

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
        const currentRangeKey = summarizeTimelineItems(snapshot.items);
        const windowShift = getContiguousWindowShift(previousRenderState.items, snapshot.items);
        const lastVisibleRange = lastVisibleRangeRef.current;
        const shiftedVisibleRange =
            lastVisibleRange === null
                ? null
                : {
                      startIndex: Math.max(0, lastVisibleRange.startIndex + windowShift),
                      endIndex: Math.max(0, lastVisibleRange.endIndex + windowShift),
                  };
        const forwardPaginationCompleted =
            previousRenderState.forwardPagination === "loading" && snapshot.forwardPagination !== "loading";
        const exactBottomScrollTop = scrollerElement
            ? Math.max(0, scrollerElement.scrollHeight - scrollerElement.clientHeight)
            : 0;
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
        const shouldRestoreForwardPaginationAnchor =
            forwardPaginationCompleted &&
            scrollerElement &&
            forwardPaginationContextRef.current?.continuityMode === "anchor" &&
            forwardPaginationContextRef.current?.anchorKey &&
            forwardPaginationContextRef.current.bottomOffsetPx !== null;
        const shouldRestoreForwardPaginationShiftedRange =
            forwardPaginationCompleted &&
            forwardPaginationContextRef.current?.continuityMode === "shifted-range" &&
            shiftedVisibleRange !== null;
        const shouldPreserveForwardPaginationBottom =
            forwardPaginationCompleted &&
            scrollerElement &&
            forwardPaginationContextRef.current?.continuityMode === "bottom";

        if (shouldRestoreForwardPaginationAnchor) {
            scheduleForwardPaginationAnchorCorrection(scrollerElement, windowShift, forwardPaginationAnchorIndex);
        }

        if (shouldRestoreForwardPaginationShiftedRange) {
            if (!scrollerElement) {
                return;
            }
            if (windowShift < 0) {
                if (
                    scrollerElement &&
                    handledForwardPaginationSlidingRebaseRangeRef.current === currentRangeKey &&
                    activeForwardPaginationSlidingRebaseScrollLocationRef.current
                ) {
                    armForwardPaginationSlidingRebaseLock();
                    if (!forwardPaginationShiftedRangeRestoreInProgressRef.current) {
                        scheduleForwardPaginationShiftedRangeVirtuosoFollowupCorrection(scrollerElement);
                    }
                    return;
                }
                armForwardPaginationSlidingRebaseLock();
                forwardPaginationSlidingRebaseVirtuosoRestoreActiveRef.current = false;
                cancelPendingForwardPaginationShiftedRangeRestore();
                handledForwardPaginationSlidingRebaseRangeRef.current = null;
                scheduleForwardPaginationShiftedRangeRestore(scrollerElement);
                return;
            }
            forwardPaginationSlidingRebaseVirtuosoRestoreActiveRef.current = false;
            scheduleForwardPaginationShiftedRangeRestore(scrollerElement);
        }

        if (shouldPreserveForwardPaginationBottom) {
            scrollerElement.scrollTo({
                top: exactBottomScrollTop,
            });
            window.requestAnimationFrame(() => {
                if (!scrollerElement.isConnected) {
                    return;
                }
                const latestExactBottomScrollTop = Math.max(
                    0,
                    scrollerElement.scrollHeight - scrollerElement.clientHeight,
                );
                if (scrollerElement.scrollTop < latestExactBottomScrollTop) {
                    scrollerElement.scrollTo({
                        top: latestExactBottomScrollTop,
                    });
                }
            });
        }

        const backwardPaginationCompleted =
            previousRenderState.backwardPagination === "loading" && snapshot.backwardPagination !== "loading";
        if (backwardPaginationCompleted && scrollerElement && backwardPaginationContextRef.current?.anchorKey) {
            scheduleBackwardPaginationAnchorCorrection(scrollerElement);
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

        if (
            forwardPaginationCompleted &&
            !forwardPaginationAnchorCorrectionInProgressRef.current &&
            !forwardPaginationShiftedRangeRestoreInProgressRef.current
        ) {
            forwardPaginationContextRef.current = null;
        }
        if (backwardPaginationCompleted && !backwardPaginationAnchorCorrectionInProgressRef.current) {
            backwardPaginationContextRef.current = null;
        }
    }, [
        firstItemIndex,
        scheduleBackwardPaginationAnchorCorrection,
        scrollerElement,
        snapshot.backwardPagination,
        snapshot.isAtLiveEdge,
        snapshot.items,
        snapshot.forwardPagination,
        snapshot.scrollTarget,
        armForwardPaginationSlidingRebaseLock,
        cancelPendingForwardPaginationShiftedRangeRestore,
        scheduleLiveEdgeAppendCorrection,
        scheduleForwardPaginationAnchorCorrection,
        scheduleForwardPaginationShiftedRangeVirtuosoFollowupCorrection,
        scheduleForwardPaginationShiftedRangeRestore,
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
        const suppressPostInitialFillBottomSnapForNoStartupBackfill =
            initialFillRoundsRef.current === 0 && snapshot.isAtLiveEdge && !snapshot.scrollTarget;
        const bottomSnapIndex = getPostInitialFillBottomSnapIndex({
            initialFillState,
            isAtLiveEdge: snapshot.isAtLiveEdge,
            hasScrollTarget: !!snapshot.scrollTarget,
            itemCount: snapshot.items.length,
            firstItemIndex,
            postInitialFillBottomSnapDone: postInitialFillBottomSnapDoneRef.current,
            suppressForUpwardScrollDuringInitialFill:
                suppressPostInitialFillBottomSnapRef.current || suppressPostInitialFillBottomSnapForNoStartupBackfill,
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

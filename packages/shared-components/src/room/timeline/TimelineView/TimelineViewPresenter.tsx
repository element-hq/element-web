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
    canSnapToBottom,
    findTimelineItemElement,
    getBottomOffset,
    getFirstVisibleTimelineItemElement,
    getClampedScrollTop,
    getTopOffset,
} from "./TimelineViewDom";
import type { PaginationState, TimelineItem, TimelineViewModel, VisibleRange } from "./types";
import { useTimelineAnchorResolution } from "./useTimelineAnchorResolution";
import { type ForwardPaginationContext, useTimelineForwardPagination } from "./useTimelineForwardPagination";
import { useTimelineForwardPaginationAnchorRestore } from "./useTimelineForwardPaginationAnchorRestore";
import { useTimelineForwardPaginationShiftedRangeRestore } from "./useTimelineForwardPaginationShiftedRangeRestore";
import { useTimelineForwardSlidingRebaseLock } from "./useTimelineForwardSlidingRebaseLock";
import { useTimelineLiveEdge } from "./useTimelineLiveEdge";

type InitialFillState = "filling" | "settling" | "done";

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
const MAX_BACKWARD_PAGINATION_ANCHOR_CORRECTION_FRAMES = 8;
const MAX_FORWARD_PAGINATION_ANCHOR_CORRECTION_STEP_PX = 96;
const REQUIRED_STABLE_BACKWARD_PAGINATION_ANCHOR_FRAMES = 2;
const USER_SCROLL_GESTURE_IDLE_GAP_MS = 200;

function summarizeTimelineItems<TItem extends TimelineItem>(items: TItem[]): string {
    const firstKey = items[0]?.key ?? "none";
    const lastKey = items.at(-1)?.key ?? "none";
    return `${firstKey}..${lastKey} (${items.length})`;
}

function logTimelineViewPresenter(...parts: Array<string | number | boolean | null | undefined>): void {
    void parts;
}

/**
 * Detects when a forward sliding rebase restore was interrupted by additional
 * layout movement and re-primes the shifted-range restore flow from the
 * scroller's current DOM state.
 *
 * This remains in the presenter because it coordinates presenter-owned refs and
 * the extracted shifted-range/lock hooks rather than owning a separate state
 * machine.
 */
function handleBlockedForwardSlidingRebaseRecovery({
    scrollerElement,
    currentRangeKey,
    previousScrollTop,
    currentScrollTop,
    exactBottomScrollTop,
    ignoreNextEndReached,
    activeForwardSlidingRebaseRange,
    blockedForwardSlidingRebaseRange,
    blockedRecoverySettledRangeKey,
    blockedRecoverySettledScrollTop,
    blockedRecoveryAnchorKey,
    blockedRecoveryDesiredTopOffset,
    setForwardPaginationSlidingRebaseVirtuosoRestoreActive,
    setHandledForwardPaginationSlidingRebaseRange,
    setBlockedForwardPaginationSlidingRebaseRange,
    setActiveForwardPaginationSlidingRebaseScrollLocation,
    clearPendingVisibleRangeDuringForwardSlidingRebaseLock,
    cancelPendingForwardPaginationShiftedRangeRestore,
    cancelPendingForwardPaginationSlidingRebaseLock,
    armForwardPaginationSlidingRebaseLock,
    scheduleForwardPaginationShiftedRangeRestore,
}: {
    scrollerElement: HTMLElement;
    currentRangeKey: string;
    previousScrollTop: number | null;
    currentScrollTop: number;
    exactBottomScrollTop: number;
    ignoreNextEndReached: boolean;
    activeForwardSlidingRebaseRange: boolean;
    blockedForwardSlidingRebaseRange: boolean;
    blockedRecoverySettledRangeKey: string | null;
    blockedRecoverySettledScrollTop: number | null;
    blockedRecoveryAnchorKey: string | null;
    blockedRecoveryDesiredTopOffset: number | null;
    setForwardPaginationSlidingRebaseVirtuosoRestoreActive: (active: boolean) => void;
    setHandledForwardPaginationSlidingRebaseRange: (rangeKey: string | null) => void;
    setBlockedForwardPaginationSlidingRebaseRange: (rangeKey: string | null) => void;
    setActiveForwardPaginationSlidingRebaseScrollLocation: (scrollLocation: ScrollIntoViewLocation | null) => void;
    clearPendingVisibleRangeDuringForwardSlidingRebaseLock: () => void;
    cancelPendingForwardPaginationShiftedRangeRestore: () => void;
    cancelPendingForwardPaginationSlidingRebaseLock: () => void;
    armForwardPaginationSlidingRebaseLock: () => void;
    scheduleForwardPaginationShiftedRangeRestore: (
        targetScrollerElement: HTMLElement,
        options?: { skipInitialBlockedRebasePrime?: boolean },
    ) => void;
}): boolean {
    if (
        !(activeForwardSlidingRebaseRange || blockedForwardSlidingRebaseRange) ||
        previousScrollTop === null ||
        currentScrollTop - previousScrollTop <= 128 ||
        (exactBottomScrollTop - currentScrollTop > 96 && !ignoreNextEndReached)
    ) {
        return false;
    }

    if (activeForwardSlidingRebaseRange) {
        setForwardPaginationSlidingRebaseVirtuosoRestoreActive(false);
        setHandledForwardPaginationSlidingRebaseRange(null);
        setBlockedForwardPaginationSlidingRebaseRange(currentRangeKey);
        setActiveForwardPaginationSlidingRebaseScrollLocation(null);
    }

    const settledBlockedRecoveryScrollTop =
        blockedForwardSlidingRebaseRange &&
        blockedRecoverySettledRangeKey === currentRangeKey &&
        blockedRecoverySettledScrollTop !== null
            ? blockedRecoverySettledScrollTop
            : null;
    const blockedRecoveryAnchorElement =
        blockedRecoveryAnchorKey != null ? findTimelineItemElement(scrollerElement, blockedRecoveryAnchorKey) : null;

    if (settledBlockedRecoveryScrollTop !== null) {
        cancelPendingForwardPaginationShiftedRangeRestore();
        cancelPendingForwardPaginationSlidingRebaseLock();
        setForwardPaginationSlidingRebaseVirtuosoRestoreActive(false);
        clearPendingVisibleRangeDuringForwardSlidingRebaseLock();
        scrollerElement.scrollTo({
            top: settledBlockedRecoveryScrollTop,
        });
        return true;
    }

    if (blockedForwardSlidingRebaseRange && blockedRecoveryAnchorElement && blockedRecoveryDesiredTopOffset != null) {
        const currentTopOffset = getTopOffset(scrollerElement, blockedRecoveryAnchorElement);
        const scrollAdjustment = currentTopOffset - blockedRecoveryDesiredTopOffset;
        if (scrollAdjustment !== 0) {
            scrollerElement.scrollTo({
                top: scrollerElement.scrollTop + scrollAdjustment,
            });
        }
    } else {
        const shouldRevertForwardSlidingRebaseRecoveryToPreviousScrollTop =
            previousScrollTop < currentScrollTop &&
            (activeForwardSlidingRebaseRange || blockedForwardSlidingRebaseRange);
        const primeStepPx = Math.min(MAX_FORWARD_PAGINATION_ANCHOR_CORRECTION_STEP_PX, scrollerElement.clientHeight);
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
    return true;
}

/**
 * Applies the post-forward-pagination continuity strategy selected by the
 * presenter after a render completes.
 *
 * Depending on the captured continuity mode this schedules anchor restoration,
 * shifted-range restoration, or exact-bottom preservation, and it clears
 * pagination contexts once no further restore loop is active.
 */
function applyForwardPaginationCompletion({
    scrollerElement,
    currentRangeKey,
    windowShift,
    forwardPaginationCompleted,
    forwardPaginationAnchorIndex,
    shouldRestoreForwardPaginationAnchor,
    shouldApplyImmediateAtBottomForwardPaginationAnchorRestore,
    atBottomForwardPaginationAnchorKey,
    atBottomForwardPaginationDesiredBottomOffset,
    shouldRestoreForwardPaginationShiftedRange,
    shouldPreserveForwardPaginationBottom,
    backwardPaginationCompleted,
    hasBackwardPaginationAnchor,
    appendedWhileAtLiveEdge,
    hasHandledForwardSlidingRebaseRangeForCurrentRange,
    hasActiveForwardPaginationSlidingRebaseScrollLocation,
    isForwardPaginationAnchorCorrectionInProgress,
    isForwardPaginationShiftedRangeRestoreInProgress,
    armForwardPaginationSlidingRebaseLock,
    setForwardPaginationSlidingRebaseVirtuosoRestoreActive,
    cancelPendingForwardPaginationShiftedRangeRestore,
    setHandledForwardPaginationSlidingRebaseRange,
    scheduleForwardPaginationShiftedRangeVirtuosoFollowupCorrection,
    scheduleForwardPaginationShiftedRangeRestore,
    scheduleForwardPaginationAnchorCorrection,
    scheduleBackwardPaginationAnchorCorrection,
    scheduleLiveEdgeAppendCorrection,
    followOutputEnabled,
    deferForwardPaginationContextClear,
    clearForwardPaginationContext,
    clearBackwardPaginationContext,
}: {
    scrollerElement: HTMLElement | null;
    currentRangeKey: string;
    windowShift: number;
    forwardPaginationCompleted: boolean;
    shouldRestoreForwardPaginationAnchor: boolean;
    shouldApplyImmediateAtBottomForwardPaginationAnchorRestore: boolean;
    atBottomForwardPaginationAnchorKey: string | null;
    atBottomForwardPaginationDesiredBottomOffset: number | null;
    shouldRestoreForwardPaginationShiftedRange: boolean;
    shouldPreserveForwardPaginationBottom: boolean;
    backwardPaginationCompleted: boolean;
    hasBackwardPaginationAnchor: boolean;
    appendedWhileAtLiveEdge: boolean;
    hasHandledForwardSlidingRebaseRangeForCurrentRange: boolean;
    hasActiveForwardPaginationSlidingRebaseScrollLocation: boolean;
    isForwardPaginationAnchorCorrectionInProgress: boolean;
    isForwardPaginationShiftedRangeRestoreInProgress: boolean;
    armForwardPaginationSlidingRebaseLock: () => void;
    setForwardPaginationSlidingRebaseVirtuosoRestoreActive: (active: boolean) => void;
    cancelPendingForwardPaginationShiftedRangeRestore: () => void;
    setHandledForwardPaginationSlidingRebaseRange: (rangeKey: string | null) => void;
    scheduleForwardPaginationShiftedRangeVirtuosoFollowupCorrection: (targetScrollerElement: HTMLElement) => void;
    scheduleForwardPaginationShiftedRangeRestore: (
        targetScrollerElement: HTMLElement,
        options?: { skipInitialBlockedRebasePrime?: boolean },
    ) => void;
    scheduleForwardPaginationAnchorCorrection: (
        targetScrollerElement: HTMLElement,
        windowShift: number,
        forwardPaginationAnchorIndex: number | null,
    ) => void;
    scheduleBackwardPaginationAnchorCorrection: (targetScrollerElement: HTMLElement) => void;
    scheduleLiveEdgeAppendCorrection: (targetScrollerElement: HTMLElement) => void;
    followOutputEnabled: boolean;
    deferForwardPaginationContextClear: () => void;
    clearForwardPaginationContext: () => void;
    clearBackwardPaginationContext: () => void;
} & { forwardPaginationAnchorIndex: number | null }): void {
    if (shouldRestoreForwardPaginationAnchor && scrollerElement) {
        scheduleForwardPaginationAnchorCorrection(scrollerElement, windowShift, forwardPaginationAnchorIndex);
    }

    if (
        shouldApplyImmediateAtBottomForwardPaginationAnchorRestore &&
        scrollerElement &&
        atBottomForwardPaginationAnchorKey &&
        atBottomForwardPaginationDesiredBottomOffset != null
    ) {
        const applyImmediateAnchorCorrection = (): void => {
            if (!scrollerElement.isConnected) {
                return;
            }

            const anchorElement = findTimelineItemElement(scrollerElement, atBottomForwardPaginationAnchorKey);
            if (!anchorElement) {
                return;
            }

            const currentBottomOffset = getBottomOffset(scrollerElement, anchorElement);
            const scrollAdjustment = getForwardPaginationAnchorAdjustment({
                desiredBottomOffset: atBottomForwardPaginationDesiredBottomOffset,
                currentBottomOffset,
            });

            if (Math.abs(scrollAdjustment) > 1) {
                scrollerElement.scrollTo({
                    top: scrollerElement.scrollTop + scrollAdjustment,
                });
            }
        };

        applyImmediateAnchorCorrection();
    }

    if (shouldRestoreForwardPaginationShiftedRange) {
        if (!scrollerElement) {
            return;
        }
        if (windowShift < 0) {
            if (
                hasHandledForwardSlidingRebaseRangeForCurrentRange &&
                hasActiveForwardPaginationSlidingRebaseScrollLocation
            ) {
                armForwardPaginationSlidingRebaseLock();
                if (!isForwardPaginationShiftedRangeRestoreInProgress) {
                    scheduleForwardPaginationShiftedRangeVirtuosoFollowupCorrection(scrollerElement);
                }
                return;
            }
            armForwardPaginationSlidingRebaseLock();
            setForwardPaginationSlidingRebaseVirtuosoRestoreActive(false);
            cancelPendingForwardPaginationShiftedRangeRestore();
            setHandledForwardPaginationSlidingRebaseRange(null);
            scheduleForwardPaginationShiftedRangeRestore(scrollerElement);
            return;
        }
        setForwardPaginationSlidingRebaseVirtuosoRestoreActive(false);
        scheduleForwardPaginationShiftedRangeRestore(scrollerElement);
    }

    if (shouldPreserveForwardPaginationBottom && scrollerElement) {
        const exactBottomScrollTop = Math.max(0, scrollerElement.scrollHeight - scrollerElement.clientHeight);
        scrollerElement.scrollTo({
            top: exactBottomScrollTop,
        });
        window.requestAnimationFrame(() => {
            if (!scrollerElement.isConnected) {
                return;
            }
            const latestExactBottomScrollTop = Math.max(0, scrollerElement.scrollHeight - scrollerElement.clientHeight);
            if (scrollerElement.scrollTop < latestExactBottomScrollTop) {
                scrollerElement.scrollTo({
                    top: latestExactBottomScrollTop,
                });
            }
        });
    }

    if (backwardPaginationCompleted && scrollerElement && hasBackwardPaginationAnchor) {
        scheduleBackwardPaginationAnchorCorrection(scrollerElement);
    }

    if (appendedWhileAtLiveEdge && scrollerElement && followOutputEnabled) {
        const exactBottomScrollTop = Math.max(0, scrollerElement.scrollHeight - scrollerElement.clientHeight);
        scrollerElement.scrollTo({
            top: exactBottomScrollTop,
        });
        scheduleLiveEdgeAppendCorrection(scrollerElement);
    }

    if (
        forwardPaginationCompleted &&
        !isForwardPaginationAnchorCorrectionInProgress &&
        !isForwardPaginationShiftedRangeRestoreInProgress
    ) {
        deferForwardPaginationContextClear();
    }
    if (backwardPaginationCompleted && !hasBackwardPaginationAnchor) {
        clearBackwardPaginationContext();
    }
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
    const lastForwardRequestedTailKeyRef = useRef<string | null>(null);
    const wasAtBottomRef = useRef(false);
    const pendingForwardPaginationAfterInitialFillRef = useRef(false);
    const ignoreNextEndReachedRef = useRef(false);
    const ignoreNextStartReachedRef = useRef(false);
    const ignoreNextTopScrollPaginationRef = useRef(false);
    const scrollGestureGenerationRef = useRef(0);
    const lastUserScrollTimestampRef = useRef<number | null>(null);
    const lastBottomTriggeredForwardPaginationGestureRef = useRef<number | null>(null);
    const suppressBottomReassertAfterBottomTriggeredForwardPaginationRef = useRef(false);
    const pendingForwardPaginationContextClearRef = useRef(false);
    const scrollTargetCorrectionGenerationRef = useRef(0);
    const expectedProgrammaticTargetScrollTopRef = useRef<number | null>(null);
    const initialAnchorResolvedRef = useRef(false);
    const suppressForwardPaginationUntilUserScrollAfterAnchorRef = useRef(false);
    const suppressForwardLiveEdgeSeekAfterAnchorRef = useRef(false);
    const anchorResolutionRetryCountRef = useRef(0);
    const lastScrollTopRef = useRef<number | null>(null);
    const backwardPaginationAnchorCorrectionFrameIdsRef = useRef<number[]>([]);
    const backwardPaginationAnchorCorrectionInProgressRef = useRef(false);
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
    const suppressPostInitialFillBottomSnapRef = useRef(false);
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

    const {
        cancelPendingForwardPaginationSlidingRebaseLock,
        armForwardPaginationSlidingRebaseLock,
        isForwardPaginationSlidingRebaseLockActive,
        isForwardPaginationSlidingRebaseVirtuosoRestoreActive,
        setForwardPaginationSlidingRebaseVirtuosoRestoreActive,
        setPendingVisibleRangeDuringForwardSlidingRebaseLock,
        clearPendingVisibleRangeDuringForwardSlidingRebaseLock,
    } = useTimelineForwardSlidingRebaseLock({
        onVisibleRangeChanged: (visibleRange) => vm.onVisibleRangeChanged(visibleRange),
    });

    const cancelPendingBackwardPaginationAnchorCorrection = useCallback(() => {
        for (const frameId of backwardPaginationAnchorCorrectionFrameIdsRef.current) {
            window.cancelAnimationFrame(frameId);
        }
        backwardPaginationAnchorCorrectionFrameIdsRef.current = [];
        backwardPaginationAnchorCorrectionInProgressRef.current = false;
    }, []);

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

    const markAnchorResolved = useCallback(() => {
        const currentTargetKey = snapshot.scrollTarget?.targetKey ?? null;
        if (currentTargetKey !== null && acknowledgedScrollTargetKeyRef.current === currentTargetKey) {
            logTimelineViewPresenter(
                "markAnchorResolved:skip-acknowledged",
                "targetKey",
                currentTargetKey,
                "initialFillState",
                initialFillState,
            );
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
        lastAnchoredKeyRef.current = currentTargetKey;
        acknowledgedScrollTargetKeyRef.current = currentTargetKey;
        logTimelineViewPresenter(
            "markAnchorResolved",
            "targetKey",
            currentTargetKey,
            "initialFillState",
            initialFillState,
            "initialAnchorResolved",
            initialAnchorResolvedRef.current,
            "suppressForwardPaginationUntilUserScrollAfterAnchor",
            suppressForwardPaginationUntilUserScrollAfterAnchorRef.current,
            "suppressForwardLiveEdgeSeekAfterAnchor",
            suppressForwardLiveEdgeSeekAfterAnchorRef.current,
        );
        vm.onScrollTargetReached();
    }, [initialFillState, snapshot.scrollTarget, vm]);

    const prepareBackwardAnchorFetch = useCallback(() => {
        ignoreNextStartReachedRef.current = true;
        ignoreNextTopScrollPaginationRef.current = true;
    }, []);

    const getScrollTargetCorrectionGeneration = useCallback(() => {
        return scrollTargetCorrectionGenerationRef.current;
    }, []);

    const advanceScrollTargetCorrectionGeneration = useCallback(() => {
        scrollTargetCorrectionGenerationRef.current += 1;
        return scrollTargetCorrectionGenerationRef.current;
    }, []);

    const noteProgrammaticTargetScrollTop = useCallback((scrollTop: number) => {
        expectedProgrammaticTargetScrollTopRef.current = scrollTop;
    }, []);

    const resetAnchorResolutionRetryCount = useCallback(() => {
        anchorResolutionRetryCountRef.current = 0;
    }, []);

    const getAnchorResolutionRetryCount = useCallback(() => {
        return anchorResolutionRetryCountRef.current;
    }, []);

    const incrementAnchorResolutionRetryCount = useCallback(() => {
        anchorResolutionRetryCountRef.current += 1;
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

    const {
        cancelPendingInitialLiveEdgeSettleCorrection,
        scheduleInitialLiveEdgeSettleCorrection,
        scheduleLiveEdgeAppendCorrection,
        isLiveEdgeAppendCorrectionInProgress,
    } = useTimelineLiveEdge({
        initialFillState,
        scrollerElement,
        isAtLiveEdge: snapshot.isAtLiveEdge,
        canPaginateForward: snapshot.canPaginateForward,
        hasScrollTarget: !!snapshot.scrollTarget,
        followOutputEnabled,
        setInitialFillState,
    });

    const getLastVisibleRange = useCallback(() => {
        return lastVisibleRangeRef.current;
    }, []);

    const getLastForwardRequestedTailKey = useCallback(() => {
        return lastForwardRequestedTailKeyRef.current;
    }, []);

    const setLastForwardRequestedTailKey = useCallback((tailKey: string | null) => {
        lastForwardRequestedTailKeyRef.current = tailKey;
    }, []);

    const getForwardPaginationContext = useCallback(() => {
        return forwardPaginationContextRef.current;
    }, []);

    const setForwardPaginationContext = useCallback((context: ForwardPaginationContext | null) => {
        forwardPaginationContextRef.current = context;
    }, []);

    const getCurrentRangeKey = useCallback(() => {
        return summarizeTimelineItems(snapshot.items);
    }, [snapshot.items]);

    const getBlockedForwardPaginationSlidingRebaseRange = useCallback(() => {
        return blockedForwardPaginationSlidingRebaseRangeRef.current;
    }, []);

    const setHandledForwardPaginationSlidingRebaseRange = useCallback((rangeKey: string | null) => {
        handledForwardPaginationSlidingRebaseRangeRef.current = rangeKey;
    }, []);

    const setBlockedForwardPaginationSlidingRebaseSettledScrollState = useCallback(
        (state: { rangeKey: string | null; scrollTop: number | null }) => {
            blockedForwardPaginationSlidingRebaseSettledScrollStateRef.current = state;
        },
        [],
    );

    const {
        cancelPendingForwardPaginationShiftedRangeRestore,
        scheduleForwardPaginationShiftedRangeVirtuosoFollowupCorrection,
        scheduleForwardPaginationShiftedRangeRestore,
        isForwardPaginationShiftedRangeRestoreInProgress,
    } = useTimelineForwardPaginationShiftedRangeRestore({
        getForwardPaginationContext,
        getCurrentRangeKey,
        getBlockedForwardPaginationSlidingRebaseRange,
        setHandledForwardPaginationSlidingRebaseRange,
        setBlockedForwardPaginationSlidingRebaseSettledScrollState,
        armForwardPaginationSlidingRebaseLock,
        cancelPendingForwardPaginationSlidingRebaseLock,
        isForwardPaginationSlidingRebaseVirtuosoRestoreActive,
        clearPendingVisibleRangeDuringForwardSlidingRebaseLock,
    });

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
        expectedProgrammaticTargetScrollTopRef.current = null;
        pendingForwardPaginationContextClearRef.current = false;
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
        if (!snapshot.scrollTarget) {
            acknowledgedScrollTargetKeyRef.current = null;
            expectedProgrammaticTargetScrollTopRef.current = null;
        }
    }, [snapshot.scrollTarget]);

    useEffect(() => {
        if (snapshot.isAtLiveEdge) {
            suppressForwardLiveEdgeSeekAfterAnchorRef.current = false;
        }
    }, [snapshot.isAtLiveEdge]);

    useEffect(() => {
        return () => {
            cancelPendingBackwardPaginationAnchorCorrection();
            cancelPendingForwardPaginationShiftedRangeRestore();
            cancelPendingForwardPaginationSlidingRebaseLock();
        };
    }, [
        cancelPendingBackwardPaginationAnchorCorrection,
        cancelPendingForwardPaginationSlidingRebaseLock,
        cancelPendingForwardPaginationShiftedRangeRestore,
    ]);

    useEffect(() => {
        if (initialFillState !== "filling") {
            return;
        }

        setFollowOutputEnabled(snapshot.isAtLiveEdge);
    }, [initialFillState, snapshot.isAtLiveEdge]);

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
        logTimelineViewPresenter(
            "initialFill:complete-after-anchor",
            "itemCount",
            snapshot.items.length,
            "isAtLiveEdge",
            snapshot.isAtLiveEdge,
            "firstItemIndex",
            firstItemIndex,
        );
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

    const getLastBottomTriggeredForwardPaginationGesture = useCallback(() => {
        return lastBottomTriggeredForwardPaginationGestureRef.current;
    }, []);

    const getScrollGestureGeneration = useCallback(() => {
        return scrollGestureGenerationRef.current;
    }, []);

    const setWasAtBottom = useCallback((wasAtBottom: boolean) => {
        wasAtBottomRef.current = wasAtBottom;
    }, []);

    const { requestForwardPagination } = useTimelineForwardPagination({
        items: snapshot.items,
        initialFillState,
        scrollerElement,
        isAtLiveEdge: snapshot.isAtLiveEdge,
        canPaginateForward: snapshot.canPaginateForward,
        forwardPagination: snapshot.forwardPagination,
        hasScrollTarget: !!snapshot.scrollTarget,
        followOutputEnabled,
        suppressForwardLiveEdgeSeekAfterAnchor: suppressForwardLiveEdgeSeekAfterAnchorRef.current,
        wasAtBottom: wasAtBottomRef.current,
        getLastVisibleRange,
        getLastForwardRequestedTailKey,
        setLastForwardRequestedTailKey,
        getForwardPaginationContext,
        setForwardPaginationContext,
        getLastBottomTriggeredForwardPaginationGesture,
        getScrollGestureGeneration,
        setWasAtBottom,
        onRequestMoreItems: () => vm.onRequestMoreItems("forward"),
    });

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

    const { scheduleForwardPaginationAnchorCorrection, isForwardPaginationAnchorCorrectionInProgress } =
        useTimelineForwardPaginationAnchorRestore({
            getForwardPaginationContext,
            setForwardPaginationContext,
        });

    useLayoutEffect(() => {
        if (
            !scrollerElement ||
            !snapshot.isAtLiveEdge ||
            snapshot.canPaginateForward ||
            snapshot.scrollTarget ||
            !followOutputEnabled
        ) {
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
    }, [
        followOutputEnabled,
        scrollerElement,
        snapshot.canPaginateForward,
        snapshot.isAtLiveEdge,
        snapshot.scrollTarget,
        snapshot.items,
    ]);

    useTimelineAnchorResolution({
        vm,
        snapshot,
        initialFillState,
        scrollerElement,
        acknowledgedScrollTargetKeyRef,
        getScrollTargetCorrectionGeneration,
        advanceScrollTargetCorrectionGeneration,
        resetAnchorResolutionRetryCount,
        getAnchorResolutionRetryCount,
        incrementAnchorResolutionRetryCount,
        anchorResolutionRetryNonce,
        setAnchorResolutionRetryNonce,
        markAnchorResolved,
        prepareBackwardAnchorFetch,
        noteProgrammaticTargetScrollTop,
    });

    const handleRangeChanged = useCallback(
        (range: ListRange) => {
            logTimelineViewPresenter(
                "rangeChanged",
                "rawStart",
                range.startIndex,
                "rawEnd",
                range.endIndex,
                "rawStartKey",
                snapshot.items[range.startIndex]?.key ?? null,
                "rawEndKey",
                snapshot.items[range.endIndex]?.key ?? null,
                "previousVisibleStart",
                lastVisibleRangeRef.current?.startIndex ?? null,
                "previousVisibleEnd",
                lastVisibleRangeRef.current?.endIndex ?? null,
            );
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
                    isForwardPaginationSlidingRebaseLockActive();
                if (shouldSuppressBlockedForwardSlidingRebaseTailVisibleRangeRebound) {
                    return;
                }
                lastVisibleRangeRef.current = visibleRange;
                if (suppressVisibleRangeCallbackForForwardSlidingRebaseLock) {
                    setPendingVisibleRangeDuringForwardSlidingRebaseLock(visibleRange);
                } else {
                    vm.onVisibleRangeChanged(visibleRange);
                }

                if (
                    scrollerElement &&
                    (isForwardPaginationSlidingRebaseLockActive() || isForwardPaginationShiftedRangeRestoreInProgress())
                ) {
                    if (isForwardPaginationSlidingRebaseLockActive()) {
                        armForwardPaginationSlidingRebaseLock();
                    }
                    if (
                        !isForwardPaginationSlidingRebaseVirtuosoRestoreActive() &&
                        !isForwardPaginationShiftedRangeRestoreInProgress()
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
            isForwardPaginationSlidingRebaseLockActive,
            isForwardPaginationSlidingRebaseVirtuosoRestoreActive,
            isForwardPaginationShiftedRangeRestoreInProgress,
            vm,
            initialFillState,
            scrollerElement,
            scheduleForwardPaginationShiftedRangeRestore,
            setPendingVisibleRangeDuringForwardSlidingRebaseLock,
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
            const remainingToExactBottom =
                scrollerElement !== null
                    ? Math.max(
                          0,
                          scrollerElement.scrollHeight - scrollerElement.clientHeight - scrollerElement.scrollTop,
                      )
                    : null;
            const normalizedAtBottom =
                atBottom &&
                (remainingToExactBottom !== null ? remainingToExactBottom <= VIRTUOSO_AT_BOTTOM_THRESHOLD_PX : true);
            const shouldSuppressBottomReassertAfterBottomTriggeredForwardPagination =
                suppressBottomReassertAfterBottomTriggeredForwardPaginationRef.current &&
                normalizedAtBottom &&
                snapshot.canPaginateForward &&
                !snapshot.scrollTarget;

            if (shouldSuppressBottomReassertAfterBottomTriggeredForwardPagination) {
                wasAtBottomRef.current = false;
                logTimelineViewPresenter(
                    "atBottomStateChange:suppress-bottom-reassert-after-forward-pagination",
                    "remainingToExactBottom",
                    remainingToExactBottom,
                    "canPaginateForward",
                    snapshot.canPaginateForward,
                );
                return;
            }

            if (suppressBottomReassertAfterBottomTriggeredForwardPaginationRef.current && !normalizedAtBottom) {
                suppressBottomReassertAfterBottomTriggeredForwardPaginationRef.current = false;
            }

            const transitionedToBottom = normalizedAtBottom && !wasAtBottomRef.current;
            wasAtBottomRef.current = normalizedAtBottom;

            const computedIsAtLiveEdge = getIsAtLiveEdgeFromBottomState({
                atBottom: normalizedAtBottom,
                canPaginateForward: snapshot.canPaginateForward,
            });
            const shouldPreserveLiveEdgeDuringCorrection =
                !normalizedAtBottom &&
                snapshot.isAtLiveEdge &&
                !snapshot.scrollTarget &&
                !snapshot.canPaginateForward &&
                remainingToExactBottom !== null &&
                remainingToExactBottom <= LIVE_EDGE_RECOVERY_EPSILON_PX;
            const nextIsAtLiveEdge = shouldPreserveLiveEdgeDuringCorrection ? true : computedIsAtLiveEdge;
            const shouldAutoReenableFollowOutput =
                !snapshot.canPaginateForward &&
                lastBottomTriggeredForwardPaginationGestureRef.current !== scrollGestureGenerationRef.current &&
                !suppressForwardPaginationUntilUserScrollAfterAnchorRef.current &&
                !suppressForwardLiveEdgeSeekAfterAnchorRef.current;

            logTimelineViewPresenter(
                "atBottomStateChange",
                "atBottom",
                atBottom,
                "normalizedAtBottom",
                normalizedAtBottom,
                "remainingToExactBottom",
                remainingToExactBottom,
                "snapshotIsAtLiveEdge",
                snapshot.isAtLiveEdge,
                "nextIsAtLiveEdge",
                nextIsAtLiveEdge,
                "followOutputEnabled",
                followOutputEnabled,
                "suppressForwardPaginationUntilUserScrollAfterAnchor",
                suppressForwardPaginationUntilUserScrollAfterAnchorRef.current,
                "suppressForwardLiveEdgeSeekAfterAnchor",
                suppressForwardLiveEdgeSeekAfterAnchorRef.current,
                "canPaginateForward",
                snapshot.canPaginateForward,
            );

            if (
                shouldIgnoreAtBottomStateChange({
                    initialFillState,
                    hasScrollTarget: !!snapshot.scrollTarget,
                })
            ) {
                return;
            }

            if (isForwardPaginationShiftedRangeRestoreInProgress()) {
                return;
            }

            if (isForwardPaginationSlidingRebaseLockActive()) {
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
                lastBottomTriggeredForwardPaginationGestureRef.current !== scrollGestureGenerationRef.current &&
                !suppressForwardPaginationUntilUserScrollAfterAnchorRef.current &&
                !snapshot.scrollTarget &&
                !!scrollerElement &&
                scrollerElement.clientHeight > 0;

            if (shouldRequestForwardPagination) {
                lastBottomTriggeredForwardPaginationGestureRef.current = scrollGestureGenerationRef.current;
                requestForwardPagination("at-bottom state change");
            }

            vm.onIsAtLiveEdgeChanged(nextIsAtLiveEdge);
        },
        [
            initialFillState,
            requestForwardPagination,
            scheduleLiveEdgeAppendCorrection,
            isForwardPaginationSlidingRebaseLockActive,
            isForwardPaginationShiftedRangeRestoreInProgress,
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

    const followOutput = useCallback((isAtBottom: boolean): "auto" | false => {
        return false;
    }, []);

    const scrollIntoViewOnChange = useCallback<ScrollIntoViewOnChange<TItem, undefined>>(
        ({ totalCount }): ScrollIntoViewLocation | null | undefined | false => {
            const previousRenderState = previousRenderStateRef.current;
            const windowShift = getContiguousWindowShift(previousRenderState.items, snapshot.items);
            const lastVisibleRange = lastVisibleRangeRef.current;
            const currentRangeKey = summarizeTimelineItems(snapshot.items);
            logTimelineViewPresenter(
                "scrollIntoViewOnChange:windowShift",
                "previousRangeKey",
                summarizeTimelineItems(previousRenderState.items),
                "currentRangeKey",
                currentRangeKey,
                "windowShift",
                windowShift,
                "continuityMode",
                forwardPaginationContextRef.current?.continuityMode ?? null,
                "requestReason",
                forwardPaginationContextRef.current?.requestReason ?? null,
                "lastVisibleRangeStart",
                lastVisibleRange?.startIndex ?? null,
                "lastVisibleRangeEnd",
                lastVisibleRange?.endIndex ?? null,
            );
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
                allowReplayPendingAnchor:
                    initialFillState === "filling" &&
                    snapshot.scrollTarget !== null &&
                    acknowledgedScrollTargetKeyRef.current !== snapshot.scrollTarget.targetKey,
                initialBottomSnapDone: initialBottomSnapDoneRef.current,
            });
            const mappedScrollLocation =
                scrollLocation && "index" in scrollLocation
                    ? {
                          ...scrollLocation,
                          index: firstItemIndex + scrollLocation.index,
                      }
                    : scrollLocation;
            logTimelineViewPresenter(
                "scrollIntoViewOnChange",
                "totalCount",
                totalCount,
                "targetKey",
                snapshot.scrollTarget?.targetKey ?? null,
                "isAtLiveEdge",
                snapshot.isAtLiveEdge,
                "lastAnchoredKey",
                lastAnchoredKeyRef.current,
                "mappedIndex",
                mappedScrollLocation && "index" in mappedScrollLocation ? mappedScrollLocation.index : null,
                "mappedAlign",
                mappedScrollLocation && "align" in mappedScrollLocation ? mappedScrollLocation.align : null,
            );
            const activeForwardSlidingRebaseScrollLocation =
                activeForwardPaginationSlidingRebaseScrollLocationRef.current;
            const shouldBypassForwardSlidingRebaseVirtuosoLocation =
                forwardPaginationContextRef.current?.requestReason === "at-bottom state change";

            if (
                handledForwardPaginationSlidingRebaseRangeRef.current === currentRangeKey &&
                activeForwardSlidingRebaseScrollLocation &&
                !snapshot.scrollTarget &&
                forwardPaginationContextRef.current?.continuityMode === "shifted-range" &&
                !shouldBypassForwardSlidingRebaseVirtuosoLocation
            ) {
                setForwardPaginationSlidingRebaseVirtuosoRestoreActive(true);
                suppressNextProgrammaticCallbacks();
                return activeForwardSlidingRebaseScrollLocation;
            }

            const shouldUseForwardSlidingRebaseLocationForCurrentRange = shouldUseForwardSlidingRebaseLocation({
                previousForwardPagination: previousRenderState.forwardPagination,
                forwardPagination: snapshot.forwardPagination,
                continuityMode:
                    forwardPaginationContextRef.current?.continuityMode === "none"
                        ? null
                        : (forwardPaginationContextRef.current?.continuityMode ?? null),
                windowShift,
                hasShiftedVisibleRange: shiftedVisibleRange !== null,
                currentRangeKey,
                blockedRangeKey: blockedForwardPaginationSlidingRebaseRangeRef.current,
                handledRangeKey: handledForwardPaginationSlidingRebaseRangeRef.current,
            });
            logTimelineViewPresenter(
                "scrollIntoViewOnChange:shiftedRangeDecision",
                "shouldUseForwardSlidingRebaseLocationForCurrentRange",
                shouldUseForwardSlidingRebaseLocationForCurrentRange,
                "handledRangeMatchesCurrent",
                handledForwardPaginationSlidingRebaseRangeRef.current === currentRangeKey,
                "blockedRangeMatchesCurrent",
                blockedForwardPaginationSlidingRebaseRangeRef.current === currentRangeKey,
                "hasActiveForwardSlidingRebaseScrollLocation",
                activeForwardSlidingRebaseScrollLocation !== null,
                "shiftedVisibleRangeStart",
                shiftedVisibleRange?.startIndex ?? null,
                "shiftedVisibleRangeEnd",
                shiftedVisibleRange?.endIndex ?? null,
                "windowShift",
                windowShift,
                "currentRangeKey",
                currentRangeKey,
            );

            if (shouldUseForwardSlidingRebaseLocationForCurrentRange && shiftedVisibleRange !== null) {
                if (shouldBypassForwardSlidingRebaseVirtuosoLocation) {
                    handledForwardPaginationSlidingRebaseRangeRef.current = null;
                    activeForwardPaginationSlidingRebaseScrollLocationRef.current = null;
                    setForwardPaginationSlidingRebaseVirtuosoRestoreActive(false);
                    return false;
                }
                const forwardSlidingRebaseScrollLocation: ScrollIntoViewLocation = {
                    align: "start",
                    behavior: "auto",
                    index: firstItemIndex + shiftedVisibleRange.startIndex,
                };
                handledForwardPaginationSlidingRebaseRangeRef.current = currentRangeKey;
                activeForwardPaginationSlidingRebaseScrollLocationRef.current = forwardSlidingRebaseScrollLocation;
                setForwardPaginationSlidingRebaseVirtuosoRestoreActive(true);
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
            initialFillState,
            snapshot.items,
            snapshot.scrollTarget,
            setForwardPaginationSlidingRebaseVirtuosoRestoreActive,
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
            const isClearlyAwayFromBottom = currentScrollTop < exactBottomScrollTop - VIRTUOSO_AT_BOTTOM_THRESHOLD_PX;
            const activeForwardSlidingRebaseRange =
                handledForwardPaginationSlidingRebaseRangeRef.current === currentRangeKey &&
                !!activeForwardPaginationSlidingRebaseScrollLocationRef.current &&
                forwardPaginationContextRef.current?.continuityMode === "shifted-range" &&
                !latest.hasScrollTarget;
            const blockedForwardSlidingRebaseRange =
                blockedForwardPaginationSlidingRebaseRangeRef.current === currentRangeKey &&
                forwardPaginationContextRef.current?.continuityMode === "shifted-range" &&
                !latest.hasScrollTarget;

            if (isClearlyAwayFromBottom && wasAtBottomRef.current) {
                wasAtBottomRef.current = false;
            }

            const blockedRecoveryHandled = handleBlockedForwardSlidingRebaseRecovery({
                scrollerElement,
                currentRangeKey,
                previousScrollTop,
                currentScrollTop,
                exactBottomScrollTop,
                ignoreNextEndReached: ignoreNextEndReachedRef.current,
                activeForwardSlidingRebaseRange,
                blockedForwardSlidingRebaseRange,
                blockedRecoverySettledRangeKey:
                    blockedForwardPaginationSlidingRebaseSettledScrollStateRef.current.rangeKey,
                blockedRecoverySettledScrollTop:
                    blockedForwardPaginationSlidingRebaseSettledScrollStateRef.current.scrollTop,
                blockedRecoveryAnchorKey: forwardPaginationContextRef.current?.shiftedRangeAnchorKey ?? null,
                blockedRecoveryDesiredTopOffset: forwardPaginationContextRef.current?.shiftedRangeTopOffsetPx ?? null,
                setForwardPaginationSlidingRebaseVirtuosoRestoreActive,
                setHandledForwardPaginationSlidingRebaseRange: (rangeKey) => {
                    handledForwardPaginationSlidingRebaseRangeRef.current = rangeKey;
                },
                setBlockedForwardPaginationSlidingRebaseRange: (rangeKey) => {
                    blockedForwardPaginationSlidingRebaseRangeRef.current = rangeKey;
                },
                setActiveForwardPaginationSlidingRebaseScrollLocation: (scrollLocation) => {
                    activeForwardPaginationSlidingRebaseScrollLocationRef.current = scrollLocation;
                },
                clearPendingVisibleRangeDuringForwardSlidingRebaseLock,
                cancelPendingForwardPaginationShiftedRangeRestore,
                cancelPendingForwardPaginationSlidingRebaseLock,
                armForwardPaginationSlidingRebaseLock,
                scheduleForwardPaginationShiftedRangeRestore,
            });
            if (blockedRecoveryHandled) {
                return;
            }

            if (isForwardPaginationShiftedRangeRestoreInProgress()) {
                return;
            }

            if (isForwardPaginationSlidingRebaseLockActive()) {
                if (
                    !isForwardPaginationSlidingRebaseVirtuosoRestoreActive() &&
                    !isForwardPaginationShiftedRangeRestoreInProgress()
                ) {
                    scheduleForwardPaginationShiftedRangeRestore(scrollerElement);
                }
                return;
            }

            if (
                latest.initialFillState === "filling" &&
                upwardDelta !== null &&
                upwardDelta > FOLLOW_OUTPUT_DISABLE_SCROLL_EPSILON_PX &&
                !isLiveEdgeAppendCorrectionInProgress()
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
                !isLiveEdgeAppendCorrectionInProgress() &&
                !snapCandidate;

            if (shouldDisableFollowOutput) {
                setFollowOutputEnabled(false);
            }

            const expectedProgrammaticTargetScrollTop = latest.hasScrollTarget
                ? expectedProgrammaticTargetScrollTopRef.current
                : null;
            const hasMeaningfulScrollDelta =
                previousScrollTop !== null &&
                Math.abs(currentScrollTop - previousScrollTop) > FOLLOW_OUTPUT_DISABLE_SCROLL_EPSILON_PX;
            const matchesExpectedProgrammaticTargetScroll =
                expectedProgrammaticTargetScrollTop !== null &&
                Math.abs(currentScrollTop - expectedProgrammaticTargetScrollTop) <=
                    FOLLOW_OUTPUT_DISABLE_SCROLL_EPSILON_PX;
            if (
                expectedProgrammaticTargetScrollTop !== null &&
                (matchesExpectedProgrammaticTargetScroll || hasMeaningfulScrollDelta)
            ) {
                expectedProgrammaticTargetScrollTopRef.current = null;
            }

            const isLikelyUserScroll =
                hasMeaningfulScrollDelta &&
                !isLiveEdgeAppendCorrectionInProgress() &&
                !matchesExpectedProgrammaticTargetScroll;

            logTimelineViewPresenter(
                "scroll",
                "currentScrollTop",
                currentScrollTop,
                "previousScrollTop",
                previousScrollTop,
                "upwardDelta",
                upwardDelta,
                "snapCandidate",
                snapCandidate,
                "isLikelyUserScroll",
                isLikelyUserScroll,
                "followOutputEnabled",
                followOutputEnabled,
                "snapshotIsAtLiveEdge",
                snapshot.isAtLiveEdge,
                "hasScrollTarget",
                latest.hasScrollTarget,
                "suppressForwardPaginationUntilUserScrollAfterAnchor",
                suppressForwardPaginationUntilUserScrollAfterAnchorRef.current,
                "suppressForwardLiveEdgeSeekAfterAnchor",
                suppressForwardLiveEdgeSeekAfterAnchorRef.current,
                "liveEdgeAppendCorrectionInProgress",
                isLiveEdgeAppendCorrectionInProgress(),
            );

            if (isLikelyUserScroll) {
                if (latest.hasScrollTarget && latest.initialFillState !== "filling") {
                    advanceScrollTargetCorrectionGeneration();
                    logTimelineViewPresenter(
                        "scroll:abandonPendingTargetOnUserScroll",
                        "targetKey",
                        snapshot.scrollTarget?.targetKey ?? null,
                        "currentScrollTop",
                        currentScrollTop,
                        "previousScrollTop",
                        previousScrollTop,
                    );
                    markAnchorResolved();
                }

                const now = performance.now();
                if (
                    lastUserScrollTimestampRef.current === null ||
                    now - lastUserScrollTimestampRef.current > USER_SCROLL_GESTURE_IDLE_GAP_MS
                ) {
                    scrollGestureGenerationRef.current += 1;
                }
                lastUserScrollTimestampRef.current = now;
            }

            if (
                activeForwardSlidingRebaseRange &&
                isLikelyUserScroll &&
                !isForwardPaginationSlidingRebaseLockActive()
            ) {
                handledForwardPaginationSlidingRebaseRangeRef.current = null;
                activeForwardPaginationSlidingRebaseScrollLocationRef.current = null;
            }
            if (
                blockedForwardSlidingRebaseRange &&
                isLikelyUserScroll &&
                !isForwardPaginationSlidingRebaseLockActive() &&
                !isForwardPaginationShiftedRangeRestoreInProgress() &&
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
                logTimelineViewPresenter(
                    "scroll:clear-anchor-suppression",
                    "currentScrollTop",
                    currentScrollTop,
                    "previousScrollTop",
                    previousScrollTop,
                );
                suppressForwardPaginationUntilUserScrollAfterAnchorRef.current = false;
                suppressForwardLiveEdgeSeekAfterAnchorRef.current = false;
            }

            if (previousScrollTop !== null && currentScrollTop > previousScrollTop && snapCandidate) {
                const shouldAutoReenableFollowOutput =
                    !snapshot.canPaginateForward &&
                    lastBottomTriggeredForwardPaginationGestureRef.current !== scrollGestureGenerationRef.current &&
                    !suppressForwardPaginationUntilUserScrollAfterAnchorRef.current &&
                    !suppressForwardLiveEdgeSeekAfterAnchorRef.current;
                const shouldSnapToExactBottom =
                    !snapshot.canPaginateForward &&
                    lastBottomTriggeredForwardPaginationGestureRef.current !== scrollGestureGenerationRef.current &&
                    !isForwardPaginationAnchorCorrectionInProgress() &&
                    !isForwardPaginationShiftedRangeRestoreInProgress() &&
                    !blockedForwardSlidingRebaseRange;
                if (!followOutputEnabled && shouldAutoReenableFollowOutput) {
                    setFollowOutputEnabled(true);
                }
                if (shouldSnapToExactBottom) {
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
        advanceScrollTargetCorrectionGeneration,
        firstItemIndex,
        armForwardPaginationSlidingRebaseLock,
        cancelPendingForwardPaginationShiftedRangeRestore,
        cancelPendingForwardPaginationSlidingRebaseLock,
        clearPendingVisibleRangeDuringForwardSlidingRebaseLock,
        followOutputEnabled,
        isForwardPaginationAnchorCorrectionInProgress,
        isForwardPaginationSlidingRebaseLockActive,
        isForwardPaginationSlidingRebaseVirtuosoRestoreActive,
        isForwardPaginationShiftedRangeRestoreInProgress,
        isLiveEdgeAppendCorrectionInProgress,
        markAnchorResolved,
        scrollerElement,
        scheduleForwardPaginationShiftedRangeRestore,
        setForwardPaginationSlidingRebaseVirtuosoRestoreActive,
        snapshot.canPaginateForward,
        snapshot.isAtLiveEdge,
        snapshot.items,
        snapshot.scrollTarget?.targetKey,
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
        logTimelineViewPresenter(
            "forwardCompletion:windowShift",
            "previousRangeKey",
            summarizeTimelineItems(previousRenderState.items),
            "currentRangeKey",
            currentRangeKey,
            "previousFirstKey",
            previousRenderState.items[0]?.key ?? null,
            "previousLastKey",
            previousRenderState.items.at(-1)?.key ?? null,
            "currentFirstKey",
            snapshot.items[0]?.key ?? null,
            "currentLastKey",
            snapshot.items.at(-1)?.key ?? null,
            "windowShift",
            windowShift,
            "continuityMode",
            forwardPaginationContextRef.current?.continuityMode ?? null,
            "requestReason",
            forwardPaginationContextRef.current?.requestReason ?? null,
            "lastVisibleRangeStart",
            lastVisibleRangeRef.current?.startIndex ?? null,
            "lastVisibleRangeEnd",
            lastVisibleRangeRef.current?.endIndex ?? null,
        );
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
            !!scrollerElement &&
            forwardPaginationContextRef.current?.continuityMode === "anchor" &&
            forwardPaginationContextRef.current?.requestReason !== "at-bottom state change" &&
            forwardPaginationContextRef.current?.anchorKey != null &&
            forwardPaginationContextRef.current.bottomOffsetPx !== null;
        const shouldApplyImmediateAtBottomForwardPaginationAnchorRestore =
            forwardPaginationCompleted &&
            !!scrollerElement &&
            forwardPaginationContextRef.current?.continuityMode === "anchor" &&
            forwardPaginationContextRef.current?.requestReason === "at-bottom state change" &&
            forwardPaginationContextRef.current?.anchorKey != null &&
            forwardPaginationContextRef.current.bottomOffsetPx !== null;
        const shouldRestoreForwardPaginationShiftedRange =
            forwardPaginationCompleted &&
            forwardPaginationContextRef.current?.continuityMode === "shifted-range" &&
            shiftedVisibleRange !== null;
        const shouldPreserveForwardPaginationBottom =
            forwardPaginationCompleted &&
            !!scrollerElement &&
            forwardPaginationContextRef.current?.continuityMode === "bottom";
        const hasPendingDeferredForwardPaginationContextClear = pendingForwardPaginationContextClearRef.current;
        const backwardPaginationCompleted =
            previousRenderState.backwardPagination === "loading" && snapshot.backwardPagination !== "loading";
        if (
            forwardPaginationCompleted &&
            forwardPaginationContextRef.current?.requestReason === "at-bottom state change"
        ) {
            suppressBottomReassertAfterBottomTriggeredForwardPaginationRef.current = true;
            wasAtBottomRef.current = false;
        }

        const appendedWhileAtLiveEdge =
            scrollerElement &&
            previousRenderState.isAtLiveEdge &&
            snapshot.isAtLiveEdge &&
            previousRenderState.items.at(-1)?.key !== snapshot.items.at(-1)?.key;
        logTimelineViewPresenter(
            "forwardCompletion:summary",
            "forwardPaginationCompleted",
            forwardPaginationCompleted,
            "previousVisibleStartKey",
            lastVisibleRangeRef.current
                ? (previousRenderState.items[lastVisibleRangeRef.current.startIndex]?.key ?? null)
                : null,
            "previousVisibleEndKey",
            lastVisibleRangeRef.current
                ? (previousRenderState.items[lastVisibleRangeRef.current.endIndex]?.key ?? null)
                : null,
            "shiftedVisibleRangeStart",
            shiftedVisibleRange?.startIndex ?? null,
            "shiftedVisibleRangeEnd",
            shiftedVisibleRange?.endIndex ?? null,
            "shiftedVisibleStartKey",
            shiftedVisibleRange ? (snapshot.items[shiftedVisibleRange.startIndex]?.key ?? null) : null,
            "shiftedVisibleEndKey",
            shiftedVisibleRange ? (snapshot.items[shiftedVisibleRange.endIndex]?.key ?? null) : null,
            "windowShift",
            windowShift,
            "continuityMode",
            forwardPaginationContextRef.current?.continuityMode ?? null,
            "requestReason",
            forwardPaginationContextRef.current?.requestReason ?? null,
            "shouldRestoreForwardPaginationAnchor",
            shouldRestoreForwardPaginationAnchor,
            "shouldApplyImmediateAtBottomForwardPaginationAnchorRestore",
            shouldApplyImmediateAtBottomForwardPaginationAnchorRestore,
            "shouldRestoreForwardPaginationShiftedRange",
            shouldRestoreForwardPaginationShiftedRange,
            "handledRangeMatchesCurrent",
            handledForwardPaginationSlidingRebaseRangeRef.current === currentRangeKey,
            "blockedRangeMatchesCurrent",
            blockedForwardPaginationSlidingRebaseRangeRef.current === currentRangeKey,
            "forwardSlidingRebaseLockActive",
            isForwardPaginationSlidingRebaseLockActive(),
        );

        applyForwardPaginationCompletion({
            scrollerElement,
            currentRangeKey,
            windowShift,
            forwardPaginationCompleted,
            shouldRestoreForwardPaginationAnchor,
            shouldApplyImmediateAtBottomForwardPaginationAnchorRestore,
            atBottomForwardPaginationAnchorKey: forwardPaginationContextRef.current?.anchorKey ?? null,
            atBottomForwardPaginationDesiredBottomOffset: forwardPaginationContextRef.current?.bottomOffsetPx ?? null,
            shouldRestoreForwardPaginationShiftedRange,
            shouldPreserveForwardPaginationBottom,
            backwardPaginationCompleted,
            hasBackwardPaginationAnchor: !!backwardPaginationContextRef.current?.anchorKey,
            appendedWhileAtLiveEdge: !!appendedWhileAtLiveEdge,
            hasHandledForwardSlidingRebaseRangeForCurrentRange:
                handledForwardPaginationSlidingRebaseRangeRef.current === currentRangeKey,
            hasActiveForwardPaginationSlidingRebaseScrollLocation:
                activeForwardPaginationSlidingRebaseScrollLocationRef.current !== null,
            isForwardPaginationAnchorCorrectionInProgress: isForwardPaginationAnchorCorrectionInProgress(),
            isForwardPaginationShiftedRangeRestoreInProgress: isForwardPaginationShiftedRangeRestoreInProgress(),
            armForwardPaginationSlidingRebaseLock,
            setForwardPaginationSlidingRebaseVirtuosoRestoreActive,
            cancelPendingForwardPaginationShiftedRangeRestore,
            setHandledForwardPaginationSlidingRebaseRange: (rangeKey) => {
                handledForwardPaginationSlidingRebaseRangeRef.current = rangeKey;
            },
            scheduleForwardPaginationShiftedRangeVirtuosoFollowupCorrection,
            scheduleForwardPaginationShiftedRangeRestore,
            scheduleForwardPaginationAnchorCorrection,
            scheduleBackwardPaginationAnchorCorrection,
            scheduleLiveEdgeAppendCorrection,
            followOutputEnabled,
            deferForwardPaginationContextClear: () => {
                pendingForwardPaginationContextClearRef.current = true;
            },
            clearForwardPaginationContext: () => {
                forwardPaginationContextRef.current = null;
            },
            clearBackwardPaginationContext: () => {
                backwardPaginationContextRef.current = null;
            },
            forwardPaginationAnchorIndex,
        });

        if (
            !forwardPaginationCompleted &&
            hasPendingDeferredForwardPaginationContextClear &&
            !isForwardPaginationAnchorCorrectionInProgress() &&
            !isForwardPaginationShiftedRangeRestoreInProgress()
        ) {
            forwardPaginationContextRef.current = null;
            pendingForwardPaginationContextClearRef.current = false;
        }

        previousRenderStateRef.current = {
            items: snapshot.items,
            isAtLiveEdge: snapshot.isAtLiveEdge,
            backwardPagination: snapshot.backwardPagination,
            forwardPagination: snapshot.forwardPagination,
        };

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
        followOutputEnabled,
        setForwardPaginationSlidingRebaseVirtuosoRestoreActive,
        isForwardPaginationAnchorCorrectionInProgress,
        isForwardPaginationSlidingRebaseLockActive,
        isForwardPaginationShiftedRangeRestoreInProgress,
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
                    tabIndex={virtuosoProps.context.tabIndexKey === item.key ? 0 : -1}
                    onFocus={(e) => onFocusForGetItemComponent(item, e)}
                >
                    {renderItem(item)}
                </div>
            );
        },
        [onFocusForGetItemComponent, renderItem, virtuosoProps.context.tabIndexKey],
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

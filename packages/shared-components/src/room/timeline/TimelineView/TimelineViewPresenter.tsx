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
}

interface PreviousRenderState<TItem extends TimelineItem> {
    items: TItem[];
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

    const suppressNextProgrammaticCallbacks = useCallback(() => {
        ignoreNextEndReachedRef.current = true;
        ignoreNextStartReachedRef.current = true;
        ignoreNextTopScrollPaginationRef.current = true;
    }, []);

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
        const anchorElement = scrollerElement ? getLastVisibleTimelineItemElement(scrollerElement) : null;

        forwardPaginationContextRef.current = {
            anchorKey: anchorElement?.dataset.timelineItemKey ?? null,
            lastVisibleRange: lastVisibleRangeRef.current,
            bottomOffsetPx: scrollerElement && anchorElement ? getBottomOffset(scrollerElement, anchorElement) : null,
            requestedAtLiveEdge: snapshot.isAtLiveEdge,
        };
        vm.onRequestMoreItems("forward");
        return true;
    }, [scrollerElement, snapshot.isAtLiveEdge, snapshot.items, vm]);

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

            if (
                shouldDisableFollowOutputOnScroll({
                    previousScrollTop,
                    currentScrollTop,
                    isAtLiveEdge: latest.isAtLiveEdge,
                    followOutputEnabled,
                })
            ) {
                setFollowOutputEnabled(false);
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

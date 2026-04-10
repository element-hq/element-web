/*
Copyright 2026 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type JSX } from "react";
import { Virtuoso, type ListRange, type ScrollIntoViewLocation } from "react-virtuoso";

import type { ScrollIntoViewOnChange } from "../../../core/VirtualizedList";
import { useVirtualizedList } from "../../../core/VirtualizedList/virtualized-list";
import { useViewModel } from "../../../core/viewmodel/useViewModel";
import type { NavigationAnchor, PaginationState, TimelineItem, TimelineViewProps, VisibleRange } from "./types";

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
const INITIAL_FIRST_ITEM_INDEX = 100_000;
const TOP_SCROLL_THRESHOLD_PX = 1;

type TimelineScrollLocation = ScrollIntoViewLocation | false;

function countPrependedItems<TItem extends TimelineItem>(prevItems: TItem[], nextItems: TItem[]): number {
    if (prevItems.length === 0 || nextItems.length <= prevItems.length) {
        return 0;
    }

    const prependedCount = nextItems.length - prevItems.length;
    if (nextItems[prependedCount]?.key !== prevItems[0]?.key) {
        return 0;
    }

    if (nextItems[nextItems.length - 1]?.key !== prevItems[prevItems.length - 1]?.key) {
        return 0;
    }

    for (let index = 0; index < prevItems.length; index += 1) {
        if (nextItems[index + prependedCount]?.key !== prevItems[index]?.key) {
            return 0;
        }
    }

    return prependedCount;
}

export function getScrollLocationOnChange<TItem extends TimelineItem>({
    items,
    pendingAnchor,
    stuckAtBottom,
    totalCount,
    lastAnchoredKey,
    initialBottomSnapDone,
}: {
    items: TItem[];
    pendingAnchor: NavigationAnchor | null;
    stuckAtBottom: boolean;
    totalCount: number;
    lastAnchoredKey: string | null;
    initialBottomSnapDone: boolean;
}): TimelineScrollLocation {
    if (totalCount === 0) {
        return false;
    }

    if (!pendingAnchor) {
        return getInitialBottomScrollLocation({
            stuckAtBottom,
            totalCount,
            initialBottomSnapDone,
        });
    }

    if (lastAnchoredKey === pendingAnchor.targetKey) {
        return false;
    }

    return getAnchorScrollLocation(items, pendingAnchor);
}

function getInitialBottomScrollLocation({
    stuckAtBottom,
    totalCount,
    initialBottomSnapDone,
}: {
    stuckAtBottom: boolean;
    totalCount: number;
    initialBottomSnapDone: boolean;
}): TimelineScrollLocation {
    if (!stuckAtBottom || initialBottomSnapDone) {
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
    pendingAnchor: NavigationAnchor,
): TimelineScrollLocation {
    const targetIndex = items.findIndex((item) => item.key === pendingAnchor.targetKey);
    if (targetIndex === -1) {
        return false;
    }

    const align =
        pendingAnchor.position === undefined || pendingAnchor.position <= 0
            ? "start"
            : pendingAnchor.position >= 1
              ? "end"
              : "center";

    return {
        index: targetIndex,
        align,
        behavior: "auto",
    };
}

export function getPostInitialFillBottomSnapIndex({
    initialFillState,
    stuckAtBottom,
    hasPendingAnchor,
    itemCount,
    firstItemIndex,
    postInitialFillBottomSnapDone,
}: {
    initialFillState: "filling" | "done";
    stuckAtBottom: boolean;
    hasPendingAnchor: boolean;
    itemCount: number;
    firstItemIndex: number;
    postInitialFillBottomSnapDone: boolean;
}): number | null {
    if (
        initialFillState !== "done" ||
        !stuckAtBottom ||
        hasPendingAnchor ||
        itemCount === 0 ||
        postInitialFillBottomSnapDone
    ) {
        return null;
    }

    return firstItemIndex + itemCount - 1;
}

export function shouldIgnoreAtBottomStateChange({
    initialFillState,
    hasPendingAnchor,
}: {
    initialFillState: "filling" | "done";
    hasPendingAnchor: boolean;
}): boolean {
    return initialFillState === "filling" && !hasPendingAnchor;
}

export function shouldIgnoreStartReached({
    initialFillState,
    stuckAtBottom,
    hasPendingAnchor,
}: {
    initialFillState: "filling" | "done";
    stuckAtBottom: boolean;
    hasPendingAnchor: boolean;
}): boolean {
    return initialFillState === "done" && stuckAtBottom && !hasPendingAnchor;
}

export function shouldPaginateBackwardAtTopScroll({
    initialFillState,
    stuckAtBottom,
    hasPendingAnchor,
    backwardPagination,
    canPaginateBackward,
    scrollTop,
}: {
    initialFillState: "filling" | "done";
    stuckAtBottom: boolean;
    hasPendingAnchor: boolean;
    backwardPagination: PaginationState;
    canPaginateBackward: boolean;
    scrollTop: number;
}): boolean {
    return (
        initialFillState === "done" &&
        !stuckAtBottom &&
        !hasPendingAnchor &&
        backwardPagination === "idle" &&
        canPaginateBackward &&
        scrollTop <= TOP_SCROLL_THRESHOLD_PX
    );
}

export function TimelineView<TItem extends TimelineItem>({ vm, renderItem }: TimelineViewProps<TItem>): JSX.Element {
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
    // Used to detect prepend-only updates so firstItemIndex can be shifted without moving the viewport.
    const previousItemsRef = useRef<TItem[]>([]);
    // Cache the latest visible range for forward-pagination and focus/scroll restoration decisions.
    const lastVisibleRangeRef = useRef<VisibleRange | null>(null);
    // Startup fill is a small state machine: keep backfilling upward until the viewport is full
    // or a hard stop is reached, then switch to normal scrolling behavior.
    const [initialFillState, setInitialFillState] = useState<"filling" | "done">("filling");
    // Virtuoso uses this synthetic index space to preserve viewport position when older items are prepended.
    const [firstItemIndex, setFirstItemIndex] = useState(INITIAL_FIRST_ITEM_INDEX);
    // The top-scroll listener is attached to the actual scroller element once it becomes available.
    const [scrollerElement, setScrollerElement] = useState<HTMLElement | null>(null);
    const initialFillRoundsRef = useRef(0);
    const sawInitialRangeRef = useRef(false);
    // Prevent repeated top-edge pagination requests until the outstanding request resolves.
    const topScrollPaginationRequestedRef = useRef(false);
    // Keep the latest gating state in a ref so the native scroll listener stays stable while still
    // reading fresh pagination flags on every event.
    const latestTopScrollStateRef = useRef({
        vm,
        initialFillState,
        stuckAtBottom: snapshot.stuckAtBottom,
        hasPendingAnchor: !!snapshot.pendingAnchor,
        backwardPagination: snapshot.backwardPagination,
        canPaginateBackward: snapshot.canPaginateBackward,
    });

    const increaseViewportBy = useMemo(() => ({ top: OVERSCAN_PX, bottom: OVERSCAN_PX }), []);

    useEffect(() => {
        latestTopScrollStateRef.current = {
            vm,
            initialFillState,
            stuckAtBottom: snapshot.stuckAtBottom,
            hasPendingAnchor: !!snapshot.pendingAnchor,
            backwardPagination: snapshot.backwardPagination,
            canPaginateBackward: snapshot.canPaginateBackward,
        };
    }, [
        vm,
        initialFillState,
        snapshot.stuckAtBottom,
        snapshot.pendingAnchor,
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
        setFirstItemIndex(INITIAL_FIRST_ITEM_INDEX);
        lastAnchoredKeyRef.current = null;
        initialBottomSnapDoneRef.current = false;
        postInitialFillBottomSnapDoneRef.current = false;
        lastVisibleRangeRef.current = null;
        initialFillRoundsRef.current = 0;
        sawInitialRangeRef.current = false;
        previousItemsRef.current = [];
    }, [vm]);

    useEffect(() => {
        if (initialFillState === "done") {
            // Once startup fill is complete, notify the VM and immediately resume forward
            // pagination if the visible range is already at the live end.
            vm.onInitialFillCompleted();

            const lastVisibleRange = lastVisibleRangeRef.current;
            const isAtEnd =
                lastVisibleRange !== null && lastVisibleRange.endIndex >= Math.max(0, snapshot.items.length - 1);
            if (isAtEnd && snapshot.forwardPagination === "idle" && snapshot.canPaginateForward) {
                vm.paginate("forward");
            }
        }
    }, [initialFillState, snapshot.items.length, snapshot.forwardPagination, snapshot.canPaginateForward, vm]);

    useEffect(() => {
        if (snapshot.backwardPagination !== "loading") {
            topScrollPaginationRequestedRef.current = false;
        }
    }, [snapshot.backwardPagination]);

    useLayoutEffect(() => {
        const prependedItems = countPrependedItems(previousItemsRef.current, snapshot.items);
        previousItemsRef.current = snapshot.items;

        if (prependedItems > 0) {
            // Preserve the user's viewport when older items are inserted ahead of the loaded window.
            setFirstItemIndex((currentIndex) => currentIndex - prependedItems);
        }
    }, [snapshot.items]);

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

            if (initialFillState !== "filling") {
                return;
            }

            // During startup fill, the visible range owns the backfill loop: as long as the
            // viewport still begins at index 0 and more history is available, keep paginating
            // backward until the viewport is filled or limits are reached.
            if (snapshot.backwardPagination === "loading") {
                return;
            }

            if (initialFillRoundsRef.current === 0 && snapshot.canPaginateBackward && !snapshot.pendingAnchor) {
                return;
            }

            const canContinueInitialFill =
                snapshot.items.length > 0 &&
                visibleRange.startIndex === 0 &&
                snapshot.canPaginateBackward &&
                initialFillRoundsRef.current < MAX_INITIAL_FILL_ROUNDS &&
                !snapshot.pendingAnchor;

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
            vm.paginate("backward");
        },
        [
            vm,
            initialFillState,
            snapshot.backwardPagination,
            snapshot.canPaginateBackward,
            snapshot.items.length,
            snapshot.pendingAnchor,
        ],
    );

    const handleAtBottomStateChange = useCallback(
        (atBottom: boolean) => {
            if (
                shouldIgnoreAtBottomStateChange({
                    initialFillState,
                    hasPendingAnchor: !!snapshot.pendingAnchor,
                })
            ) {
                return;
            }

            vm.onStuckAtBottomChanged(atBottom);
        },
        [initialFillState, snapshot.pendingAnchor, vm],
    );

    const handleStartReached = useCallback(() => {
        if (snapshot.backwardPagination !== "idle" || !snapshot.canPaginateBackward) {
            return;
        }

        // The initial top-edge probe should come from startReached, but once
        // startup fill is underway the range-change loop owns subsequent pulls.
        if (initialFillState === "filling") {
            if (initialFillRoundsRef.current === 0 && !snapshot.pendingAnchor) {
                initialFillRoundsRef.current = 1;
                vm.paginate("backward");
            }
            return;
        }

        if (
            shouldIgnoreStartReached({
                initialFillState,
                stuckAtBottom: snapshot.stuckAtBottom,
                hasPendingAnchor: !!snapshot.pendingAnchor,
            })
        ) {
            return;
        }

        vm.paginate("backward");
    }, [
        vm,
        initialFillState,
        snapshot.backwardPagination,
        snapshot.canPaginateBackward,
        snapshot.pendingAnchor,
        snapshot.stuckAtBottom,
    ]);

    const handleEndReached = useCallback(() => {
        if (initialFillState === "done" && snapshot.forwardPagination === "idle" && snapshot.canPaginateForward) {
            vm.paginate("forward");
        }
    }, [vm, initialFillState, snapshot.forwardPagination, snapshot.canPaginateForward]);

    const scrollIntoViewOnChange = useCallback<ScrollIntoViewOnChange<TItem, undefined>>(
        ({ totalCount }): ScrollIntoViewLocation | null | undefined | false => {
            // Centralize all data-driven scroll requests here: initial bottom snaps and explicit
            // anchor navigation both flow through Virtuoso's scrollIntoViewOnChange hook.
            const scrollLocation = getScrollLocationOnChange({
                items: snapshot.items,
                pendingAnchor: snapshot.pendingAnchor,
                stuckAtBottom: snapshot.stuckAtBottom,
                totalCount,
                lastAnchoredKey: lastAnchoredKeyRef.current,
                initialBottomSnapDone: initialBottomSnapDoneRef.current,
            });

            if (!scrollLocation) {
                lastAnchoredKeyRef.current = null;
                return false;
            }

            if (!snapshot.pendingAnchor) {
                initialBottomSnapDoneRef.current = true;
                lastAnchoredKeyRef.current = null;
                return scrollLocation;
            }

            lastAnchoredKeyRef.current = snapshot.pendingAnchor.targetKey;
            vm.onAnchorReached();

            return scrollLocation;
        },
        [snapshot.items, snapshot.pendingAnchor, snapshot.stuckAtBottom, vm],
    );

    useEffect(() => {
        if (!scrollerElement) {
            return;
        }

        const onScroll = (): void => {
            // This listener handles the "user manually scrolled to the top" pagination path.
            // It is intentionally separate from startReached because top-edge detection during
            // prepend-heavy timelines is easier to reason about from raw scrollTop.
            if (topScrollPaginationRequestedRef.current) {
                return;
            }

            const latest = latestTopScrollStateRef.current;
            if (
                !shouldPaginateBackwardAtTopScroll({
                    initialFillState: latest.initialFillState,
                    stuckAtBottom: latest.stuckAtBottom,
                    hasPendingAnchor: latest.hasPendingAnchor,
                    backwardPagination: latest.backwardPagination,
                    canPaginateBackward: latest.canPaginateBackward,
                    scrollTop: scrollerElement.scrollTop,
                })
            ) {
                return;
            }

            topScrollPaginationRequestedRef.current = true;
            latest.vm.paginate("backward");
        };

        scrollerElement.addEventListener("scroll", onScroll, { passive: true });
        return () => {
            scrollerElement.removeEventListener("scroll", onScroll);
        };
    }, [scrollerElement]);

    const {
        onFocusForGetItemComponent,
        context: listContext,
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
        followOutput: snapshot.stuckAtBottom ? "smooth" : false,
        style: { height: "100%", width: "100%" },
    });

    const itemContent = useCallback(
        (index: number, item: TItem): JSX.Element => {
            return (
                // Timeline rows may contain their own interactive descendants; capture focus at
                // the wrapper so the shared VirtualizedList roving-focus model stays in sync.
                <div key={item.key} onFocusCapture={(e) => onFocusForGetItemComponent(item, e)}>
                    {renderItem(item)}
                </div>
            );
        },
        [onFocusForGetItemComponent, renderItem],
    );

    const handleScrollerRef = useCallback(
        (element: HTMLElement | Window | null) => {
            virtuosoProps.scrollerRef(element);
            const nextElement = element instanceof HTMLElement ? element : null;
            setScrollerElement((currentElement) => (currentElement === nextElement ? currentElement : nextElement));
        },
        [virtuosoProps],
    );

    useLayoutEffect(() => {
        const bottomSnapIndex = getPostInitialFillBottomSnapIndex({
            initialFillState,
            stuckAtBottom: snapshot.stuckAtBottom,
            hasPendingAnchor: !!snapshot.pendingAnchor,
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
        snapshot.stuckAtBottom,
        snapshot.pendingAnchor,
        snapshot.items.length,
        virtuosoProps.ref,
    ]);

    return (
        <Virtuoso data={snapshot.items} itemContent={itemContent} {...virtuosoProps} scrollerRef={handleScrollerRef} />
    );
}

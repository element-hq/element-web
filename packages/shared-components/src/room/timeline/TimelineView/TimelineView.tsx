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
    const previousVmRef = useRef(vm);
    const lastAnchoredKeyRef = useRef<string | null>(null);
    const initialBottomSnapDoneRef = useRef(false);
    const postInitialFillBottomSnapDoneRef = useRef(false);
    const previousItemsRef = useRef<TItem[]>([]);
    const lastVisibleRangeRef = useRef<VisibleRange | null>(null);
    const [initialFillState, setInitialFillState] = useState<"filling" | "done">("filling");
    const [firstItemIndex, setFirstItemIndex] = useState(INITIAL_FIRST_ITEM_INDEX);
    const initialFillRoundsRef = useRef(0);
    const sawInitialRangeRef = useRef(false);
    const scrollerElementRef = useRef<HTMLElement | null>(null);
    const topScrollPaginationRequestedRef = useRef(false);

    const increaseViewportBy = useMemo(() => ({ top: OVERSCAN_PX, bottom: OVERSCAN_PX }), []);

    useEffect(() => {
        if (previousVmRef.current === vm) {
            return;
        }

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
            setFirstItemIndex((currentIndex) => currentIndex - prependedItems);
        }
    }, [firstItemIndex, initialFillState, snapshot.items, snapshot.stuckAtBottom]);

    const itemContent = useCallback(
        (index: number, item: TItem): JSX.Element => {
            return <React.Fragment key={item.key}>{renderItem(item)}</React.Fragment>;
        },
        [renderItem],
    );

    const handleRangeChanged = useCallback(
        (range: ListRange) => {
            const visibleRange: VisibleRange = {
                startIndex: range.startIndex,
                endIndex: range.endIndex,
            };
            lastVisibleRangeRef.current = visibleRange;
            vm.onVisibleRangeChanged(visibleRange);

            if (initialFillState !== "filling") {
                return;
            }

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
        const scroller = scrollerElementRef.current;
        if (!scroller) {
            return;
        }

        const onScroll = (): void => {
            if (topScrollPaginationRequestedRef.current) {
                return;
            }

            if (
                !shouldPaginateBackwardAtTopScroll({
                    initialFillState,
                    stuckAtBottom: snapshot.stuckAtBottom,
                    hasPendingAnchor: !!snapshot.pendingAnchor,
                    backwardPagination: snapshot.backwardPagination,
                    canPaginateBackward: snapshot.canPaginateBackward,
                    scrollTop: scroller.scrollTop,
                })
            ) {
                return;
            }

            topScrollPaginationRequestedRef.current = true;
            vm.paginate("backward");
        };

        scroller.addEventListener("scroll", onScroll, { passive: true });
        return () => {
            scroller.removeEventListener("scroll", onScroll);
        };
    }, [
        vm,
        initialFillState,
        snapshot.stuckAtBottom,
        snapshot.pendingAnchor,
        snapshot.backwardPagination,
        snapshot.canPaginateBackward,
        snapshot.items.length,
    ]);

    const { onFocusForGetItemComponent: _onFocusForGetItemComponent, ...virtuosoProps } = useVirtualizedList<
        TItem,
        undefined
    >({
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
        followOutput: snapshot.stuckAtBottom ? "smooth" : false,
        style: { height: "100%", width: "100%" },
    });

    const handleScrollerRef = useCallback(
        (element: HTMLElement | Window | null) => {
            virtuosoProps.scrollerRef(element);
            scrollerElementRef.current = element instanceof HTMLElement ? element : null;
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

        postInitialFillBottomSnapDoneRef.current = true;
        virtuosoProps.ref.current?.scrollIntoView({
            index: bottomSnapIndex,
            align: "end",
            behavior: "auto",
        });
    }, [initialFillState, firstItemIndex, snapshot.stuckAtBottom, snapshot.pendingAnchor, snapshot.items.length, virtuosoProps.ref]);

    return <Virtuoso data={snapshot.items} itemContent={itemContent} {...virtuosoProps} scrollerRef={handleScrollerRef} />;
}

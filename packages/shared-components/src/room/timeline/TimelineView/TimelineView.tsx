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
import type { TimelineItem, TimelineViewProps, VisibleRange } from "./types";

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

const log = (...args: unknown[]): void => console.log("[TimelineView]", ...args);

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

export function TimelineView<TItem extends TimelineItem>({ vm, renderItem }: TimelineViewProps<TItem>): JSX.Element {
    const snapshot = useViewModel(vm);
    const previousVmRef = useRef(vm);
    const lastAnchoredKeyRef = useRef<string | null>(null);
    const previousItemsRef = useRef<TItem[]>([]);
    const lastVisibleRangeRef = useRef<VisibleRange | null>(null);
    const [initialFillState, setInitialFillState] = useState<"filling" | "done">("filling");
    const [firstItemIndex, setFirstItemIndex] = useState(INITIAL_FIRST_ITEM_INDEX);
    const initialFillRoundsRef = useRef(0);
    const sawInitialRangeRef = useRef(false);

    const increaseViewportBy = useMemo(() => ({ top: OVERSCAN_PX, bottom: OVERSCAN_PX }), []);

    useEffect(() => {
        if (previousVmRef.current === vm) {
            return;
        }

        previousVmRef.current = vm;
        setInitialFillState("filling");
        setFirstItemIndex(INITIAL_FIRST_ITEM_INDEX);
        lastAnchoredKeyRef.current = null;
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

    useLayoutEffect(() => {
        const prependedItems = countPrependedItems(previousItemsRef.current, snapshot.items);
        previousItemsRef.current = snapshot.items;

        if (prependedItems > 0) {
            setFirstItemIndex((currentIndex) => currentIndex - prependedItems);
        }
    }, [snapshot.items]);

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
            vm.onStuckAtBottomChanged(atBottom);
        },
        [vm],
    );

    const handleStartReached = useCallback(() => {
        log(
            "startReached fired, backwardPagination:",
            snapshot.backwardPagination,
            "canPaginateBackward:",
            snapshot.canPaginateBackward,
            "initialFill:",
            initialFillState,
        );
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

        vm.paginate("backward");
    }, [vm, initialFillState, snapshot.backwardPagination, snapshot.canPaginateBackward, snapshot.pendingAnchor]);

    const handleEndReached = useCallback(() => {
        log(
            "endReached fired, forwardPagination:",
            snapshot.forwardPagination,
            "canPaginateForward:",
            snapshot.canPaginateForward,
            "initialFill:",
            initialFillState,
        );
        if (initialFillState === "done" && snapshot.forwardPagination === "idle" && snapshot.canPaginateForward) {
            vm.paginate("forward");
        }
    }, [vm, initialFillState, snapshot.forwardPagination, snapshot.canPaginateForward]);

    const scrollIntoViewOnChange = useCallback<ScrollIntoViewOnChange<TItem, undefined>>(
        ({ totalCount }): ScrollIntoViewLocation | null | undefined | false => {
            const pendingAnchor = snapshot.pendingAnchor;
            if (!pendingAnchor || totalCount === 0) {
                lastAnchoredKeyRef.current = null;
                return false;
            }

            if (lastAnchoredKeyRef.current === pendingAnchor.targetKey) {
                return false;
            }

            const targetIndex = snapshot.items.findIndex((item) => item.key === pendingAnchor.targetKey);
            if (targetIndex === -1) {
                return false;
            }

            lastAnchoredKeyRef.current = pendingAnchor.targetKey;
            vm.onAnchorReached();

            return {
                index: targetIndex,
                align:
                    pendingAnchor.position === undefined || pendingAnchor.position <= 0
                        ? "start"
                        : pendingAnchor.position >= 1
                          ? "end"
                          : "center",
                behavior: "auto",
            };
        },
        [snapshot.items, snapshot.pendingAnchor, vm],
    );

    const { onFocusForGetItemComponent: _onFocusForGetItemComponent, ...virtuosoProps } = useVirtualizedList<
        TItem,
        undefined
    >({
        items: snapshot.items,
        firstItemIndex,
        increaseViewportBy,
        getItemKey: (item) => item.key,
        isItemFocusable: () => true,
        rangeChanged: handleRangeChanged,
        atBottomStateChange: handleAtBottomStateChange,
        startReached: handleStartReached,
        endReached: handleEndReached,
        scrollIntoViewOnChange,
        followOutput: snapshot.stuckAtBottom ? "smooth" : false,
        style: { height: "100%", width: "100%" },
    });

    log(
        "render, items:",
        snapshot.items.length,
        "firstItemIndex:",
        firstItemIndex,
        "initialFill:",
        initialFillState,
        "backPag:",
        snapshot.backwardPagination,
        "fwdPag:",
        snapshot.forwardPagination,
    );

    return <Virtuoso data={snapshot.items} itemContent={itemContent} {...virtuosoProps} />;
}

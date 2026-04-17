/*
Copyright 2026 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { useCallback, useEffect, useRef, useState, type JSX } from "react";
import { Virtuoso, type ListRange, type VirtuosoHandle } from "react-virtuoso";
import classNames from "classnames";

import { useViewModel } from "../../../core/viewmodel/useViewModel";
import { getContiguousWindowShift, getIsAtLiveEdgeFromBottomState, INITIAL_FIRST_ITEM_INDEX } from "./utils";
import styles from "./TimelineView.module.css";
import type { TimelineItem, TimelineViewProps } from "./types";

/**
 * Renders a virtualized room timeline backed by a {@link TimelineViewModel}.
 *
 * The component owns the mechanics of timeline scrolling so feature code can
 * focus on producing a snapshot and rendering rows. It preserves the viewport
 * across pagination, follows the live edge when appropriate, and executes
 * one-shot anchor jumps exposed through the view model.
 *
 * Consumers provide the row renderer through {@link TimelineViewProps.renderItem}
 * and update the timeline state through the view-model callbacks declared by
 * {@link TimelineViewActions}. The rendered list is powered by `react-virtuoso`
 * to keep large timelines responsive while only mounting the visible window.
 *
 * @typeParam TItem - Concrete timeline item shape rendered by the timeline.
 */
export function TimelineView<TItem extends TimelineItem>({
    vm,
    className,
    renderItem,
}: Readonly<TimelineViewProps<TItem>>): JSX.Element {
    const snapshot = useViewModel(vm);

    // Track live viewport state and imperative Virtuoso access.
    const [isAtBottom, setIsAtBottom] = useState(false);
    const virtuosoRef = useRef<VirtuosoHandle | null>(null);

    // Remember one-shot timeline signals across renders.
    const lastIsAtLiveEdgeRef = useRef<boolean | null>(null);
    const initialFillCompletedRef = useRef(false);
    const latestVisibleRangeRef = useRef<ListRange | null>(null);
    const lastRequestedScrollTargetRef = useRef<string | null>(null);
    const pendingScrollTargetRef = useRef<{
        key: string;
        localIndex: number;
    } | null>(null);
    const renderedItemsRef = useRef(snapshot.items);
    const renderedFirstItemIndexRef = useRef(INITIAL_FIRST_ITEM_INDEX);
    const renderedScrollTargetRef = useRef(snapshot.scrollTarget);

    // Keep Virtuoso's absolute index stable while the loaded window slides.
    const firstItemIndexRenderStateRef = useRef<{
        vm: typeof vm;
        items: TItem[];
        firstItemIndex: number;
    }>({
        vm,
        items: snapshot.items,
        firstItemIndex: INITIAL_FIRST_ITEM_INDEX,
    });

    if (firstItemIndexRenderStateRef.current.vm !== vm) {
        firstItemIndexRenderStateRef.current = {
            vm,
            items: snapshot.items,
            firstItemIndex: INITIAL_FIRST_ITEM_INDEX,
        };
        initialFillCompletedRef.current = false;
        latestVisibleRangeRef.current = null;
        lastRequestedScrollTargetRef.current = null;
        pendingScrollTargetRef.current = null;
    } else if (firstItemIndexRenderStateRef.current.items !== snapshot.items) {
        const windowShift = getContiguousWindowShift(firstItemIndexRenderStateRef.current.items, snapshot.items);
        const previousFirstItemIndex = firstItemIndexRenderStateRef.current.firstItemIndex;
        firstItemIndexRenderStateRef.current = {
            vm,
            items: snapshot.items,
            firstItemIndex: previousFirstItemIndex - windowShift,
        };
    }

    // Derive the current Virtuoso position inputs from the latest snapshot.
    const firstItemIndex = firstItemIndexRenderStateRef.current.firstItemIndex;
    const followOutput = !snapshot.canPaginateForward && isAtBottom ? "auto" : false;

    renderedItemsRef.current = snapshot.items;
    renderedFirstItemIndexRef.current = firstItemIndex;
    renderedScrollTargetRef.current = snapshot.scrollTarget;

    // Acknowledge one-shot scroll targets once the requested item becomes visible.
    const acknowledgePendingScrollTargetIfVisible = useCallback(
        (range: ListRange) => {
            const pendingScrollTarget = pendingScrollTargetRef.current;
            if (!pendingScrollTarget) {
                return;
            }

            const absoluteTargetIndex = firstItemIndex + pendingScrollTarget.localIndex;
            if (absoluteTargetIndex < range.startIndex || absoluteTargetIndex > range.endIndex) {
                return;
            }

            pendingScrollTargetRef.current = null;
            vm.onScrollTargetReached();
        },
        [firstItemIndex, vm],
    );

    // Forward Virtuoso boundary and viewport events into the timeline view model.
    const handleStartReached = useCallback(() => {
        if (snapshot.canPaginateBackward && snapshot.backwardPagination !== "loading") {
            vm.onRequestMoreItems("backward");
        }
    }, [snapshot.backwardPagination, snapshot.canPaginateBackward, vm]);

    const handleEndReached = useCallback(() => {
        if (snapshot.canPaginateForward && snapshot.forwardPagination !== "loading") {
            vm.onRequestMoreItems("forward");
        }
    }, [snapshot.canPaginateForward, snapshot.forwardPagination, vm]);

    const handleBottomStateChange = useCallback(
        (nextIsAtBottom: boolean) => {
            setIsAtBottom(nextIsAtBottom);
            const nextIsAtLiveEdge = getIsAtLiveEdgeFromBottomState({
                atBottom: nextIsAtBottom,
                canPaginateForward: snapshot.canPaginateForward,
            });

            if (lastIsAtLiveEdgeRef.current === nextIsAtLiveEdge) {
                return;
            }

            lastIsAtLiveEdgeRef.current = nextIsAtLiveEdge;
            vm.onIsAtLiveEdgeChanged(nextIsAtLiveEdge);
        },
        [snapshot.canPaginateForward, vm],
    );

    const handleRangeChanged = useCallback(
        (range: ListRange) => {
            latestVisibleRangeRef.current = range;

            const items = renderedItemsRef.current;
            const currentFirstItemIndex = renderedFirstItemIndexRef.current;

            if (items.length > 0) {
                const startIndex = Math.max(0, Math.min(items.length - 1, range.startIndex - currentFirstItemIndex));
                const endIndex = Math.max(
                    startIndex,
                    Math.min(items.length - 1, range.endIndex - currentFirstItemIndex),
                );
                vm.onVisibleRangeChanged({
                    startKey: items[startIndex]!.key,
                    endKey: items[endIndex]!.key,
                });
            }

            acknowledgePendingScrollTargetIfVisible(range);
        },
        [acknowledgePendingScrollTargetIfVisible, vm],
    );

    // Drive explicit anchor jumps through the Virtuoso handle.
    const tryApplyScrollTarget = useCallback(() => {
        if (!initialFillCompletedRef.current) {
            return;
        }

        const scrollTarget = renderedScrollTargetRef.current;
        if (!scrollTarget) {
            pendingScrollTargetRef.current = null;
            lastRequestedScrollTargetRef.current = null;
            return;
        }

        const scrollTargetDescriptor = `${scrollTarget.targetKey}:${scrollTarget.position ?? "bottom"}`;
        if (lastRequestedScrollTargetRef.current === scrollTargetDescriptor) {
            return;
        }

        const items = renderedItemsRef.current;
        const currentFirstItemIndex = renderedFirstItemIndexRef.current;
        const localIndex = items.findIndex((item) => item.key === scrollTarget.targetKey);
        if (localIndex < 0) {
            return;
        }

        const align =
            scrollTarget.position === "top"
                ? "start"
                : scrollTarget.position === "center"
                  ? "center"
                  : "end";

        pendingScrollTargetRef.current = {
            key: scrollTarget.targetKey,
            localIndex,
        };
        lastRequestedScrollTargetRef.current = scrollTargetDescriptor;
        virtuosoRef.current?.scrollToIndex({
            index: currentFirstItemIndex + localIndex,
            align,
            behavior: "auto",
        });

        if (latestVisibleRangeRef.current) {
            acknowledgePendingScrollTargetIfVisible(latestVisibleRangeRef.current);
        }
    }, [acknowledgePendingScrollTargetIfVisible]);

    const handleItemsRendered = useCallback(() => {
        if (initialFillCompletedRef.current) {
            return;
        }

        initialFillCompletedRef.current = true;
        vm.onInitialFillCompleted();
        tryApplyScrollTarget();
    }, [tryApplyScrollTarget, vm]);

    useEffect(() => {
        tryApplyScrollTarget();
    }, [tryApplyScrollTarget, snapshot.scrollTarget, snapshot.items, firstItemIndex]);

    return (
        <Virtuoso
            ref={virtuosoRef}
            className={classNames(styles.timeline, className)}
            data={snapshot.items}
            firstItemIndex={firstItemIndex}
            initialTopMostItemIndex={{ index: "LAST", align: "end" }}
            atBottomStateChange={handleBottomStateChange}
            followOutput={followOutput}
            startReached={handleStartReached}
            endReached={handleEndReached}
            itemsRendered={handleItemsRendered}
            rangeChanged={handleRangeChanged}
            itemContent={(_index, item) => renderItem(item)}
            computeItemKey={(_index, item) => item.key}
        />
    );
}

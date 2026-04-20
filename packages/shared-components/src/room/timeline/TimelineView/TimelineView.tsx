/*
Copyright 2026 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { useCallback, useRef, useState, type JSX } from "react";
import { Virtuoso, type ListRange } from "react-virtuoso";
import classNames from "classnames";

import { useViewModel } from "../../../core/viewmodel/useViewModel";
import { getContiguousWindowShift, INITIAL_FIRST_ITEM_INDEX } from "./utils";
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

    // Remember one-shot timeline signals across renders.
    const latestIsAtLiveEdgeRef = useRef<boolean | null>(null);
    const initialFillCompletedRef = useRef(false);
    const latestVisibleRangeRef = useRef<ListRange | null>(null);
    const renderedItemsRef = useRef(snapshot.items);
    const renderedFirstItemIndexRef = useRef(INITIAL_FIRST_ITEM_INDEX);

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
    const hasActiveScrollTarget = snapshot.scrollTarget !== null;
    const followOutput = !hasActiveScrollTarget && !snapshot.canPaginateForward && isAtBottom ? "auto" : false;

    renderedItemsRef.current = snapshot.items;
    renderedFirstItemIndexRef.current = firstItemIndex;

    // Forward Virtuoso boundary and viewport events into the timeline view model.
    const handleStartReached = useCallback(() => {
        if (snapshot.canPaginateBackward && snapshot.backwardPagination !== "loading") {
            vm.onRequestMoreItems("backward");
        }
    }, [snapshot.backwardPagination, snapshot.canPaginateBackward, vm]);

    const handleEndReached = useCallback(() => {
        if (hasActiveScrollTarget) {
            return;
        }

        if (snapshot.canPaginateForward && snapshot.forwardPagination !== "loading") {
            vm.onRequestMoreItems("forward");
        }
    }, [hasActiveScrollTarget, snapshot.canPaginateForward, snapshot.forwardPagination, vm]);

    const handleBottomStateChange = useCallback(
        (nextIsAtBottom: boolean) => {
            setIsAtBottom(nextIsAtBottom);

            const nextIsAtLiveEdge = nextIsAtBottom && !snapshot.canPaginateForward;
            if (latestIsAtLiveEdgeRef.current === nextIsAtLiveEdge) {
                return;
            }

            latestIsAtLiveEdgeRef.current = nextIsAtLiveEdge;
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
        },
        [vm],
    );

    const handleItemsRendered = useCallback(() => {
        if (!initialFillCompletedRef.current) {
            initialFillCompletedRef.current = true;
            vm.onInitialFillCompleted();
        }
    }, [vm]);

    return (
        <Virtuoso
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

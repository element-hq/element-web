/*
Copyright 2026 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { useCallback, useRef, useState, type JSX } from "react";
import { Virtuoso, type IndexLocationWithAlign, type ListRange } from "react-virtuoso";
import classNames from "classnames";

import { useViewModel } from "../../../core/viewmodel/useViewModel";
import styles from "./TimelineView.module.css";
import type { NavigationAnchor, TimelineItem, TimelineViewProps } from "./types";

export function getInitialTopMostItemIndex<TItem extends TimelineItem>(
    items: TItem[],
    scrollTarget: NavigationAnchor | null,
): IndexLocationWithAlign {
    const targetKey = scrollTarget?.targetKey;
    if (!targetKey) {
        return { index: "LAST", align: "end" };
    }

    const targetIndex = items.findIndex((item) => item.key === targetKey);
    if (targetIndex === -1) {
        return { index: "LAST", align: "end" };
    }

    const align =
        scrollTarget?.position === "top" ? "start" : scrollTarget?.position === "center" ? "center" : "end";

    return { index: targetIndex, align };
}

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
 * The supplied items array is expected to be monotonic: new entries may be
 * added at either end, but existing entries must not be removed or reordered.
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
    const renderedItemsRef = useRef(snapshot.items);
    const vmRef = useRef(vm);

    if (vmRef.current !== vm) {
        vmRef.current = vm;
        initialFillCompletedRef.current = false;
    }

    renderedItemsRef.current = snapshot.items;

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
            const items = renderedItemsRef.current;

            if (items.length > 0) {
                const startIndex = Math.max(0, Math.min(items.length - 1, range.startIndex));
                const endIndex = Math.max(startIndex, Math.min(items.length - 1, range.endIndex));
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

    const followOutput = !snapshot.canPaginateForward && isAtBottom ? "auto" : false;

    return (
        <Virtuoso
            className={classNames(styles.timeline, className)}
            data={snapshot.items}
            initialTopMostItemIndex={getInitialTopMostItemIndex(snapshot.items, snapshot.scrollTarget)}
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

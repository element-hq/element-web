/*
Copyright 2026 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { useCallback, useMemo, useRef, type JSX } from "react";
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

const log = (...args: unknown[]): void => console.log("[TimelineView]", ...args);

export function TimelineView<TItem extends TimelineItem>({ vm, renderItem }: TimelineViewProps<TItem>): JSX.Element {
    const snapshot = useViewModel(vm);
    const lastAnchoredKeyRef = useRef<string | null>(null);

    const increaseViewportBy = useMemo(() => ({ top: OVERSCAN_PX, bottom: OVERSCAN_PX }), []);

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
            vm.onVisibleRangeChanged(visibleRange);
        },
        [vm],
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
            snapshot.initialFill,
        );
        // Startup fill is allowed to keep pulling older history from the top
        // edge until the viewport is sufficiently filled.
        if (snapshot.backwardPagination === "idle" && snapshot.canPaginateBackward) {
            vm.paginate("backward");
        }
    }, [vm, snapshot.initialFill, snapshot.backwardPagination, snapshot.canPaginateBackward]);

    const handleEndReached = useCallback(() => {
        log(
            "endReached fired, forwardPagination:",
            snapshot.forwardPagination,
            "canPaginateForward:",
            snapshot.canPaginateForward,
            "initialFill:",
            snapshot.initialFill,
        );
        if (snapshot.initialFill === "done" && snapshot.forwardPagination === "idle" && snapshot.canPaginateForward) {
            vm.paginate("forward");
        }
    }, [vm, snapshot.initialFill, snapshot.forwardPagination, snapshot.canPaginateForward]);

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

    const firstItemIndex = vm.getFirstItemIndex();
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
        snapshot.initialFill,
        "backPag:",
        snapshot.backwardPagination,
        "fwdPag:",
        snapshot.forwardPagination,
    );

    return <Virtuoso data={snapshot.items} itemContent={itemContent} {...virtuosoProps} />;
}

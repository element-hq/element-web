/*
Copyright 2026 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { useCallback, useEffect, useMemo, type JSX } from "react";
import { Virtuoso, type ListRange } from "react-virtuoso";

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

export function TimelineView({ vm, renderItem }: TimelineViewProps): JSX.Element {
    const snapshot = useViewModel(vm);

    const increaseViewportBy = useMemo(() => ({ top: OVERSCAN_PX, bottom: OVERSCAN_PX }), []);

    const itemContent = useCallback(
        (index: number, item: TimelineItem): JSX.Element => {
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
        log("startReached fired, backwardPagination:", snapshot.backwardPagination);
        if (snapshot.backwardPagination === "idle") {
            vm.paginate("backward");
        }
    }, [vm, snapshot.backwardPagination]);

    const handleEndReached = useCallback(() => {
        log("endReached fired, forwardPagination:", snapshot.forwardPagination);
        if (snapshot.forwardPagination === "idle") {
            vm.paginate("forward");
        }
    }, [vm, snapshot.forwardPagination]);

    // Handle pending anchor scrolls
    useEffect(() => {
        if (snapshot.pendingAnchor) {
            // The anchor will be handled by Virtuoso's initialTopMostItemIndex
            // or scrollToIndex on the next render cycle. For now, acknowledge it.
            vm.onAnchorReached();
        }
    }, [snapshot.pendingAnchor, vm]);

    const firstItemIndex = vm.getFirstItemIndex();

    log(
        "render, items:",
        snapshot.items.length,
        "firstItemIndex:",
        firstItemIndex,
        "backPag:",
        snapshot.backwardPagination,
        "fwdPag:",
        snapshot.forwardPagination,
    );

    return (
        <Virtuoso
            data={snapshot.items}
            firstItemIndex={firstItemIndex}
            increaseViewportBy={increaseViewportBy}
            itemContent={itemContent}
            rangeChanged={handleRangeChanged}
            atBottomStateChange={handleAtBottomStateChange}
            startReached={handleStartReached}
            endReached={handleEndReached}
            followOutput={snapshot.stuckAtBottom ? "smooth" : false}
            style={{ height: "100%", width: "100%" }}
        />
    );
}

/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { useCallback, useEffect, useMemo, useRef, type JSX, type ReactNode, type PropsWithChildren } from "react";
import { LogLevel, Virtuoso, type VirtuosoHandle } from "react-virtuoso";

import { useViewModel } from "../../../core/viewmodel/useViewModel";
import type { TimelineItem, TimelineViewProps } from "./types";

/**
 * Shared virtualized timeline container.
 *
 * Renders an ordered list of timeline items using react-virtuoso.
 * The consuming app controls what each row looks like via `renderItem`;
 * this component owns layout, scrolling, pagination triggers, and
 * stuck-at-bottom tracking.
 */

/** Set to true locally to log per-tile height changes to the console.
 * Each line shows the item key, previous height, and new height so you can
 * identify which tile types are changing size after initial mount. */
const DEBUG_SIZES = true;

/** @internal */
function HeightDebugWrapper({ itemKey, label, children }: PropsWithChildren<{ itemKey: string; label: string }>): ReactNode {
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        let prevHeight: number | null = null;
        let mountCount = 0;
        const ro = new ResizeObserver((entries) => {
            const h = entries[0].borderBoxSize[0].blockSize;
            if (prevHeight === null) {
                prevHeight = h;
                mountCount += 1;
                return;
            }
            if (h !== prevHeight) {
                console.debug(
                    `react-virtuoso: [tile resize] ${label} key=${itemKey} mount#${mountCount} ${prevHeight}px → ${h}px`,
                );
                prevHeight = h;
            }
        });
        ro.observe(el);
        return () => ro.disconnect();
    }, [itemKey, label]);

    return <div ref={ref} style={{ display: "flow-root" }}>{children}</div>;
}

/** Pre-render this many pixels above and below the visible viewport.
 * A large value keeps items mounted long enough for async content (avatars,
 * reactions, E2E shields) to settle before the user scrolls to them,
 * preventing the height-change → Virtuoso compensation → flicker cycle. */
const OVERSCAN_PX = 2000;


/**
 * On initial mount Virtuoso only reads `initialTopMostItemIndex` once.
 * `'LAST'` tells it to land on the final item and align it to the end of
 * the viewport, giving a correct bottom-of-room starting position.
 */
const INITIAL_BOTTOM = { index: "LAST" as const, align: "end" as const };

export function TimelineView({ vm, renderItem }: TimelineViewProps): JSX.Element {
    const snapshot = useViewModel(vm);
    const virtuosoRef = useRef<VirtuosoHandle>(null);

    // Imperative scroll-freeze machinery — uses refs + direct DOM mutation so
    // that freeze/unfreeze never triggers a React re-render.  Only in-viewport
    // tiles are frozen; above-viewport tiles are released immediately as the
    // visible range changes, keeping Virtuoso's height cache accurate for them
    // and eliminating the scrollTop jump that would otherwise occur on
    // scroll-stop when those above-fold locks are released en masse.
    const containerRef = useRef<HTMLDivElement>(null);

    // const increaseViewportBy = useMemo(() => ({ top: OVERSCAN_PX, bottom: OVERSCAN_PX }), []);
    const overscan = useMemo(() => ({ main: OVERSCAN_PX, reverse: OVERSCAN_PX }), []);

    const itemContent = useCallback(
        (_index: number, item: TimelineItem): ReactNode => {
            const label =
                item.kind === "event" ? `event(continuation=${item.continuation})` : item.kind;
            if (DEBUG_SIZES) {
                return <HeightDebugWrapper itemKey={item.key} label={label}>{renderItem(item)}</HeightDebugWrapper>;
            }
            return <div style={{ display: "flow-root" }}>{renderItem(item)}</div>;
        },
        [renderItem],
    );

    /**
     * Derive a stable React key for each data row.
     *
     * Without this prop Virtuoso uses the item's array index as the key.
     * Because we decrement `firstItemIndex` on back-pagination, the virtual
     * indices of the trailing items stay constant but React sees their array
     * positions shift — which, with index-based keys, would invalidate both
     * React's reconciliation and Virtuoso's internal height cache. The
     * result is a measure-then-adjust flash where prepended items are laid
     * out, measured, and the scroll anchor is corrected a frame or two
     * later, visually shifting content.
     *
     * Keying by the item's stable id (event id / date separator key) lets
     * Virtuoso preserve measured heights across prepends so the scroll
     * compensation is applied atomically.
     */
    const computeItemKey = useCallback((_index: number, item: TimelineItem): string => item.key, []);

    // The backward (Header) spinner is intentionally omitted.
    //
    // Virtuoso's Header slot lives inside the scroll container and contributes
    // to scrollHeight. Every show/hide cycle changes scrollHeight, which forces
    // Virtuoso to issue a corrective scrollTop adjustment that the user sees as
    // a jump. Removing the Header spinner eliminates that scrollHeight change.
    //
    // The Footer (forward) spinner is kept: forward pagination appends at the
    // bottom where alignToBottom means a scrollHeight increase there does not
    // move the visible area.
    // const components = useMemo(() => {
    //     return {
    //         Footer:
    //             snapshot.forwardPagination === "loading"
    //                 ? (): ReactNode => <>{renderItem({ key: "loading-forward", kind: "loading" })}</>
    //                 : undefined,
    //     };
    // }, [snapshot.forwardPagination, renderItem]);

    // Scroll to the pending anchor when it is set and the target item is in the data
    // array. Handles both permalink navigation and scroll-position restore. We depend
    // on `snapshot.items` so we retry after each pagination batch in case the target
    // wasn't in the initial load window.
    useEffect(() => {
        const anchor = snapshot.pendingAnchor;
        if (!anchor) return;

        const arrayIndex = snapshot.items.findIndex((item) => item.key === anchor.targetKey);
        if (arrayIndex === -1) return; // not loaded yet — wait for next items update

        virtuosoRef.current?.scrollToIndex({
            index: snapshot.firstItemIndex + arrayIndex,
            align: anchor.align,
            behavior: "auto",
        });
        vm.onAnchorReached();
    }, [snapshot.pendingAnchor, snapshot.items, snapshot.firstItemIndex, vm]);

    // Don't mount Virtuoso until items are ready — ensures `initialTopMostItemIndex`
    // is passed with the correct value on Virtuoso's first mount.
    if (snapshot.items.length === 0) {
        return <div style={{ height: "100%", width: "100%" }} />;
    }

    return (
        <div ref={containerRef} style={{ height: "100%", width: "100%" }}>
            <Virtuoso
                ref={virtuosoRef}
                initialTopMostItemIndex={INITIAL_BOTTOM}
                data={snapshot.items}
                firstItemIndex={snapshot.firstItemIndex}
                // increaseViewportBy={increaseViewportBy}
                overscan={overscan}
                itemContent={itemContent}
                computeItemKey={computeItemKey}
                // components={components}
                startReached={vm.onStartReached}
                endReached={vm.onEndReached}
                followOutput={true}
                logLevel={LogLevel.DEBUG}
                alignToBottom
                style={{ height: "100%", width: "100%" }}
            />
        </div>
    );
}

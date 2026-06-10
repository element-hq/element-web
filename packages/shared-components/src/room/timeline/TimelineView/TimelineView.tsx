/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { useCallback, useEffect, useMemo, useRef, type JSX, type ReactNode, type PropsWithChildren } from "react";
import { LogLevel, Virtuoso, type ScrollIntoViewLocation, type VirtuosoHandle } from "react-virtuoso";

import { useViewModel } from "../../../core/viewmodel/useViewModel";
import type { ImmediateScroll, TimelineItem, TimelineViewProps } from "./types";
import { TimelineOverlayButtons } from "./TimelineOverlayButtons";

/**
 */

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
const DEBUG_SIZES = false;

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
                console.debug(
                    `react-virtuoso: [tile mount] ${label} key=${itemKey} ${h}px at ${performance.now().toFixed(1)}ms`,
                );
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


export function TimelineView({ vm, renderItem }: TimelineViewProps): JSX.Element {
    const snapshot = useViewModel(vm);
    const virtuosoRef = useRef<VirtuosoHandle>(null);

    // Always-current snapshot reference for callbacks that fire outside React's
    // rendering cycle (e.g. Virtuoso's scrollIntoViewOnChange).
    const snapshotRef = useRef(snapshot);
    snapshotRef.current = snapshot;

    // Guards onScroll from treating our own scrollToIndex calls as user navigation.
    // Set to true before any programmatic scroll; cleared one animation frame later.
    const isAnchorScrollInProgressRef = useRef(false);

    // Wrap each item in `display: flow-root` to establish a block formatting
    // context. Without this, vertical margins on the item's outermost element
    // collapse *through* virtuoso's item wrapper (which has no border, padding,
    // or non-zero margin of its own), so the wrapper's offsetHeight measured by
    // virtuoso's ResizeObserver under-reports actual layout space. The cumulative
    // under-report shows up as a few px of "missing" scrollTop at the bottom of
    // the timeline and small scroll-position jumps during back-pagination. A BFC
    // contains those margins inside the wrapper so the measured size matches the
    // laid-out size.
    const itemContent = useCallback(
        (_index: number, item: TimelineItem): ReactNode => {
            if (!DEBUG_SIZES) {
                return <div style={{ display: "flow-root" }}>{renderItem(item)}</div>;
            }
            const label =
                item.kind === "event" ? `event(continuation=${item.continuation})` : item.kind;
            return (
                <HeightDebugWrapper itemKey={item.key} label={label}>
                    {renderItem(item)}
                </HeightDebugWrapper>
            );
        },
        [renderItem],
    );

    const computeItemKey = useCallback((_index: number, item: TimelineItem): string => item.key, []);

    // scrollIntoViewOnChange fires on every data change (after a listRefresh cycle).
    // We use its `done` callback to imperatively scrollToIndex, which bypasses
    // defaultCalculateViewLocation's "already in view" gate (which no-ops when all
    // sizes are 0 on a cold load) and has its own 150ms retry loop that converges
    // as real item sizes arrive.
    //
    // Virtuoso's index is zero-based (0..data.length-1); firstItemIndex is display-only.
    const scrollIntoViewOnChange = useCallback(
        (_params: { context: unknown; totalCount: number; scrollingInProgress: boolean }): ScrollIntoViewLocation | false => {
            const snap = snapshotRef.current;
            const anchor = snap.pendingAnchor;
            if (!anchor) return false;

            const arrayIndex = snap.items.findIndex((item) => item.key === anchor.targetKey);
            if (arrayIndex === -1) return false;

            return {
                index: arrayIndex,
                align: anchor.align,
                behavior: "auto",
                done: () => {
                    isAnchorScrollInProgressRef.current = true;
                    virtuosoRef.current?.scrollToIndex({ index: arrayIndex, align: anchor.align, behavior: "auto" });
                    vm.onAnchorReached();
                    requestAnimationFrame(() => { isAnchorScrollInProgressRef.current = false; });
                },
            };
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );

    // Clear the pending anchor when the user scrolls, ignoring our own programmatic scrolls.
    const onScroll = useCallback(() => {
        if (!isAnchorScrollInProgressRef.current && snapshotRef.current.pendingAnchor !== null) {
            vm.onAnchorReached();
        }
    }, [vm]);

    // Imperative scroll capability handed to VM actions that may resolve to an
    // in-window scroll (jump-to-live when already at live end, jump-to-read-marker
    // when marker is in the loaded window). Reads from snapshotRef so the lookup
    // always uses the current items array, not a stale closure.
    const scrollNow = useCallback<ImmediateScroll>((anchor) => {
        const arrayIndex = snapshotRef.current.items.findIndex((i) => i.key === anchor.targetKey);
        if (arrayIndex === -1) return;
        isAnchorScrollInProgressRef.current = true;
        virtuosoRef.current?.scrollToIndex({ index: arrayIndex, align: anchor.align, behavior: "auto" });
        requestAnimationFrame(() => { isAnchorScrollInProgressRef.current = false; });
    }, []);

    // Track the visible range so the VM can persist the scroll position.
    const onRangeChanged = useCallback(
        (range: { startIndex: number; endIndex: number }) => {
            vm.onVisibleRangeChanged(range.startIndex, range.endIndex);
        },
        [vm],
    );

    // Auto-scroll to bottom for new messages only when:
    // - the user is already at the bottom of the rendered list, AND
    // - the timeline window has reached the live end, AND
    // - no anchor scroll is in progress (pendingAnchor is null).
    //
    // When `pendingAnchor` is set we pass `false` rather than a function, because
    // Virtuoso's `trapNextSizeIncrease` (followOutputSystem.ts) checks the prop's
    // identity (`!== false`), not the function's return value. As items are
    // measured during initial load the list grows, Virtuoso interprets that as
    // "user was at bottom, list grew, scroll to bottom" and would hijack the
    // anchor scroll with a scroll to LAST. Passing false outright disables that
    // path while the anchor is being resolved.
    const followOutput = useMemo<boolean | ((isAtBottom: boolean) => boolean)>(
        () => {
            if (snapshot.pendingAnchor !== null) return false;
            return (isAtBottom: boolean) => isAtBottom && snapshot.atLiveEnd;
        },
        [snapshot.atLiveEnd, snapshot.pendingAnchor],
    );

    // const EXTENDED_VIEWPORT_HEIGHT = 2000;
    // const increaseViewportBy = useMemo(
    //     () => ({
    //         top: EXTENDED_VIEWPORT_HEIGHT,
    //         bottom: EXTENDED_VIEWPORT_HEIGHT,
    //     }),
    //     [],
    // );

    // Don't mount Virtuoso until items are ready
    if (snapshot.items.length === 0) {
        return <div style={{ height: "100%", width: "100%" }} />;
    }

    return (
        <div style={{ height: "100%", width: "100%", position: "relative" }}>
            <Virtuoso
                ref={virtuosoRef}
                data={snapshot.items}
                firstItemIndex={snapshot.firstItemIndex}
                itemContent={itemContent}
                computeItemKey={computeItemKey}
                startReached={vm.onStartReached}
                atBottomStateChange={vm.onAtBottomStateChange}
                endReached={vm.onEndReached}
                followOutput={followOutput}
                scrollIntoViewOnChange={scrollIntoViewOnChange}
                onScroll={onScroll}
                rangeChanged={onRangeChanged}
                logLevel={LogLevel.ERROR}
                alignToBottom
                style={{ height: "100%", width: "100%" }}
                skipAnimationFrameInResizeObserver={true}
                // increaseViewportBy={increaseViewportBy}
            />
            <TimelineOverlayButtons snapshot={snapshot} vm={vm} scrollNow={scrollNow} />
        </div>
    );
}

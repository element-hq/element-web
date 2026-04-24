/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { useCallback, useEffect, useRef, type JSX, type ReactNode, type PropsWithChildren } from "react";
import { LogLevel, Virtuoso, type ScrollIntoViewLocation, type VirtuosoHandle } from "react-virtuoso";

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

/** Pre-render this many pixels above and below the visible viewport.
 * A large value keeps items mounted long enough for async content (avatars,
 * reactions, E2E shields) to settle before the user scrolls to them,
 * preventing the height-change → Virtuoso compensation → flicker cycle. */
// const OVERSCAN_PX = 2000;

export function TimelineView({ vm, renderItem }: TimelineViewProps): JSX.Element {
    const snapshot = useViewModel(vm);
    // eslint-disable-next-line no-console
    console.debug(`[TimelineView] render — items=${snapshot.items.length} atLiveEnd=${snapshot.atLiveEnd}`);
    const virtuosoRef = useRef<VirtuosoHandle>(null);

    // Always-current snapshot reference for callbacks that fire outside React's
    // rendering cycle (e.g. Virtuoso's scrollIntoViewOnChange).
    const snapshotRef = useRef(snapshot);
    snapshotRef.current = snapshot;

    // Guards onScroll from treating our own scrollToIndex calls as user navigation.
    // Set to true before any programmatic scroll; cleared one animation frame later
    // so that scroll events emitted by that scroll are ignored.
    const isAnchorScrollInProgressRef = useRef(false);

    const itemContent = useCallback(
        (_index: number, item: TimelineItem): ReactNode => {
            if (!DEBUG_SIZES) return renderItem(item);
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

    // scrollIntoViewOnChange fires on every data change (after a listRefresh cycle,
    // meaning at least one ResizeObserver batch has run). It gives us the right
    // timing to scroll, and we use its `done` callback to do the actual centering
    // imperatively via scrollToIndex.
    //
    // Why scrollToIndex in `done` rather than returning a location directly?
    // Virtuoso's built-in scrollIntoView path goes through defaultCalculateViewLocation
    // which returns null (no scroll) if the item appears "already in view". On a cold
    // page refresh all item sizes are 0, so itemBottom=0 ≤ viewportBottom for every
    // item — every item is "in view" — so the scroll silently no-ops. Crucially,
    // `done` fires in both cases: after a real scroll completes, AND immediately when
    // defaultCalculateViewLocation returns null. So `done` always fires, and inside it
    // we call the imperative scrollToIndex which bypasses that check entirely and has
    // its own internal retry loop (watchChangesFor 150ms on listRefresh) that converges
    // to the correct position as real item sizes arrive.
    //
    // This single branch handles all initial-scroll cases (permalink, restore-position,
    // and live-end). The VM sets pendingAnchor in load() for all three;
    // anchor.align drives the final scroll position.
    //
    // Virtuoso's scrollIntoView index is zero-based (0..data.length-1), matching the
    // internal size/offset trees. firstItemIndex is display-only (transposeItems).
    const scrollIntoViewOnChange = useCallback(
        (_params: { context: unknown; totalCount: number; scrollingInProgress: boolean }): ScrollIntoViewLocation | false => {
            const snap = snapshotRef.current;
            const anchor = snap.pendingAnchor;
            if (!anchor) return false;

            const arrayIndex = snap.items.findIndex((item) => item.key === anchor.targetKey);
            if (arrayIndex === -1) return false;

            // eslint-disable-next-line no-console
            console.debug(
                `[TimelineView][scrollIntoViewOnChange] firstItemIndex=${snap.firstItemIndex} arrayIndex=${arrayIndex} totalCount=${_params.totalCount} count=${snap.items.length} key=${anchor.targetKey} align=${anchor.align} forwardPagination=${snap.forwardPagination} backwardPagination=${snap.backwardPagination} atLiveEnd=${snap.atLiveEnd}`,
            );

            return {
                index: arrayIndex,
                align: anchor.align,
                behavior: "auto",
                done: () => {
                    // eslint-disable-next-line no-console
                    console.debug(`[TimelineView][scrollIntoViewOnChange done] arrayIndex=${arrayIndex} key=${anchor.targetKey} align=${anchor.align}`);
                    isAnchorScrollInProgressRef.current = true;
                    virtuosoRef.current?.scrollToIndex({ index: arrayIndex, align: anchor.align, behavior: "auto" });
                    requestAnimationFrame(() => { isAnchorScrollInProgressRef.current = false; });
                },
            };
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );

    // Clear the pending anchor when the user scrolls. We use Virtuoso's onScroll
    // which fires for all scroll events, combined with isAnchorScrollInProgressRef to
    // ignore scrolls we initiated ourselves via scrollToIndex.
    const onScroll = useCallback(() => {
        if (!isAnchorScrollInProgressRef.current && snapshotRef.current.pendingAnchor !== null) {
            // eslint-disable-next-line no-console
            console.debug(`[TimelineView] user scroll — clearing pendingAnchor`);
            vm.onAnchorReached();
        }
    }, [vm]);

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
    // The pendingAnchor guard prevents auto-scroll from firing while the view
    // is still navigating to a permalink or restore position, even when the
    // window happens to have reached the live end.
    const followOutput = useCallback(
        (isAtBottom: boolean) => isAtBottom && snapshot.atLiveEnd && snapshot.pendingAnchor === null,
        [snapshot.atLiveEnd, snapshot.pendingAnchor],
    );

    // Don't mount Virtuoso until items are ready
    if (snapshot.items.length === 0) {
        return <div style={{ height: "100%", width: "100%" }} />;
    }

    return (
        <div style={{ height: "100%", width: "100%" }}>
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
                logLevel={LogLevel.DEBUG}
                alignToBottom
                style={{ height: "100%", width: "100%" }}
            />
        </div>
    );
}

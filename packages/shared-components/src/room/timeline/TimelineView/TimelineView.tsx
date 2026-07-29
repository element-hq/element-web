/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState, type JSX } from "react";
import classNames from "classnames";
import { useVirtualizer, type VirtualItem, type Virtualizer } from "@tanstack/react-virtual";
import { InlineSpinner } from "@vector-im/compound-web";

import { useViewModel } from "../../../core/viewmodel/useViewModel";
import type { AnchorAlign, ImmediateScroll, TimelineItem, TimelineViewProps } from "./types";
import { BACKWARD_LOADING_KEY, FORWARD_LOADING_KEY } from "./types";
import { TimelineOverlayButtons } from "./TimelineOverlayButtons";
import styles from "./TimelineView.module.css";

/**
 * Headless TanStack virtualizer driven imperatively from `RoomTimelineViewModel`.
 * `anchorTo: "end"` keeps the viewport stable across prepends, trims and spinner toggles.
 *
 *  - History prepend: `anchorTo: "end"` re-pins before paint; the `isValidAnchorItem`
 *    patch stops it anchoring on a loading spinner whose key vanishes on batch arrival.
 *  - Stick-to-bottom: `followOnAppend`, gated on `atLiveEnd && !pendingAnchor`.
 *  - startReached/endReached: derived from the rendered range — core has no such callbacks.
 *  - Jump-to: resolve the offset and `scrollToOffset` it, never `scrollToIndex` (its
 *    reconcile chases the index across prepends; see `offsetForKey`).
 *
 * `directDomUpdates: true` writes row transforms and container height pre-paint, so
 * measure→reposition is one frame; React re-renders only on range change.
 *
 * Known gaps: `overscan` is an item count, not px; short rooms sit top-aligned.
 */

/** Seed height for not-yet-measured rows; kept near a typical chat row so the
 * estimate→measured correction stays small. TanStack caches real heights by key thereafter. */
const ESTIMATED_ITEM_HEIGHT = 48;
/** Rows rendered beyond the visible range each side — a COUNT, not px; ~16 ≈ a screenful. */
const OVERSCAN = 16;
/** px from the list bottom still counted as "at the bottom". */
const AT_BOTTOM_THRESHOLD_PX = 4;
/** Cold-load reveal cap: reveal anyway after this many frames if the anchor row
 * never lands (unreachable target), so we never strand behind the cover. */
const COLD_CAP_FRAMES = 60;

type Phase = "init" | "placing" | "live";

export function TimelineView({ vm, renderItem }: TimelineViewProps): JSX.Element {
    const snapshot = useViewModel(vm);

    // Always-current snapshot for the imperative effects/callbacks below (they run
    // outside render and must not close over a stale items array).
    const snapshotRef = useRef(snapshot);
    snapshotRef.current = snapshot;

    // Spinners are projected as edge list items (kind:"loading") so they reserve scroll
    // space that anchorTo compensates on add/remove. (anchorTo would otherwise anchor on
    // the spinner — see isValidAnchorItem below.)
    const items = snapshot.items;
    const itemsRef = useRef(items);
    itemsRef.current = items;

    const scrollerRef = useRef<HTMLDivElement | null>(null);

    // Why: an uncovered list would visibly jump as messages stream in above/below the anchor.
    // Cold-load cover: lay out hidden, place the anchor, reveal once settled.
    // One-shot (the panel is keyed on roomId).
    const [revealed, setRevealed] = useState(false);
    const revealedRef = useRef(false);

    // Stable keys (event ids) drive anchoring; core diffs getItemKey(0) across renders
    // to detect prepends/trims, so this must close over the current items.
    const getItemKey = useCallback((index: number): string => items[index]?.key ?? String(index), [items]);

    // Match spinners by STABLE key, not index: at an edge change the VirtualItem's `.index`
    // is pre-update while `items` is post-update. Keys are shared with the VM (types.ts).
    const isValidAnchorItem = useCallback(
        (item: VirtualItem): boolean => item.key !== BACKWARD_LOADING_KEY && item.key !== FORWARD_LOADING_KEY,
        [],
    );

    // ─── Phase + live-reporting state (read by the virtualizer's onChange below) ───
    const phaseRef = useRef<Phase>("init");
    // Each ref holds the last value reported to the VM, so we only notify on a real change.
    const lastVisibleRangeRef = useRef<{ start: number; end: number } | null>(null);
    const lastAtBottomRef = useRef<boolean | null>(null);
    // Pagination dedup token, "itemCount:boundaryIndex" at an edge and "" away from it —
    // re-fires as the user scrolls into freshly-loaded history.
    const startEdgeTokenRef = useRef("");
    const endEdgeTokenRef = useRef("");

    // Push virtualizer-derived state to the VM. Called from onChange — on the virtualizer's own
    // updates (range/scroll/measure), not every React commit. Read-only; suppressed until "live"
    // and while an anchor placement is pending (the range then reflects auto-placement).
    const reportVisibleState = useCallback(
        (v: Virtualizer<HTMLDivElement, Element>): void => {
            if (phaseRef.current !== "live" || snapshotRef.current.pendingAnchor !== null) return;
            const itemCount = itemsRef.current.length;
            const visibleRange = v.range;

            // Visible range (indices 0-based into items).
            if (
                visibleRange &&
                (lastVisibleRangeRef.current?.start !== visibleRange.startIndex ||
                    lastVisibleRangeRef.current?.end !== visibleRange.endIndex)
            ) {
                lastVisibleRangeRef.current = { start: visibleRange.startIndex, end: visibleRange.endIndex };
                vm.onVisibleRangeChanged(visibleRange.startIndex, visibleRange.endIndex);
            }

            // At-bottom (from measured offset/viewport/total — no forced layout read).
            const scrollOffset = v.scrollOffset ?? 0;
            const viewportHeight = v.scrollRect?.height ?? 0;
            const totalSize = v.getTotalSize();
            const atBottom = viewportHeight > 0 && scrollOffset + viewportHeight >= totalSize - AT_BOTTOM_THRESHOLD_PX;
            if (atBottom !== lastAtBottomRef.current) {
                lastAtBottomRef.current = atBottom;
                vm.onAtBottomStateChange(atBottom);
            }

            // Pagination edges from the rendered range: fire when index 0 / itemCount-1 is rendered.
            const renderedItems = v.getVirtualItems();
            const firstRenderedIndex = renderedItems.length ? renderedItems[0].index : -1;
            const lastRenderedIndex = renderedItems.length ? renderedItems[renderedItems.length - 1].index : -1;
            if (firstRenderedIndex === 0) {
                const token = `${itemCount}:${visibleRange ? visibleRange.startIndex : 0}`;
                if (startEdgeTokenRef.current !== token) {
                    startEdgeTokenRef.current = token;
                    vm.onStartReached();
                }
            } else {
                startEdgeTokenRef.current = "";
            }
            if (itemCount > 0 && lastRenderedIndex === itemCount - 1) {
                const token = `${itemCount}:${visibleRange ? visibleRange.endIndex : 0}`;
                if (endEdgeTokenRef.current !== token) {
                    endEdgeTokenRef.current = token;
                    vm.onEndReached();
                }
            } else {
                endEdgeTokenRef.current = "";
            }
        },
        [vm],
    );

    const virtualizer = useVirtualizer({
        count: items.length,
        getScrollElement: () => scrollerRef.current,
        // Used for not-yet-measured rows only: TanStack caches each measured row by key
        // and reuses it across prepends/trims/reloads, so its default measureElement is
        // enough — no need for our own size cache.
        estimateSize: () => ESTIMATED_ITEM_HEIGHT,
        getItemKey,
        overscan: OVERSCAN,
        // Chat mode: keep the visible item fixed across any edge change before paint.
        anchorTo: "end",
        // Stop anchorTo anchoring on a loading spinner, whose key vanishes when the batch
        // replaces it — that would leave the prepend un-compensated (the "jump to top").
        // Our @tanstack/virtual-core patch adds this option (pending upstream).
        isValidAnchorItem,
        // Follow tail messages only at the live end and not mid-anchored-load.
        followOnAppend: snapshot.atLiveEnd && snapshot.pendingAnchor === null,
        // Write row transforms + container height straight to the DOM pre-paint, collapsing
        // measure→reposition into one frame. Do NOT also set transform/height in JSX.
        directDomUpdates: true,
        // Report visible range / at-bottom / pagination edges to the VM on each virtualizer
        // update (range/scroll/measure) — more direct than a per-commit layout effect.
        onChange: reportVisibleState,
    });

    // Document offset placing `targetKey` at `align`, or null if off-window. Callers feed
    // this to scrollToOffset (a fixed-offset scroll), not scrollToIndex — the latter's
    // reconcile chases the index across mid-flight prepends (runaway scroll-to-top).
    const offsetForKey = useCallback(
        (targetKey: string | null, align: AnchorAlign): number | null => {
            const idx = targetKey ? itemsRef.current.findIndex((i) => i.key === targetKey) : -1;
            if (idx < 0) return null;
            const info = virtualizer.getOffsetForIndex(idx, align);
            return info ? info[0] : null;
        },
        [virtualizer],
    );
    // ─── Cold load: place the anchor hidden, settle, then reveal ───────────────
    const coldRafRef = useRef(0);
    useEffect(() => () => cancelAnimationFrame(coldRafRef.current), []);
    useLayoutEffect(() => {
        if (phaseRef.current !== "init" || items.length === 0) return;
        // Flip phase synchronously so re-runs (data arriving mid-settle) early-return.
        phaseRef.current = "placing";
        const anchor = snapshotRef.current.pendingAnchor;
        const list = itemsRef.current;
        let idx = anchor ? list.findIndex((i) => i.key === anchor.targetKey) : -1;
        if (idx < 0) idx = list.length - 1;
        const align: AnchorAlign = anchor?.align ?? "end";
        // Let core own the placement scroll (its reconcile re-targets as heights measure).
        // Don't also write scrollTop — two controllers drift the viewport.
        if (idx >= 0) virtualizer.scrollToIndex(idx, { align, behavior: "auto" });
        // Reveal once the anchor row sits at its target offset (core's landed criterion);
        // the cap covers unreachable targets so we never strand behind the cover.
        let cap = COLD_CAP_FRAMES;
        const tick = (): void => {
            const info = virtualizer.getOffsetForIndex(idx, align);
            const offset = virtualizer.scrollOffset ?? 0;
            cap -= 1;
            const landed = info !== undefined && Math.abs(info[0] - offset) <= 1.5;
            if (landed || cap <= 0) {
                phaseRef.current = "live";
                if (!revealedRef.current) {
                    revealedRef.current = true;
                    setRevealed(true);
                }
                vm.onAnchorReached();
                return;
            }
            coldRafRef.current = requestAnimationFrame(tick);
        };
        coldRafRef.current = requestAnimationFrame(tick);
    }, [items.length, virtualizer, vm]);

    // ─── Live: re-assert an in-place reload's anchor before paint ──────────────
    // (jump-to-live / read-marker reload). The read-only reporting lives in the virtualizer's
    // onChange (reportVisibleState); only the imperative pre-paint scroll write is here.
    const lastPlacedAnchorKeyRef = useRef<string | null>(null);
    useLayoutEffect(() => {
        if (phaseRef.current !== "live") return;
        const anchor = snapshotRef.current.pendingAnchor;
        if (!anchor) {
            lastPlacedAnchorKeyRef.current = null;
            return;
        }
        if (lastPlacedAnchorKeyRef.current !== anchor.targetKey) {
            const target = offsetForKey(anchor.targetKey, anchor.align);
            if (target !== null) {
                virtualizer.scrollToOffset(target);
                lastPlacedAnchorKeyRef.current = anchor.targetKey;
                vm.onAnchorReached();
            }
        }
    });

    // Imperative scroll for VM actions whose target is already in the window (jump-to-live
    // at the live end, jump-to-read-marker in range). scrollToOffset pins the resolved
    // offset and self-corrects the residual on settle.
    const scrollNow = useCallback<ImmediateScroll>(
        (anchor) => {
            const target = offsetForKey(anchor.targetKey, anchor.align);
            if (target !== null) virtualizer.scrollToOffset(target);
        },
        [offsetForKey, virtualizer],
    );

    const virtualItems = virtualizer.getVirtualItems();

    return (
        <div className={styles.root}>
            <div
                ref={scrollerRef}
                data-testid="timeline-scroller"
                tabIndex={0}
                className={classNames(styles.scroller, { [styles.hidden]: !revealed })}
            >
                {/* <ol>/<li> so screen readers announce a list. role="list" is explicit because
                    Safari+VoiceOver drop list semantics under list-style:none (as ScrollPanel does). */}
                {/* eslint-disable jsx-a11y/no-redundant-roles -- see comment above */}
                <ol
                    ref={virtualizer.containerRef}
                    className={classNames("mx_TimelineView_list", styles.list)}
                    role="list"
                >
                    {/* eslint-enable jsx-a11y/no-redundant-roles */}
                    {virtualItems.map((vi) => {
                        const item: TimelineItem | undefined = items[vi.index];
                        if (!item) return null;
                        return (
                            <li
                                key={vi.key}
                                className={classNames("mx_TimelineView_tile", styles.tile)}
                                data-index={vi.index}
                                data-key={item.key}
                                ref={virtualizer.measureElement}
                            >
                                {renderItem(item)}
                            </li>
                        );
                    })}
                </ol>
            </div>
            {!revealed && (
                <div className={styles.cover}>
                    <InlineSpinner size={32} />
                </div>
            )}
            {revealed && <TimelineOverlayButtons snapshot={snapshot} vm={vm} scrollNow={scrollNow} />}
        </div>
    );
}

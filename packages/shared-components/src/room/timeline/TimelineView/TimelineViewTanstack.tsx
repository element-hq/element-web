/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState, type JSX } from "react";
import { measureElement as defaultMeasureElement, useVirtualizer, type VirtualItem } from "@tanstack/react-virtual";
import { InlineSpinner } from "@vector-im/compound-web";

import { useViewModel } from "../../../core/viewmodel/useViewModel";
import type { AnchorAlign, ImmediateScroll, TimelineItem, TimelineViewProps } from "./types";
import { TimelineOverlayButtons } from "./TimelineOverlayButtons";
import { DEBUG_SIZES, HeightAuditProbe } from "./heightAudit";

/**
 * Experimental TanStack-Virtual implementation of the shared timeline.
 *
 * A like-for-like alternative to {@link TimelineView} (which is built on
 * react-virtuoso) that we can A/B against on the same `RoomTimelineViewModel`.
 * It exists to validate the architecture proposed in the timeline review: a
 * headless virtualizer we drive imperatively, relying on TanStack core's own
 * before-paint scroll-anchor system (`anchorTo: "end"`) instead of our patched
 * `maintainVisibleContentPosition` re-pin.
 *
 * Key differences from the Virtuoso view, and how each timeline behaviour maps:
 *
 *  - **Prepend keep-fixed (history pagination).** `anchorTo: "end"` makes core
 *    detect the edge-key change, freeze the item under the current scroll
 *    offset, and adjust scrollOffset before paint so the visible content does
 *    not lurch. This replaces our hand-rolled re-pin entirely — no patch. The
 *    loading spinner stays a real in-list item (reserved space), and we wrap
 *    `getVirtualItemForOffset` so anchorTo never picks the spinner as the anchor
 *    — its key vanishes on batch arrival — but the first real item below it (see
 *    the override near the virtualizer and the `items` comment).
 *  - **Stick-to-bottom (live messages).** `followOnAppend`, gated on
 *    `atLiveEnd && !pendingAnchor`, follows new tail messages only when the
 *    window reaches the live end and we are at the bottom (core checks
 *    `isAtEnd` internally). Mirrors the old `followOutput` predicate.
 *  - **startReached / endReached.** TanStack has no such callbacks; we derive
 *    them from the rendered (overscan-expanded) virtual items — index 0 or
 *    `count-1` being rendered means we are within overscan of an edge.
 *  - **Anchored load / jump-to.** We resolve the target row's document offset
 *    (`getOffsetForIndex`) and write `scrollTop` directly — NOT
 *    `virtualizer.scrollToIndex`, whose index-keyed reconcile loop fights
 *    `anchorTo` once history is prepended (see `offsetForKey`). The cold-load
 *    placement converges over a few frames as heights measure; this replaces
 *    `initialTopMostItemIndex` + the patched `scrollToIndexOnChange`/`done`.
 *
 * Known parity gaps to revisit if we adopt this (see review notes):
 *  - `overscan` is an item COUNT here, not Virtuoso's px `increaseViewportBy`.
 *  - `alignToBottom` for short rooms (content shorter than the viewport) is not
 *    yet reproduced — items sit at the top instead of the bottom.
 *
 * Positioning is driven by `directDomUpdates` (see the option below): row
 * transforms and the container height are written imperatively before paint,
 * and React only re-renders when the rendered range changes — matching the
 * upstream chat example so the measure→reposition path is a single frame.
 */

const useIsomorphicLayoutEffect = typeof document !== "undefined" ? useLayoutEffect : useEffect;

/** Initial seed for not-yet-measured rows, before we have any real measurements
 * to average. Deliberately near a typical chat row: too-high an estimate makes
 * every row that scrolls into view measure *shorter*, firing a downward resize
 * compensation that reads as stutter. Once rows measure, `estimateRef` (a running
 * mean of measured heights) takes over and adapts to the room's real content. */
const ESTIMATED_ITEM_HEIGHT = 48;
/** Rendered rows beyond the visible range on each side. TanStack overscan is a
 * COUNT (cf. Virtuoso's px increaseViewportBy); ~16 short rows ≈ a screenful. */
const OVERSCAN = 16;
/** px from the list bottom still counted as "at the bottom" (matches Virtuoso's default). */
const AT_BOTTOM_THRESHOLD_PX = 4;
/** Cold-load settle: reveal once measurement + scroll hold for this many frames… */
const COLD_STABLE_FRAMES = 3;
/** …or this many frames pass regardless, so we can never strand behind the cover. */
const COLD_CAP_FRAMES = 60;
/** Backward-prepend re-pin: stop once the anchor holds its captured offset for
 * this many consecutive frames… */
const REPIN_STABLE_FRAMES = 3;
/** …or this many frames elapse, so the settle loop can never run away. */
const REPIN_CAP_FRAMES = 40;

// ─── Content-jump detector (debug only) ────────────────────────────
//
// Mirror of the Virtuoso view's detector so the two can be compared on the same
// session. Every animation frame we record each rendered row's viewport-relative
// top, keyed on the STABLE item key (data-key) — TanStack's data-index shifts on
// prepend, exactly like Virtuoso's. For rows present in consecutive frames plain
// scrolling moves them by -ΔscrollTop, so median(Δtop) + ΔscrollTop is the
// content visibly jumping under the viewport.
const DEBUG_JUMPS = true;
const JUMP_THRESHOLD_PX = 3;

function useContentJumpDetector(scrollerRef: React.MutableRefObject<HTMLElement | null>): void {
    useEffect(() => {
        if (!DEBUG_JUMPS) return;
        let raf = 0;
        let prev: { scrollTop: number; tops: Map<string, number>; t: number } | null = null;
        const tick = (): void => {
            raf = requestAnimationFrame(tick);
            const scroller = scrollerRef.current;
            if (!scroller) {
                prev = null;
                return;
            }
            const scrollerTop = scroller.getBoundingClientRect().top;
            const tops = new Map<string, number>();
            for (const el of scroller.querySelectorAll<HTMLElement>("[data-key]")) {
                tops.set(el.dataset.key!, el.getBoundingClientRect().top - scrollerTop);
            }
            const sample = { scrollTop: scroller.scrollTop, tops, t: Math.round(performance.now()) };
            if (prev) {
                const deltas: number[] = [];
                for (const [key, top] of tops) {
                    const old = prev.tops.get(key);
                    if (old !== undefined) deltas.push(top - old);
                }
                if (deltas.length >= 3) {
                    deltas.sort((a, b) => a - b);
                    const median = deltas[Math.floor(deltas.length / 2)];
                    const jump = median + (sample.scrollTop - prev.scrollTop);
                    if (Math.abs(jump) >= JUMP_THRESHOLD_PX) {
                        // eslint-disable-next-line no-console
                        console.debug(
                            `[TimelineViewTanstack] CONTENT-JUMP ${Math.round(jump)}px — rows moved ${Math.round(median)}px, ` +
                                `scrollTop Δ${Math.round(sample.scrollTop - prev.scrollTop)}px, frameGap=${sample.t - prev.t}ms, ts=${sample.t}`,
                        );
                    }
                }
            }
            prev = sample;
        };
        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, [scrollerRef]);
}

type Phase = "init" | "placing" | "live";

export function TimelineViewTanstack({ vm, renderItem }: TimelineViewProps): JSX.Element {
    const snapshot = useViewModel(vm);

    // Always-current snapshot for the imperative callbacks/effects below, which
    // run outside React's render and must not close over a stale items array.
    const snapshotRef = useRef(snapshot);
    snapshotRef.current = snapshot;

    // The spinners are VM "projection-only" list items at the very edges (see
    // RoomTimelineViewModel.republish): the VM layers them onto baseItems and
    // already decrements firstItemIndex while the backward spinner shows, so real
    // events keep stable absolute indices. We feed the FULL list (spinner
    // included) to the virtualizer — that is what gives the spinner reserved space
    // in the scroll content and lets anchorTo compensate its add/remove via core's
    // edge-change path (the same reason the VM renders them as real list items).
    //
    // The one TanStack-specific catch: anchorTo chooses the anchor as the item at
    // the current scroll offset (getVirtualItemForOffset). At the very top that is
    // the backward spinner, and its key vanishes when the batch replaces it,
    // leaving the prepend un-compensated (the original "jump to top"). We solve it
    // by wrapping getVirtualItemForOffset to skip loading items, i.e. anchoring on
    // the first real item below the spinner (see the override effect below).
    const items = snapshot.items;
    const itemsRef = useRef(items);
    itemsRef.current = items;

    const scrollerRef = useRef<HTMLDivElement | null>(null);

    // Cold-load cover: the list lays out hidden, we place the anchor, and only
    // reveal once placement settles. One-shot (the panel is keyed on roomId).
    const [revealed, setRevealed] = useState(false);
    const revealedRef = useRef(false);

    // getItemKey must be a FRESH closure over the current items each render: core
    // compares prevOptions.getItemKey(0) vs the new one to detect prepends/trims,
    // and setOptions re-runs every render, so the previous closure is the prior
    // items array. Stable keys (event ids, etc.) are what make anchoring work.
    const getItemKey = useCallback((index: number): string => items[index]?.key ?? String(index), [items]);

    // Adaptive height estimate: a running mean of measured row heights, keyed so
    // re-measures of the same row replace (not double-count) its contribution. A
    // close estimate keeps the estimate→measured delta — and thus the resize
    // compensation that fires as rows scroll into view — small, which is what stops
    // the slow-scroll stutter.
    const estimateRef = useRef(ESTIMATED_ITEM_HEIGHT);
    const sizeByKeyRef = useRef<Map<string, number>>(new Map());
    const sizeSumRef = useRef(0);

    // Keep anchorTo from ever choosing a loading spinner as the scroll anchor.
    // anchorTo picks the item at the current scroll offset and re-pins it BY KEY
    // after the rebuild; at the top that item is the backward spinner, whose key
    // vanishes when the batch replaces it — so the prepend would be left
    // un-compensated (the "jump to top"). `isValidAnchorItem` (added via our
    // @tanstack/virtual-core patch — see patches/@tanstack__virtual-core@3.17.1.patch)
    // makes core skip items we reject and anchor on the nearest real item, whose
    // key survives the batch, so the prepend and the spinner's own add/remove are
    // absorbed by core's edge-change compensation. It is not in the upstream
    // option types, so we attach it via a typed spread below (excess-property
    // checks don't apply to spread props; ReactVirtualizerOptions is an
    // intersection alias and so can't be augmented).
    const anchorPatch = {
        isValidAnchorItem: (item: VirtualItem): boolean => {
            // Identify spinners by their STABLE key, never by indexing into the
            // items array: at the batch-arrival edge change the VirtualItem's
            // `.index` is in the PRE-update measurement space (spinner at 0) while
            // our items array is already the POST-update list (a real event at 0),
            // so indexing tests the wrong row and the spinner slips through. The
            // keys mirror RoomTimelineViewModel.BACKWARD_LOADING_KEY /
            // FORWARD_LOADING_KEY (event keys are "$…", separators "date-…", so
            // these never collide).
            const isLoading = item.key === "backward-loading" || item.key === "forward-loading";
            if (DEBUG_JUMPS && isLoading) {
                // eslint-disable-next-line no-console
                console.debug(
                    `[TimelineViewTanstack] anchor: rejecting loading item idx=${item.index} key=${item.key}`,
                );
            }
            return !isLoading;
        },
    };

    const virtualizer = useVirtualizer({
        count: items.length,
        getScrollElement: () => scrollerRef.current,
        estimateSize: () => Math.round(estimateRef.current),
        measureElement: (element, entry, instance) => {
            const size = defaultMeasureElement(element, entry, instance);
            if (size > 0) {
                const key = String(instance.options.getItemKey(instance.indexFromElement(element)));
                const map = sizeByKeyRef.current;
                const prev = map.get(key);
                if (prev !== undefined) sizeSumRef.current -= prev;
                map.set(key, size);
                sizeSumRef.current += size;
                estimateRef.current = sizeSumRef.current / map.size;
            }
            return size;
        },
        getItemKey,
        overscan: OVERSCAN,
        // Chat-timeline mode: keep the visible item fixed across any edge change
        // (prepend / trim / spinner add-remove) before paint, and enable
        // follow-on-append below.
        anchorTo: "end",
        // Skip loading spinners as anchor candidates (see anchorPatch above).
        ...anchorPatch,
        // Follow new tail messages only at the live end and not mid-anchored-load,
        // and core additionally only follows when already at the bottom.
        followOnAppend: snapshot.atLiveEnd && snapshot.pendingAnchor === null,
        // Drive row positions and the container height imperatively (the lib
        // writes `transform`/`height` directly to the DOM in a pre-paint layout
        // effect) instead of through React. This collapses the measure→reposition
        // path into a single synchronous frame: on a pure scroll, the
        // first-measurement resize compensation and the row's new transform land
        // together before paint, with no intervening React commit. Without this we
        // paid an extra React-render frame between measuring a row and moving it,
        // which compounded the estimate→actual transient into visible stutter.
        // `onChange` still re-renders React when the rendered *range* changes (new
        // items in/out), so our renderItem set stays correct. Mode defaults to
        // "transform"; we must NOT also set transform/height in JSX (see render).
        directDomUpdates: true,
    });

    // Diagnostic: scrollOffset captured right after useVirtualizer — i.e. after
    // setOptions ran this render, which is where anchorTo applies its eager
    // pre-paint adjustment. If anchorTo compensated a prepend, this is already the
    // pushed-up value; the count-change log compares it to the post-commit value.
    const postSetOptionsOffsetRef = useRef<number | null>(null);
    postSetOptionsOffsetRef.current = virtualizer.scrollOffset;

    useContentJumpDetector(scrollerRef as React.MutableRefObject<HTMLElement | null>);

    // Document offset that puts `targetKey` at `align` in the viewport, or null
    // when the key is not in the loaded window.
    //
    // We deliberately do NOT scroll via virtualizer.scrollToIndex. scrollToIndex
    // installs a reconcile loop keyed on a FIXED array index that keeps
    // re-scrolling to that index every frame until it settles. If history is
    // prepended while it is still running (cold-load convergence racing the first
    // back-pagination, or a jump just before the user scrolls up), that index now
    // points at older content, so the loop drags the viewport toward the top —
    // fighting anchorTo's prepend compensation and triggering runaway
    // back-pagination. Resolving an offset and writing scrollTop ourselves leaves
    // no such loop, so prepends are handled purely by anchorTo: "end".
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
    const phaseRef = useRef<Phase>("init");
    const coldRafRef = useRef(0);
    useEffect(() => () => cancelAnimationFrame(coldRafRef.current), []);
    useIsomorphicLayoutEffect(() => {
        if (phaseRef.current !== "init" || items.length === 0) return;
        // Flip phase synchronously so re-runs (more data arriving mid-settle)
        // early-return rather than restarting placement. No pagination fires until
        // we reach "live", so the list does not change while we converge.
        phaseRef.current = "placing";
        const anchor = snapshotRef.current.pendingAnchor;
        const list = itemsRef.current;
        let idx = anchor ? list.findIndex((i) => i.key === anchor.targetKey) : -1;
        if (idx < 0) idx = list.length - 1;
        const align: AnchorAlign = anchor?.align ?? "end";
        // Place via scrollToIndex and let TanStack own the scroll: its reconcile
        // re-targets as estimate heights become real, and its resize compensation
        // writes scrollTop to keep content stable. We must NOT also write scrollTop
        // ourselves — two controllers fighting is what drifted the viewport to the
        // top. Pagination stays gated until "live", so no prepend shifts the
        // index-keyed reconcile mid-converge, and waiting for quiescence below means
        // the reconcile has cleared before we go live — so it can't fight anchorTo.
        if (idx >= 0) virtualizer.scrollToIndex(idx, { align, behavior: "auto" });
        // Reveal once BOTH measurement (totalSize) and scroll position hold steady
        // for a few frames — i.e. heights have settled and the placement landed.
        let stable = 0;
        let cap = COLD_CAP_FRAMES;
        let lastTotal = NaN;
        let lastScroll = NaN;
        const tick = (): void => {
            const total = virtualizer.getTotalSize();
            const scroll = scrollerRef.current?.scrollTop ?? 0;
            const totalStable = !Number.isNaN(lastTotal) && Math.abs(total - lastTotal) < 1;
            const scrollStable = !Number.isNaN(lastScroll) && Math.abs(scroll - lastScroll) < 1;
            lastTotal = total;
            lastScroll = scroll;
            if (totalStable && scrollStable) stable += 1;
            else stable = 0;
            cap -= 1;
            if (stable >= COLD_STABLE_FRAMES || cap <= 0) {
                if (DEBUG_JUMPS) {
                    // eslint-disable-next-line no-console
                    console.debug(
                        `[TimelineViewTanstack] cold-load reveal — scrollTop=${Math.round(scroll)}, ` +
                            `total=${Math.round(total)}, cappedOut=${cap <= 0}`,
                    );
                }
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

    // ─── Live: anchored reloads, visible range, at-bottom, pagination ──────────
    const lastPlacedRef = useRef<string | null>(null);
    const visRef = useRef<{ s: number; e: number } | null>(null);
    const atBottomRef = useRef<boolean | null>(null);
    // Edge-trigger dedup signature: "count:visibleBoundaryIndex" while at the edge,
    // "" when away from it. Re-fires when either count or the visible boundary
    // moves, so scrolling into freshly-loaded history keeps pagination going.
    const startSigRef = useRef("");
    const endSigRef = useRef("");
    const prevCountRef = useRef(0);

    // ─── Backward-prepend re-pin (measurement-based before-paint correction) ────
    //
    // anchorTo:"end" compensates a prepend by placing the captured anchor from the
    // measurements available at setOptions time — but the just-prepended rows are
    // unmeasured then, so their height comes from estimateSize. Only the rows that
    // actually render get corrected (resizeItem's above-viewport adjustment); the
    // off-screen ones beyond overscan never measure, so their estimate error stays
    // baked into scrollOffset and the anchor lands mis-placed. Empirically this is
    // a sustained ±200-350px shift, worst when flung to the very top (every
    // prepended row is off-screen, hence estimated) — matching "fling-to-top
    // jumps, slow scroll fine". anchorTo alone is therefore insufficient; this is
    // the TanStack analogue of the Virtuoso maintainVisibleContentPosition re-pin.
    //
    // Fix: remember the top real row + its on-screen offset every settled frame,
    // and when a backward prepend lands (firstItemIndex dropped) restore that row
    // to its captured offset from its ACTUAL post-commit position — vi.start minus
    // scrollOffset, which equals what the user sees, independent of the off-screen
    // estimate. Done synchronously first (before paint, so no 1-frame flash) then
    // over a few rAF frames as late measurements (images, reply previews) settle.
    const pinRef = useRef<{ key: string; offset: number } | null>(null);
    const repinRafRef = useRef(0);
    const prevFirstItemIndexRef = useRef<number | null>(null);
    useEffect(() => () => cancelAnimationFrame(repinRafRef.current), []);

    // The top real (non-loading) rendered row and its on-screen offset. We read
    // the row's MEASURED rect (getBoundingClientRect), not vi.start - scrollOffset:
    // the latter goes stale at a prepend commit because anchorTo writes the DOM
    // scrollTop synchronously but the virtualizer's own scrollOffset only catches
    // up on the async scroll event — so reading its geometry there would yield the
    // pre-correction value. The rect is what the user actually sees, and matches
    // what repinToPin restores to, so capture and restore stay consistent.
    const readTopAnchor = useCallback((): { key: string; offset: number } | null => {
        const scroller = scrollerRef.current;
        if (!scroller) return null;
        const scrollerTop = scroller.getBoundingClientRect().top;
        for (const node of scroller.querySelectorAll<HTMLElement>("[data-key]")) {
            const key = node.dataset.key!;
            if (key !== "backward-loading" && key !== "forward-loading") {
                return { key, offset: node.getBoundingClientRect().top - scrollerTop };
            }
        }
        return null;
    }, []);

    // Snap scrollTop so the captured anchor row returns to its captured on-screen
    // offset, measured from its REAL rect (see readTopAnchor — vi.start-scrollOffset
    // is stale at the prepend commit by exactly the placement error we're undoing).
    // Reading the rect here lets the synchronous call land the anchor before the
    // commit paints, so there is no 1-frame flash. Returns true when already
    // aligned (nothing to do / anchor scrolled out of the rendered window).
    const repinToPin = useCallback((): boolean => {
        const target = pinRef.current;
        const scroller = scrollerRef.current;
        if (!target || !scroller) return true;
        const scrollerTop = scroller.getBoundingClientRect().top;
        for (const node of scroller.querySelectorAll<HTMLElement>("[data-key]")) {
            if (node.dataset.key === target.key) {
                const delta = node.getBoundingClientRect().top - scrollerTop - target.offset;
                if (Math.abs(delta) >= 1) {
                    scroller.scrollTop += delta;
                    return false;
                }
                return true;
            }
        }
        return true;
    }, []);

    // Keep correcting for a few frames after the synchronous snap, until the
    // anchor holds steady (late measurements landed) or the cap elapses.
    const startRepinSettle = useCallback((): void => {
        if (repinRafRef.current) cancelAnimationFrame(repinRafRef.current);
        let stable = 0;
        let cap = REPIN_CAP_FRAMES;
        const tick = (): void => {
            stable = repinToPin() ? stable + 1 : 0;
            cap -= 1;
            if (stable >= REPIN_STABLE_FRAMES || cap <= 0) {
                repinRafRef.current = 0;
                return;
            }
            repinRafRef.current = requestAnimationFrame(tick);
        };
        repinRafRef.current = requestAnimationFrame(tick);
    }, [repinToPin]);

    useIsomorphicLayoutEffect(() => {
        if (phaseRef.current !== "live") return;
        const v = virtualizer;
        const snap = snapshotRef.current;
        const count = itemsRef.current.length;
        // The virtualizer index IS the VM's published-array index, and the VM
        // defines firstItemIndex so that absoluteIndex = firstItemIndex + arrayIndex
        // (it already decrements firstItemIndex while the backward spinner shows).
        // So no loader offset is needed now that the spinner is a real list item.
        const toAbsolute = (index: number): number => snap.firstItemIndex + index;

        // Detect a backward prepend (content added at the start): the VM drops
        // firstItemIndex when it prepends history (and by 1 when the backward
        // spinner appears). Computed before the early-returns below so the
        // comparison stays correct across pendingAnchor reloads.
        const backwardPrepend =
            prevFirstItemIndexRef.current !== null && snap.firstItemIndex < prevFirstItemIndexRef.current;
        prevFirstItemIndexRef.current = snap.firstItemIndex;

        // Diagnostic: on every item-count change (prepend / trim) log the scroll
        // position and the first rendered index AFTER anchorTo has run (it applies
        // in the virtualizer's own layout effect, before this one). If a prepend
        // kept us pinned, scrollOffset jumps up by ~the batch height and
        // firstRenderedIdx stays well above 0; if it did NOT pin, scrollOffset
        // stays ~0 and firstRenderedIdx is 0 (we are stranded at the new top).
        if (DEBUG_JUMPS && count !== prevCountRef.current) {
            const vis = v.getVirtualItems();
            // eslint-disable-next-line no-console
            console.debug(
                `[TimelineViewTanstack] items ${prevCountRef.current}→${count} — ` +
                    `postSetOptionsOffset=${Math.round(postSetOptionsOffsetRef.current ?? -1)}, ` +
                    `scrollOffset=${Math.round(v.scrollOffset ?? 0)}, firstRenderedIdx=${vis.length ? vis[0].index : -1}, ` +
                    `total=${Math.round(v.getTotalSize())}, anchorTo=${String((v.options as { anchorTo?: string }).anchorTo)}, ` +
                    `hasScrollEl=${!!v.scrollElement}`,
            );
            prevCountRef.current = count;
        }

        // In-place reload (jump-to-live / jump-to-read-marker out of window): the
        // VM set pendingAnchor again. Re-assert it, then settle immediately — the
        // reload already has its content.
        if (snap.pendingAnchor) {
            const sig = snap.pendingAnchor.targetKey;
            if (lastPlacedRef.current !== sig) {
                const target = offsetForKey(sig, snap.pendingAnchor.align);
                if (target !== null) {
                    if (scrollerRef.current) scrollerRef.current.scrollTop = target;
                    lastPlacedRef.current = sig;
                    vm.onAnchorReached();
                }
            }
            return;
        }
        lastPlacedRef.current = null;

        // Re-pin after a backward prepend: anchorTo placed the anchor from
        // estimated heights, so restore it from the row's real post-commit
        // position. Synchronous first (corrects before this commit paints, so no
        // 1-frame flash), then a short rAF settle for late measurements. While
        // idle, keep the intended anchor fresh so the next prepend has an accurate
        // target — but never overwrite it mid-settle.
        if (backwardPrepend && pinRef.current) {
            repinToPin();
            startRepinSettle();
        } else if (repinRafRef.current === 0) {
            const a = readTopAnchor();
            if (a) pinRef.current = a;
        }

        // Visible range (core's `range` is the visible span, overscan excluded).
        const r = v.range;
        if (r && (visRef.current?.s !== r.startIndex || visRef.current?.e !== r.endIndex)) {
            visRef.current = { s: r.startIndex, e: r.endIndex };
            vm.onVisibleRangeChanged(toAbsolute(r.startIndex), toAbsolute(r.endIndex));
        }

        // At-bottom (from measured offset/viewport/total — no forced layout read).
        const offset = v.scrollOffset ?? 0;
        const viewport = v.scrollRect?.height ?? 0;
        const total = v.getTotalSize();
        const atBottom = viewport > 0 && offset + viewport >= total - AT_BOTTOM_THRESHOLD_PX;
        if (atBottom !== atBottomRef.current) {
            atBottomRef.current = atBottom;
            vm.onAtBottomStateChange(atBottom);
        }

        // Pagination edges, from the rendered (overscan-expanded) items. Fire when
        // index 0 / count-1 is rendered (within overscan of an edge). We key the
        // dedup on count AND the visible-range boundary, not count alone: after a
        // batch pins us we can still be rendering index 0 (within overscan) with an
        // unchanged count, and the user then scrolls up *into* the freshly-loaded
        // history — the visible range moves even though count hasn't, and that must
        // re-fire so pagination continues instead of stalling until a manual
        // scroll-away-and-back. The VM coalesces redundant calls.
        const vItems = v.getVirtualItems();
        const firstIdx = vItems.length ? vItems[0].index : -1;
        const lastIdx = vItems.length ? vItems[vItems.length - 1].index : -1;
        const r2 = v.range;
        if (firstIdx === 0) {
            const sig = `${count}:${r2 ? r2.startIndex : 0}`;
            if (startSigRef.current !== sig) {
                startSigRef.current = sig;
                vm.onStartReached();
            }
        } else {
            startSigRef.current = "";
        }
        if (count > 0 && lastIdx === count - 1) {
            const sig = `${count}:${r2 ? r2.endIndex : 0}`;
            if (endSigRef.current !== sig) {
                endSigRef.current = sig;
                vm.onEndReached();
            }
        } else {
            endSigRef.current = "";
        }
    });

    // Imperative scroll for VM actions whose target is already in the window
    // (jump-to-live at the live end, jump-to-read-marker in range).
    const scrollNow = useCallback<ImmediateScroll>(
        (anchor) => {
            const apply = (): void => {
                const target = offsetForKey(anchor.targetKey, anchor.align);
                if (target !== null && scrollerRef.current) scrollerRef.current.scrollTop = target;
            };
            apply();
            // One more frame: the freshly-targeted rows may measure and shift the
            // offset slightly after the first write. Direct scrollTop again — no
            // scrollToIndex, so no index-keyed reconcile that a later prepend
            // could turn into a runaway scroll-to-top.
            requestAnimationFrame(apply);
        },
        [offsetForKey],
    );

    // TEMP debug aid (gated on DEBUG_JUMPS): jump straight to scrollTop 0 so a
    // backward pagination can be triggered deterministically — parked exactly at
    // the spinner — and the resulting post-prepend shift read cleanly off the
    // CONTENT-JUMP log, instead of having to fling the wheel. Instant (not smooth)
    // so it lands in one frame. Remove together with DEBUG_JUMPS.
    const jumpToTop = useCallback((): void => {
        const scroller = scrollerRef.current;
        if (scroller) scroller.scrollTop = 0;
    }, []);

    const virtualItems = virtualizer.getVirtualItems();

    return (
        <div style={{ height: "100%", width: "100%", position: "relative" }}>
            <div
                ref={scrollerRef}
                data-testid="timeline-tanstack-scroller"
                style={{
                    height: "100%",
                    width: "100%",
                    overflowY: "auto",
                    // Disable the browser's native scroll anchoring; core owns it.
                    overflowAnchor: "none",
                    visibility: revealed ? "visible" : "hidden",
                }}
            >
                {/* Sizer height is written imperatively by the virtualizer via
                    containerRef (directDomUpdates); do NOT set height here. */}
                <div ref={virtualizer.containerRef} style={{ width: "100%", position: "relative" }}>
                    {virtualItems.map((vi) => {
                        const item: TimelineItem | undefined = items[vi.index];
                        if (!item) return null;
                        return (
                            <div
                                key={vi.key}
                                data-index={vi.index}
                                data-key={item.key}
                                ref={virtualizer.measureElement}
                                // No `transform` here: with directDomUpdates the
                                // virtualizer writes each row's translate3d directly
                                // (keyed via measureElement's elementsCache) in the
                                // pre-paint layout effect. Setting it in JSX too would
                                // double-write and fight on re-render.
                                style={{
                                    position: "absolute",
                                    top: 0,
                                    left: 0,
                                    width: "100%",
                                    overflowAnchor: "none",
                                }}
                            >
                                {DEBUG_SIZES ? (
                                    <HeightAuditProbe
                                        itemKey={item.key}
                                        baseLabel={item.kind === "event" ? "event" : item.kind}
                                    >
                                        {renderItem(item)}
                                    </HeightAuditProbe>
                                ) : (
                                    renderItem(item)
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
            {/* Loading spinners are real in-list items now (kind:"loading",
                rendered by renderItem), so they occupy reserved space and are
                compensated by anchorTo via the getVirtualItemForOffset override
                above — no viewport overlay needed. */}
            {!revealed && (
                <div
                    style={{
                        position: "absolute",
                        inset: 0,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                    }}
                >
                    <InlineSpinner size={32} />
                </div>
            )}
            {revealed && <TimelineOverlayButtons snapshot={snapshot} vm={vm} scrollNow={scrollNow} />}
            {/* TEMP debug-only control — disappears when DEBUG_JUMPS is turned off. */}
            {DEBUG_JUMPS && revealed && (
                <button
                    type="button"
                    onClick={jumpToTop}
                    style={{
                        position: "absolute",
                        top: 8,
                        left: 8,
                        zIndex: 1000,
                        padding: "4px 8px",
                        fontSize: 12,
                        lineHeight: 1.2,
                        background: "var(--cpd-color-bg-action-primary-rest, #0dbd8b)",
                        color: "var(--cpd-color-text-on-solid-primary, #fff)",
                        border: "none",
                        borderRadius: 4,
                        cursor: "pointer",
                    }}
                >
                    ↑ Jump to top (debug)
                </button>
            )}
        </div>
    );
}

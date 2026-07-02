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
 * TanStack-Virtual implementation of the shared timeline: a headless
 * virtualizer we drive imperatively on the `RoomTimelineViewModel`, relying on
 * TanStack core's own before-paint scroll-anchor system (`anchorTo: "end"`) to
 * keep the viewport stable across prepends, trims and spinner toggles.
 *
 * How each timeline behaviour maps onto the virtualizer:
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
 * Known gaps (see review notes):
 *  - `overscan` is an item COUNT, not a px viewport margin.
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
 * COUNT (not a px viewport margin); ~16 short rows ≈ a screenful. */
const OVERSCAN = 16;
/** px from the list bottom still counted as "at the bottom". */
const AT_BOTTOM_THRESHOLD_PX = 4;
/** Cold-load settle: reveal once measurement + scroll hold for this many frames… */
const COLD_STABLE_FRAMES = 3;
/** …or this many frames pass regardless, so we can never strand behind the cover. */
const COLD_CAP_FRAMES = 60;

// ─── Content-jump detector (debug only) ────────────────────────────
//
// Debug-only. Every animation frame we record each rendered row's
// viewport-relative top, keyed on the STABLE item key (data-key) — the
// data-index shifts on prepend. For rows present in consecutive frames plain
// scrolling moves them by -ΔscrollTop, so median(Δtop) + ΔscrollTop is the
// content visibly jumping under the viewport.
const DEBUG_JUMPS = true;
const JUMP_THRESHOLD_PX = 3;

function useContentJumpDetector(scrollerRef: React.MutableRefObject<HTMLElement | null>): void {
    useEffect(() => {
        if (!DEBUG_JUMPS) return;
        let raf = 0;
        let prev: { scrollTop: number; tops: Map<string, number>; t: number } | null = null;
        // Ground truth: when did the user last actually drive the scroll? A
        // scrollTop change with NO recent input is code-driven — i.e. a real jump.
        // A change WITH recent input is just the user flinging and is expected.
        let lastInput = -1e9;
        const markInput = (): void => {
            lastInput = performance.now();
        };
        const inputEvents = ["wheel", "touchstart", "touchmove", "keydown", "pointerdown"] as const;
        for (const ev of inputEvents) {
            window.addEventListener(ev, markInput, { passive: true, capture: true });
        }
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
                    const maxDelta = deltas.reduce((m, d) => (Math.abs(d) > Math.abs(m) ? d : m), 0);
                    const jump = median + (sample.scrollTop - prev.scrollTop);
                    if (Math.abs(jump) >= JUMP_THRESHOLD_PX) {
                        // userScroll=yes means a wheel/touch/key fired within 120ms of
                        // this frame, so any scrollTop change is the user's own input.
                        // userScroll=no on a frame with a scrollTop change = code wrote
                        // scrollTop = a real jump/lurch the user did not ask for.
                        const userScroll = sample.t - lastInput < 120;
                        // eslint-disable-next-line no-console
                        console.debug(
                            `[TimelineView] CONTENT-JUMP ${Math.round(jump)}px — rows moved ${Math.round(median)}px, ` +
                                `scrollTop Δ${Math.round(sample.scrollTop - prev.scrollTop)}px, ` +
                                `userScroll=${userScroll ? "yes" : "NO"}, common=${deltas.length}, maxRowΔ=${Math.round(maxDelta)}px, ` +
                                `frameGap=${sample.t - prev.t}ms, ts=${sample.t}`,
                        );
                    }
                }
            }
            prev = sample;
        };
        raf = requestAnimationFrame(tick);
        return () => {
            cancelAnimationFrame(raf);
            for (const ev of inputEvents) {
                window.removeEventListener(ev, markInput, { capture: true } as EventListenerOptions);
            }
        };
    }, [scrollerRef]);
}

type Phase = "init" | "placing" | "live";

export function TimelineView({ vm, renderItem }: TimelineViewProps): JSX.Element {
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
    // ─── Measure-and-reveal buffer ──────────────────────────────────────────────
    // The virtualizer is driven by `committed`, NOT directly by snapshot.items.
    // For a backward history prepend we hold the freshly-fetched batch back one
    // cycle: render it off-screen in the sidecar, measure its real heights into
    // sizeByKeyRef, and only THEN commit it. So when anchorTo processes the prepend
    // it places against real heights (via estimateSize reading the seeded cache)
    // instead of the 48px guess — removing the fling-to-top jump AND the resize
    // "resistance" while scrolling up (no estimate→actual delta left to
    // compensate). All other updates (cold load, reloads, tail appends, trims,
    // spinner toggles) commit straight through. See the reconcile/measure effects.
    const [committed, setCommitted] = useState<{ items: TimelineItem[]; firstItemIndex: number }>(() => ({
        items: snapshot.items,
        firstItemIndex: snapshot.firstItemIndex,
    }));
    const committedRef = useRef(committed);
    committedRef.current = committed;
    const items = committed.items;
    const itemsRef = useRef(items);
    itemsRef.current = items;

    // The batch currently being measured off-screen (non-empty only between a VM
    // prepend and our commit of it). `pendingCommitRef` holds the snapshot to
    // commit once those heights are seeded.
    const [sidecarItems, setSidecarItems] = useState<TimelineItem[]>([]);
    const sidecarRef = useRef<HTMLLIElement | null>(null);
    const pendingCommitRef = useRef<{ items: TimelineItem[]; firstItemIndex: number } | null>(null);

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
                    `[TimelineView] anchor: rejecting loading item idx=${item.index} key=${item.key}`,
                );
            }
            return !isLoading;
        },
    };

    const virtualizer = useVirtualizer({
        count: items.length,
        getScrollElement: () => scrollerRef.current,
        estimateSize: (index) => {
            // Use the row's real measured height when known — crucially including
            // heights seeded by the sidecar measure pass BEFORE the batch is
            // committed, which is what lets anchorTo place a just-prepended batch
            // against real heights. Falls back to the running mean for unseen rows.
            const key = items[index]?.key;
            const cached = key !== undefined ? sizeByKeyRef.current.get(key) : undefined;
            return Math.round(cached ?? estimateRef.current);
        },
        measureElement: (element, entry, instance) => {
            const size = defaultMeasureElement(element, entry, instance);
            if (size > 0) {
                const key = String(instance.options.getItemKey(instance.indexFromElement(element)));
                const map = sizeByKeyRef.current;
                const prev = map.get(key);
                if (DEBUG_JUMPS && prev !== undefined && Math.abs(size - prev) > 50) {
                    // A row re-measuring far from its cached/seeded height is what
                    // anchorTo compensates with a scrollTop write — the post-commit
                    // lurch. Naming the row (key → event id) and the kind tells us
                    // WHAT grows late (encrypted image load, reply resolve, etc.).
                    const idx = instance.indexFromElement(element);
                    const kind = itemsRef.current[idx]?.kind;
                    // eslint-disable-next-line no-console
                    console.debug(
                        `[TimelineView] RESIZE key=${key} kind=${kind} prev=${Math.round(prev)}→${Math.round(size)} ` +
                            `Δ=${Math.round(size - prev)}px idx=${idx}`,
                    );
                }
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
                        `[TimelineView] cold-load reveal — scrollTop=${Math.round(scroll)}, ` +
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

    // ─── Measure-and-reveal reconcile: sync `committed` to the VM, routing a
    // freshly-prepended history batch through the off-screen sidecar first ───────
    useIsomorphicLayoutEffect(() => {
        // Before the cold-load anchor settles, and during in-place reloads
        // (pendingAnchor), the placement paths own the scroll and must see the VM
        // data immediately — no measure buffer in front of them.
        if (phaseRef.current !== "live" || snapshot.pendingAnchor !== null) {
            if (committed.items !== snapshot.items) {
                setCommitted({ items: snapshot.items, firstItemIndex: snapshot.firstItemIndex });
            }
            return;
        }
        if (committed.items === snapshot.items) return; // already in sync

        // Measure-first invariant: a row that first paints at an estimated height
        // and then settles taller shifts the rows above it — a jump. Hold such a
        // row back, measure it off-screen, and commit only once its real height is
        // seeded. The hold must catch exactly the rows that are
        //   (a) NEW in this snapshot (a key not previously committed),
        //   (b) at or above the viewport BOTTOM — with anchorTo:"end" the anchor
        //       sits near the bottom, so a row growing there pushes visible content
        //       UP; rows below only ever push content down and need no pre-measure,
        //   (c) NOT a tail append — those stick to the bottom via followOnAppend and
        //       must commit immediately, never wait a measure cycle.
        //
        // It must key off "new this snapshot", NOT "unmeasured anywhere": history
        // that was loaded but never rendered is also unmeasured, and sweeping it
        // through the sidecar on every unrelated update (live append, read marker,
        // decrypt no-op) churns the commit and itself causes jumps.
        //
        // New rows arrive as a FRONT history prepend or — in encrypted rooms — a
        // decrypt-flush revealing a previously-filtered event in place, which can
        // land within the viewport above the anchor.
        const committedItems = committed.items;
        const committedKeys = new Set(committedItems.map((i) => i.key));
        const rendered = virtualizer.getVirtualItems();
        // Bottom of the rendered range, mapped into the NEW list: the lowest row
        // whose late growth could lurch visible content. -1 if it can't be located
        // (rendered range empty/raced) — then we bound by the last committed row.
        const boundaryKey =
            rendered.length > 0 ? committedItems[rendered[rendered.length - 1].index]?.key : undefined;
        const boundaryIdx = boundaryKey !== undefined ? snapshot.items.findIndex((i) => i.key === boundaryKey) : -1;
        // Last already-committed row in the NEW list: new rows AFTER it are tail
        // appends (commit straight through); new rows BEFORE it are prepends or
        // in-place reveals (measure-first candidates).
        let lastCommittedIdx = -1;
        for (let i = snapshot.items.length - 1; i >= 0; i--) {
            if (committedKeys.has(snapshot.items[i].key)) {
                lastCommittedIdx = i;
                break;
            }
        }
        const cutoff = boundaryIdx >= 0 ? Math.min(boundaryIdx, lastCommittedIdx) : lastCommittedIdx;
        const toMeasure: TimelineItem[] = [];
        for (let i = 0; i <= cutoff; i++) {
            const it = snapshot.items[i];
            if (it.kind === "loading") continue;
            if (committedKeys.has(it.key)) continue; // only rows new this snapshot
            if (sizeByKeyRef.current.has(it.key)) continue; // already measured earlier
            toMeasure.push(it);
        }
        if (toMeasure.length === 0) {
            // Spinner toggle / tail append / trim / already-measured — commit through.
            setCommitted({ items: snapshot.items, firstItemIndex: snapshot.firstItemIndex });
            return;
        }
        // Measure the batch off-screen first; the measure effect commits it.
        pendingCommitRef.current = { items: snapshot.items, firstItemIndex: snapshot.firstItemIndex };
        setSidecarItems(toMeasure);
    }, [snapshot.items, snapshot.firstItemIndex, snapshot.pendingAnchor, committed]);

    // Once the sidecar batch has laid out, measure its real heights into the
    // cache, then commit the snapshot it came from — anchorTo now places against
    // those heights, so the prepend lands with no jump and no resize correction.
    useIsomorphicLayoutEffect(() => {
        if (sidecarItems.length === 0) return;
        const container = sidecarRef.current;
        let measured = 0;
        let zeroH = 0;
        let total = 0;
        const samples: number[] = [];
        if (container) {
            for (const node of container.querySelectorAll<HTMLElement>("[data-sidecar-key]")) {
                const key = node.dataset.sidecarKey;
                if (key === undefined || sizeByKeyRef.current.has(key)) continue;
                const h = node.getBoundingClientRect().height;
                if (h > 0) {
                    sizeByKeyRef.current.set(key, h);
                    sizeSumRef.current += h;
                    estimateRef.current = sizeSumRef.current / sizeByKeyRef.current.size;
                    measured++;
                    total += h;
                    if (samples.length < 6) samples.push(Math.round(h));
                } else {
                    zeroH++;
                }
            }
        }
        if (DEBUG_JUMPS) {
            // Root-cause probe for the jump-to-top under-compensation: compare the
            // total height the sidecar seeds against the `postSetOptionsOffset`
            // anchorTo then applies (logged at the next commit). A sidecar width
            // that differs from the real scroller width would make tiles wrap to a
            // wrong height; zeroH>0 means rows that never got a real seed.
            // eslint-disable-next-line no-console
            console.debug(
                `[TimelineView] sidecar-measure: requested=${sidecarItems.length} measured=${measured} ` +
                    `zeroH=${zeroH} totalH=${Math.round(total)} estimate=${Math.round(estimateRef.current)} ` +
                    `sidecarW=${Math.round(container?.getBoundingClientRect().width ?? 0)} ` +
                    `scrollerW=${Math.round(scrollerRef.current?.clientWidth ?? 0)} samples=[${samples.join(",")}]`,
            );
        }
        const target = pendingCommitRef.current;
        pendingCommitRef.current = null;
        if (target) setCommitted(target);
        setSidecarItems([]);
    }, [sidecarItems]);

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

    useIsomorphicLayoutEffect(() => {
        if (phaseRef.current !== "live") return;
        const v = virtualizer;
        const snap = snapshotRef.current;
        const count = itemsRef.current.length;
        // Indices reported to the VM are relative to what is actually RENDERED =
        // `committed`, which can lag snapshot by one measure cycle during a prepend.
        // The VM defines firstItemIndex so absoluteIndex = firstItemIndex +
        // arrayIndex, so we use the committed firstItemIndex here.
        const toAbsolute = (index: number): number => committedRef.current.firstItemIndex + index;

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
                `[TimelineView] items ${prevCountRef.current}→${count} — ` +
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

    const virtualItems = virtualizer.getVirtualItems();

    return (
        <div style={{ height: "100%", width: "100%", position: "relative" }}>
            <div
                ref={scrollerRef}
                data-testid="timeline-scroller"
                style={{
                    height: "100%",
                    width: "100%",
                    overflowY: "auto",
                    overflowX: "hidden",
                    // Disable the browser's native scroll anchoring; core owns it.
                    overflowAnchor: "none",
                    visibility: revealed ? "visible" : "hidden",
                }}
            >
                {/* Sizer height is written imperatively by the virtualizer via
                    containerRef (directDomUpdates); do NOT set height here. */}
                {/* Semantic list: an <ol> of <li> rows, mirroring the legacy
                    <ol class="mx_RoomView_MessageList"> so screen readers announce
                    the timeline as a list of messages. `role="list"` is set
                    explicitly because Safari+VoiceOver drop list semantics once
                    `list-style: none` is applied (same reason ScrollPanel does it).
                    Rows are absolutely positioned by the virtualizer; that's
                    orthogonal to the list role. Tiles render as <div> (EventTile
                    `as="div"`), so there is no nested <li>. */}
                {/* eslint-disable-next-line jsx-a11y/no-redundant-roles -- explicit role survives list-style:none (see comment) */}
                <ol
                    ref={virtualizer.containerRef}
                    className="mx_TimelineView_list"
                    role="list"
                    style={{ width: "100%", position: "relative", listStyle: "none", margin: 0 }}
                >
                    {virtualItems.map((vi) => {
                        const item: TimelineItem | undefined = items[vi.index];
                        if (!item) return null;
                        return (
                            <li
                                key={vi.key}
                                className="mx_TimelineView_tile"
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
                                    listStyle: "none",
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
                            </li>
                        );
                    })}
                    {/* Sidecar measure pass: a freshly-fetched history batch is
                        rendered here off-screen (laid out but invisible, and
                        position:absolute so it never grows the scroll content) just
                        long enough to measure real heights into the cache — then
                        it's committed to the list above. Inside the same container
                        as the real rows so its width (and thus text wrapping) match.
                        A <li> (not a <div>) to stay a valid <ol> child; aria-hidden
                        keeps it out of the accessibility tree. */}
                    {sidecarItems.length > 0 && (
                        <li
                            ref={sidecarRef}
                            aria-hidden="true"
                            className="mx_TimelineView_tile"
                            style={{
                                position: "absolute",
                                top: 0,
                                left: 0,
                                width: "100%",
                                visibility: "hidden",
                                pointerEvents: "none",
                                listStyle: "none",
                            }}
                        >
                            {sidecarItems.map((item) => (
                                <div key={item.key} data-sidecar-key={item.key} style={{ width: "100%" }}>
                                    {renderItem(item)}
                                </div>
                            ))}
                        </li>
                    )}
                </ol>
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
        </div>
    );
}

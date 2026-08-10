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
 * Renders the room timeline: a scrollable list of messages.
 *
 * The list is virtualised — only the rows currently on screen (plus a few just outside it)
 * exist in the DOM, so a room with thousands of messages stays fast. TanStack Virtual does
 * that work; we drive it from `RoomTimelineViewModel`, which supplies the rows to show and
 * is told in return what the user can see.
 *
 * The hard part of a chat timeline is holding the scroll position steady while the list
 * changes underneath the reader. Rows appear at the top when older history loads, get
 * removed when the loaded window is trimmed, and loading spinners come and go. Each of
 * those shifts everything below it, which without care makes the message someone is
 * reading jump away mid-sentence. How each case is handled:
 *
 *  - **Older history arrives at the top.** `anchorTo: "end"` makes TanStack remember which
 *    row the user is looking at and, once the new rows are inserted above it, adjust the
 *    scroll position by the height that was added so that row stays exactly where it was
 *    on screen. It does this before the browser paints, so the shift is never visible.
 *
 *    `isValidAnchorItem` stops it picking a loading spinner as that remembered row: the
 *    spinner is replaced by the messages it was waiting for, so afterwards there is no
 *    such row left to line up against and the timeline would lurch to the top instead.
 *
 *  - **New messages arrive at the bottom.** `followOnAppend` scrolls down to keep them in
 *    view, but only when we are already at the live end and not jumping somewhere else.
 *
 *  - **Reaching either end**, which is the cue to load more, is worked out from which rows
 *    are currently rendered. TanStack has no "you reached the top/bottom" callback.
 *
 *  - **Jumping to a particular message** looks up how far down that message sits and
 *    scrolls straight to that position. We avoid TanStack's `scrollToIndex`, which keeps
 *    steering towards a row *number*: if history loads while it is doing that, every row
 *    shifts down and it follows the wrong one to the top. See `offsetForKey`.
 *
 * `directDomUpdates: true` lets TanStack position rows by writing to the DOM itself rather
 * than going through a React render, so measuring a row and moving it happen in the same
 * frame (splitting them across two caused a visible stutter). React still re-renders when
 * the set of visible rows changes.
 *
 * Known gap: `overscan` counts rows rather than pixels, so how far it actually reaches
 * beyond the viewport varies with how tall those rows happen to be.
 */

/** Seed height for not-yet-measured rows; kept near a typical chat row so the
 * estimate→measured correction stays small. TanStack caches real heights by key thereafter. */
const ESTIMATED_ITEM_HEIGHT = 48;
/** Rows rendered beyond the visible range each side — a COUNT, not px; ~16 ≈ a screenful. */
const OVERSCAN = 16;
/** px from the list bottom still counted as "at the bottom". */
const AT_BOTTOM_THRESHOLD_PX = 4;
/**
 * Give-up limit for the first load.
 *
 * While the timeline is being scrolled to its starting message it is kept hidden behind a
 * spinner, and we only reveal it once that scroll has arrived (see the first-load effect
 * below). If the target can never be reached — for example the view model asked for a
 * message that is not in the loaded window — that check would never pass and the timeline
 * would stay hidden behind the spinner forever. So we reveal it anyway after this many
 * animation frames: 60 frames is roughly one second on a 60Hz screen, about half that at
 * 120Hz.
 */
const COLD_CAP_FRAMES = 60;

/**
 * How far the view has got through its first load:
 *  - "init"    — nothing rendered yet; waiting for the first batch of messages.
 *  - "placing" — rows are laid out but still hidden while we scroll to the right spot.
 *  - "live"    — the timeline is visible and the user is in control of scrolling.
 */
type Phase = "init" | "placing" | "live";

export function TimelineView({ vm, renderItem }: TimelineViewProps): JSX.Element {
    const snapshot = useViewModel(vm);

    // The effects and callbacks below run outside React's render — from scroll events and
    // animation frames — so they cannot use the `snapshot` variable captured when this
    // function last ran, as it may be out of date by then. These refs always hold the
    // latest values for them to read.
    const snapshotRef = useRef(snapshot);
    snapshotRef.current = snapshot;

    // Loading spinners are ordinary entries in this list (kind: "loading") rather than
    // something floating on top of it. That way each spinner occupies real space in the
    // scroll area, so showing or hiding one is just another change to the list that the
    // scroll anchoring described above already knows how to absorb.
    const items = snapshot.items;
    const itemsRef = useRef(items);
    itemsRef.current = items;

    const scrollerRef = useRef<HTMLDivElement | null>(null);

    // On the first load we lay the rows out, scroll to the message we should start at, and
    // only then show the result. Otherwise the user would watch the list shuffle around as
    // rows are measured and the scroll position corrected. A spinner covers the gap. This
    // happens once per room, as the panel is recreated when the room changes.
    const [revealed, setRevealed] = useState(false);
    const revealedRef = useRef(false);

    // Gives each row a stable identity (its event id). TanStack uses these to recognise the
    // same row from one update to the next, which is what makes the scroll anchoring
    // possible at all. It also compares the first row's key between renders to spot when
    // rows have been added or removed at the top, so this must always read the current list.
    const getItemKey = useCallback((index: number): string => items[index]?.key ?? String(index), [items]);

    // Refuses loading spinners as the row the scroll position is anchored to; see the note
    // on `isValidAnchorItem` in the file comment above for why anchoring to one breaks.
    //
    // This tests the row's key rather than its position in the list. When rows are added or
    // removed, TanStack is still working from the positions as they were before the change
    // while `items` already reflects it, so looking a row up by position here would check
    // the wrong one. The spinner keys are shared with the view model, in types.ts.
    const isValidAnchorItem = useCallback(
        (item: VirtualItem): boolean => item.key !== BACKWARD_LOADING_KEY && item.key !== FORWARD_LOADING_KEY,
        [],
    );

    // ─── State used by the scroll reporting below ──────────────────────────────
    const phaseRef = useRef<Phase>("init");
    // We only want to tell the view model about things that have actually changed, so these
    // hold the last values we sent and repeats are skipped.
    const lastVisibleRangeRef = useRef<{ start: number; end: number } | null>(null);
    const lastAtBottomRef = useRef<boolean | null>(null);
    // For the "reached the top/bottom" reports we remember a short description of the
    // situation we last reported, in the form "<number of rows>:<row index>", and clear it
    // whenever we move away from that end. This stops us reporting over and over while
    // sitting still at the end, while still reporting again once more history has loaded
    // and the user scrolls further into it.
    const startEdgeTokenRef = useRef("");
    const endEdgeTokenRef = useRef("");

    // Tells the view model what the user can currently see: which rows are on screen,
    // whether we are at the bottom, and whether either end of the loaded messages has been
    // reached (the cue for it to load more). TanStack calls this whenever it updates —
    // on scroll, after measuring a row, or when the set of visible rows changes.
    //
    // This only reads state, it never scrolls. It stays quiet until the first load has
    // finished and while we are scrolling to a message the view model asked for, because
    // until then the scroll position reflects our own automatic placement rather than
    // anything the user did.
    const reportVisibleState = useCallback(
        (v: Virtualizer<HTMLDivElement, Element>): void => {
            if (phaseRef.current !== "live" || snapshotRef.current.pendingAnchor !== null) return;
            const itemCount = itemsRef.current.length;
            const visibleRange = v.range;

            // Which rows are on screen, given as positions in the items array.
            if (
                visibleRange &&
                (lastVisibleRangeRef.current?.start !== visibleRange.startIndex ||
                    lastVisibleRangeRef.current?.end !== visibleRange.endIndex)
            ) {
                lastVisibleRangeRef.current = { start: visibleRange.startIndex, end: visibleRange.endIndex };
                vm.onVisibleRangeChanged(visibleRange.startIndex, visibleRange.endIndex);
            }

            // Are we scrolled to the bottom? Worked out from figures TanStack already holds
            // (how far we have scrolled, the viewport height, the total height) rather than
            // measuring the DOM, which would force the browser to redo layout on every call.
            const scrollOffset = v.scrollOffset ?? 0;
            const viewportHeight = v.scrollRect?.height ?? 0;
            const totalSize = v.getTotalSize();
            const atBottom = viewportHeight > 0 && scrollOffset + viewportHeight >= totalSize - AT_BOTTOM_THRESHOLD_PX;
            if (atBottom !== lastAtBottomRef.current) {
                lastAtBottomRef.current = atBottom;
                vm.onAtBottomStateChange(atBottom);
            }

            // Have we reached either end of the loaded messages? True once the very first or
            // very last row is among those being rendered, which tells the view model it may
            // need to load more history in that direction.
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
        // Only consulted for rows that have not been measured yet. TanStack measures each
        // row as it renders and remembers the result by key, reusing it as rows are added,
        // trimmed or reloaded, so we do not need a size cache of our own.
        estimateSize: () => ESTIMATED_ITEM_HEIGHT,
        getItemKey,
        overscan: OVERSCAN,
        // Keep whatever the user is looking at visually still when rows are added or
        // removed, correcting the scroll position before the browser paints. This is the
        // main thing stopping the timeline jumping; see the file comment for how it works.
        anchorTo: "end",
        // ...but never hold onto a loading spinner as that reference row (see above). This
        // option comes from our @tanstack/virtual-core patch and is pending upstream.
        isValidAnchorItem,
        // Scroll down to follow newly arrived messages, but only when we are at the live end
        // of the timeline and are not part-way through jumping somewhere else.
        followOnAppend: snapshot.atLiveEnd && snapshot.pendingAnchor === null,
        // Let TanStack place rows by writing to the DOM directly instead of re-rendering.
        // Because of this, never set transform or height on a row in JSX below — it would
        // fight with what TanStack writes.
        directDomUpdates: true,
        // Called on every TanStack update; we use it to report what is on screen upwards.
        onChange: reportVisibleState,
    });

    // Works out how far down the list we would have to scroll, in pixels, to bring the row
    // with `targetKey` into view — `align` saying whether it should end up at the top,
    // the middle or the bottom of the viewport. Returns null if that message is not among
    // the ones currently loaded, in which case the caller cannot scroll to it yet.
    //
    // Callers hand the result to `scrollToOffset`, which simply scrolls to a fixed pixel
    // position. We deliberately do not use `scrollToIndex`: that keeps steering towards a
    // row *number* as rows are measured, so if older history loads while it is still
    // adjusting, every row shifts down and it follows the wrong one up to the top.
    const offsetForKey = useCallback(
        (targetKey: string | null, align: AnchorAlign): number | null => {
            const idx = targetKey ? itemsRef.current.findIndex((i) => i.key === targetKey) : -1;
            if (idx < 0) return null;
            const info = virtualizer.getOffsetForIndex(idx, align);
            return info ? info[0] : null;
        },
        [virtualizer],
    );
    // ─── First load: scroll to the starting message while hidden, then reveal ──
    // Runs once, as soon as the first batch of messages arrives.
    const coldRafRef = useRef(0);
    useEffect(() => () => cancelAnimationFrame(coldRafRef.current), []);
    useLayoutEffect(() => {
        if (phaseRef.current !== "init" || items.length === 0) return;
        // Move out of "init" immediately, so that if more messages arrive while we are
        // still placing this effect runs again but returns here rather than starting over.
        phaseRef.current = "placing";
        // Start at the message the view model asked for. If it did not ask for one, or that
        // message is not in the batch we were given, start at the newest message instead.
        const anchor = snapshotRef.current.pendingAnchor;
        const list = itemsRef.current;
        let idx = anchor ? list.findIndex((i) => i.key === anchor.targetKey) : -1;
        if (idx < 0) idx = list.length - 1;
        const align: AnchorAlign = anchor?.align ?? "end";
        // Let TanStack carry out this scroll: it keeps correcting the target as rows are
        // measured and their real heights become known. We must not set the scroll position
        // ourselves as well — two things moving the viewport at once end up fighting.
        if (idx >= 0) virtualizer.scrollToIndex(idx, { align, behavior: "auto" });
        // Now watch each frame until that row actually reaches the position it was heading
        // for, and reveal the timeline once it has. `cap` counts frames down so we give up
        // and reveal anyway if it never gets there — see COLD_CAP_FRAMES above.
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

    // ─── Later jumps: scroll to a message the view model has asked for ─────────
    // Once the first load is done, the view model can ask us to jump somewhere by setting
    // `pendingAnchor`. This is used by "jump to the latest message" and "jump to the first
    // unread message" when the target was not already loaded, so it had to be fetched and
    // the timeline rebuilt around it first.
    //
    // This effect runs after every render, so it acts as soon as those messages appear, and
    // it scrolls before the browser paints so the jump is never seen as a scrolling motion.
    // `lastPlacedAnchorKeyRef` records which message we last jumped to, so that later
    // renders do not repeat the same jump and fight the user's own scrolling.
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

    // Handed to the overlay buttons, and through them to the view model, so it can scroll
    // us straight away when the message it wants is already loaded — no fetch needed, and
    // no round trip through `pendingAnchor` above.
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
                {/* An <ol> of <li> rows, so screen readers announce this as a list of messages
                    and can say how many there are. The role="list" is stated explicitly even
                    though an <ol> already is one: Safari with VoiceOver stops treating a list
                    as a list once list-style is set to none, which our CSS does. The old
                    ScrollPanel does the same thing for the same reason. */}
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

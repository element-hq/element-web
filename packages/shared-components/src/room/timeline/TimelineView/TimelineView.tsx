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

// ─── Height-stability audit (debug only) ───────────────────────────
//
// Timeline tiles that grow *after* their initial mount (a reply chain
// resolving its referenced event, an image loading, a URL preview arriving,
// an event decrypting…) shift everything below them and cause scroll jumps.
//
// Flip DEBUG_SIZES to true locally to instrument every row. Each row's
// post-mount height changes are aggregated by *tile type* into a global
// registry. From the devtools console:
//
//     __timelineHeightAudit.report()   // ranked table of what resizes & by how much
//     __timelineHeightAudit.reset()    // start a fresh capture
//
// Leave it false on commit — the probe adds a second ResizeObserver per row.
const DEBUG_SIZES = true;

/** Shared item-wrapper style. Establishing a block formatting context with
 * `flow-root` stops the item's outer vertical margins collapsing through
 * virtuoso's (border/padding-less) wrapper, which would make virtuoso's
 * ResizeObserver under-report the row's true laid-out height. The debug probe
 * applies the *same* style to its measured element, so audit numbers reflect
 * the exact box production renders. */
const ITEM_WRAPPER_STYLE = { display: "flow-root" } as const;

/** Per-tile-type accumulator. */
interface ResizeStat {
    /** Distinct rows of this type that mounted. */
    mounts: number;
    /** Post-mount height changes observed across all rows of this type. */
    resizes: number;
    /** Rows that changed height at least once (the ones causing jumps). */
    unstableRows: number;
    /** Largest single |Δheight| seen, px. */
    maxDelta: number;
    /** Largest net (last − mount) height change for a single row, px. */
    maxNetGrowth: number;
    /** Sum of |Δheight| across all resizes, for averaging. */
    totalDelta: number;
    /** A few example row keys, for spot-checking in the DOM. */
    samples: Set<string>;
    /** Among rows of this type that turned out unstable, how many contained each
     * suspect inline feature (pill, emoji, inline-image, codeblock…). Points at
     * the *cause* of the reflow rather than just the symptom. Counted once per
     * unstable row, not per resize. */
    features: Map<string, number>;
}

class HeightAudit {
    private readonly stats = new Map<string, ResizeStat>();
    /** "mountType → resolvedType" → count. Surfaces placeholder→content reveals
     * (e.g. "event:? → event:m.image"), the prime post-mount growth pattern. */
    private readonly transitions = new Map<string, number>();

    private stat(type: string): ResizeStat {
        let s = this.stats.get(type);
        if (!s) {
            s = { mounts: 0, resizes: 0, unstableRows: 0, maxDelta: 0, maxNetGrowth: 0, totalDelta: 0, samples: new Set(), features: new Map() };
            this.stats.set(type, s);
        }
        return s;
    }

    public recordMount(type: string, key: string): void {
        const s = this.stat(type);
        s.mounts += 1;
        if (s.samples.size < 5) s.samples.add(key);
    }

    /**
     * Record a post-mount height change. `type` is the tile's *current* type
     * (re-classified at resize time), so growth that follows a placeholder
     * resolving is attributed to what the tile became, not what it mounted as.
     */
    public recordResize(type: string, key: string, mountHeight: number, prev: number, next: number, rowAlreadyUnstable: boolean, features: string[]): void {
        const s = this.stat(type);
        s.resizes += 1;
        if (!rowAlreadyUnstable) {
            s.unstableRows += 1;
            // Attribute the cause once per unstable row, not per resize.
            for (const f of features) s.features.set(f, (s.features.get(f) ?? 0) + 1);
        }
        const delta = Math.abs(next - prev);
        s.totalDelta += delta;
        if (delta > s.maxDelta) s.maxDelta = delta;
        const net = next - mountHeight;
        if (net > s.maxNetGrowth) s.maxNetGrowth = net;
        if (s.samples.size < 5) s.samples.add(key);
    }

    public recordTransition(from: string, to: string): void {
        const k = `${from} → ${to}`;
        this.transitions.set(k, (this.transitions.get(k) ?? 0) + 1);
    }

    /** Print two tables: per-type instability, and mount→resolved transitions. */
    public report(): void {
        const rows = [...this.stats.entries()]
            .map(([type, s]) => ({
                type,
                mounts: s.mounts,
                unstableRows: s.unstableRows,
                "unstable%": s.mounts ? Math.round((s.unstableRows / s.mounts) * 100) : 0,
                resizes: s.resizes,
                maxDelta: Math.round(s.maxDelta),
                avgDelta: s.resizes ? Math.round(s.totalDelta / s.resizes) : 0,
                maxNetGrowth: Math.round(s.maxNetGrowth),
                causes: [...s.features.entries()].sort((a, b) => b[1] - a[1]).map(([f, n]) => `${f}×${n}`).join(", "),
                samples: [...s.samples].join(", "),
            }))
            .sort((a, b) => b.unstableRows * b.maxNetGrowth - a.unstableRows * a.maxNetGrowth);
        // eslint-disable-next-line no-console
        console.table(rows);

        const transitionRows = [...this.transitions.entries()]
            .map(([change, count]) => ({ change, count }))
            .sort((a, b) => b.count - a.count);
        if (transitionRows.length) {
            // eslint-disable-next-line no-console
            console.table(transitionRows);
        }
        // eslint-disable-next-line no-console
        console.info(
            "[height-audit] Per-type table ranked by (unstable rows × max net growth). " +
                "The transitions table shows tiles that changed type after mount (placeholder → content) — " +
                "these are the reveals to stabilise by reserving space for the resolved tile.",
        );
    }

    public reset(): void {
        this.stats.clear();
        this.transitions.clear();
        // eslint-disable-next-line no-console
        console.info("[height-audit] reset");
    }
}

const heightAudit = new HeightAudit();
if (DEBUG_SIZES && typeof window !== "undefined") {
    (window as unknown as { __timelineHeightAudit: HeightAudit }).__timelineHeightAudit = heightAudit;
}

// ─── Scroll/pagination tracing (debug only) ────────────────────────
//
// The VM already logs paginate batches ([TimelineVM]); this traces the *View*
// side — Virtuoso's scroll callbacks — so the two can be interleaved in the
// console to diagnose the "multiple paginations + snap to bottom" loop.
//
// Each line carries a monotonic sequence number and the elapsed ms since the
// previous traced event. A tight re-trigger loop shows up as a run of lines a
// few ms apart (e.g. followOutput→true, endReached, rangeChanged snapping to
// the last index, endReached again…). Set DEBUG_SCROLL to false to silence.
const DEBUG_SCROLL = true;
let scrollTraceSeq = 0;
let scrollTraceLastTs = 0;
function scrollTrace(event: string, detail: Record<string, unknown> = {}): void {
    if (!DEBUG_SCROLL) return;
    const now = typeof performance !== "undefined" ? performance.now() : 0;
    const delta = scrollTraceLastTs === 0 ? 0 : Math.round(now - scrollTraceLastTs);
    scrollTraceLastTs = now;
    const fields = Object.entries(detail)
        .map(([k, v]) => `${k}=${typeof v === "string" ? v : JSON.stringify(v)}`)
        .join(" ");
    // eslint-disable-next-line no-console
    console.debug(`[TimelineView] #${++scrollTraceSeq} +${delta}ms ${event}${fields ? " " + fields : ""}`);
}

/** Map a `mx_…Body` DOM class onto a readable tile-type token. Falls back to
 * de-camelising any unrecognised `mx_XxxBody` class so new body types surface
 * with a sensible name instead of being lumped into `?`. */
function bodyClassToType(cls: string): string {
    switch (cls) {
        case "mx_MTextBody": return "m.text";
        case "mx_MNoticeBody": return "m.notice";
        case "mx_MEmoteBody": return "m.emote";
        case "mx_MImageBody":
        case "mx_ImageBody": return "m.image";
        case "mx_MImageReplyBody": return "m.image(reply)";
        case "mx_MVideoBody": return "m.video";
        case "mx_MAudioBody": return "m.audio";
        case "mx_MVoiceMessageBody": return "m.voice";
        case "mx_MFileBody": return "m.file";
        case "mx_MStickerBody": return "m.sticker";
        case "mx_MLocationBody": return "m.location";
        case "mx_MBeaconBody": return "m.beacon";
        case "mx_MPollBody": return "m.poll";
        case "mx_RedactedBody": return "redacted";
        case "mx_DecryptionFailureBody": return "decryption-failure";
        case "mx_UnknownBody": return "unknown";
        // e.g. "mx_MFooBarBody" → "m.foo-bar", "mx_FooBody" → "foo"
        default: return cls.replace(/^mx_M?/, "").replace(/Body$/, "").replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase();
    }
}

/**
 * Derive a stable tile-type key from the *current* rendered DOM. Non-event rows
 * use their kind; event rows are typed from the first `mx_…Body` class found,
 * plus markers for the features most likely to change height after mount (reply
 * chains, URL previews, reactions). Re-run on each resize so a tile that mounts
 * as a placeholder (no body yet) and resolves is typed by what it became.
 *
 * Couples the debug path to web CSS class names, which is acceptable for an
 * instrumentation tool that never ships enabled.
 */
function classifyTile(wrapper: HTMLElement, baseLabel: string): string {
    if (!baseLabel.startsWith("event")) return baseLabel;

    let bodyType = "event:?";
    // Prefer the message-body element; querySelectorAll yields document order
    // (outermost first), so the first mx_…Body match is the row's own body.
    for (const el of wrapper.querySelectorAll('[class*="Body"]')) {
        const cls = [...el.classList].find((c) => /^mx_\w*Body$/.test(c));
        if (cls) {
            bodyType = `event:${bodyClassToType(cls)}`;
            break;
        }
    }
    if (bodyType === "event:?" && wrapper.querySelector(".mx_EventTile_info")) bodyType = "event:state";

    const markers: string[] = [];
    if (wrapper.querySelector(".mx_ReplyChain")) markers.push("+reply");
    if (wrapper.querySelector(".mx_LinkPreviewGroup")) markers.push("+urlpreview");
    if (wrapper.querySelector(".mx_ReactionsRow")) markers.push("+reactions");
    return bodyType + markers.join("");
}

/**
 * Detect inline content inside a row that commonly resolves/loads *after* mount
 * and reflows the body — the likely cause of a same-type height change. Returns
 * the markers present so the audit can correlate them with unstable rows.
 */
function detectFeatures(wrapper: HTMLElement): string[] {
    const features: string[] = [];
    if (wrapper.querySelector(".mx_Pill")) features.push("pill"); // mentions resolve display name/avatar
    if (wrapper.querySelector(".mx_Emoji")) features.push("emoji"); // custom/inline emoji images
    if (wrapper.querySelector(".mx_EventTile_body img, .mx_EventTile_body image")) features.push("inline-img");
    if (wrapper.querySelector(".mx_EventTile_pre_container")) features.push("codeblock");
    if (wrapper.querySelector(".mx_ReplyChain")) features.push("reply");
    if (wrapper.querySelector(".mx_LinkPreviewGroup")) features.push("urlpreview");
    if (wrapper.querySelector(".mx_ReactionsRow")) features.push("reactions");
    return features;
}

/**
 * Wraps one row, applies the production flow-root box, and records its
 * post-mount height changes into the audit registry. Used only when
 * DEBUG_SIZES is true; otherwise rows render through a plain flow-root div.
 *
 * The probe observes its *own* element — a sibling measurement to virtuoso's
 * own ResizeObserver (which observes the wrapper element virtuoso renders
 * around this one). They watch different elements so they don't fight, but to
 * avoid "ResizeObserver loop … undelivered notifications" warnings the callback
 * does no layout reads beyond the delivered entry and no synchronous logging —
 * results are aggregated silently and surfaced on demand via report().
 *
 * @internal
 */
function HeightAuditProbe({ itemKey, baseLabel, children }: PropsWithChildren<{ itemKey: string; baseLabel: string }>): ReactNode {
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        let mountType: string | null = null;
        let mountHeight = 0;
        let prevHeight: number | null = null;
        let rowUnstable = false;
        const ro = new ResizeObserver((entries) => {
            const h = entries[entries.length - 1].borderBoxSize[0].blockSize;
            if (prevHeight === null) {
                // First delivery == mount. Classify now that the tile has rendered.
                mountType = classifyTile(el, baseLabel);
                mountHeight = h;
                prevHeight = h;
                heightAudit.recordMount(mountType, itemKey);
                return;
            }
            if (h !== prevHeight && mountType) {
                // Re-classify: a placeholder that resolved (e.g. decrypting → image)
                // is now its real type, so attribute the growth to what it became.
                const currentType = classifyTile(el, baseLabel);
                heightAudit.recordResize(currentType, itemKey, mountHeight, prevHeight, h, rowUnstable, detectFeatures(el));
                if (currentType !== mountType) heightAudit.recordTransition(mountType, currentType);
                rowUnstable = true;
                prevHeight = h;
            }
        });
        ro.observe(el);
        return () => ro.disconnect();
    }, [itemKey, baseLabel]);

    return <div ref={ref} style={ITEM_WRAPPER_STYLE}>{children}</div>;
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

    // Debug only: latest scroller pixel metrics, updated on every onScroll, so the
    // endReached trace can report how far (in px) the viewport is from the list
    // bottom. A large distanceFromBottom at endReached means it fired without the
    // user actually being near the bottom (spurious re-trigger); ~0 means genuine.
    const scrollMetaRef = useRef({ scrollTop: 0, scrollHeight: 0, clientHeight: 0, lastScrollTop: 0 });

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
                return <div style={ITEM_WRAPPER_STYLE}>{renderItem(item)}</div>;
            }
            const baseLabel = item.kind === "event" ? "event" : item.kind;
            return (
                <HeightAuditProbe itemKey={item.key} baseLabel={baseLabel}>
                    {renderItem(item)}
                </HeightAuditProbe>
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
            if (arrayIndex === -1) {
                scrollTrace("scrollIntoViewOnChange:miss", { targetKey: anchor.targetKey, totalCount: _params.totalCount });
                return false;
            }

            scrollTrace("scrollIntoViewOnChange:scroll", {
                index: arrayIndex,
                align: anchor.align,
                targetKey: anchor.targetKey,
                lastIndex: snap.items.length - 1,
                scrolling: _params.scrollingInProgress,
            });
            return {
                index: arrayIndex,
                align: anchor.align,
                behavior: "auto",
                done: () => {
                    scrollTrace("scrollIntoViewOnChange:done", { index: arrayIndex, align: anchor.align });
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
    const onScroll = useCallback((e: React.UIEvent<HTMLElement>) => {
        const el = e.currentTarget;
        if (DEBUG_SCROLL && el) {
            const m = scrollMetaRef.current;
            m.lastScrollTop = m.scrollTop;
            m.scrollTop = el.scrollTop;
            m.scrollHeight = el.scrollHeight;
            m.clientHeight = el.clientHeight;
        }
        if (!isAnchorScrollInProgressRef.current && snapshotRef.current.pendingAnchor !== null) {
            scrollTrace("onScroll:clearAnchor", { pendingAnchor: snapshotRef.current.pendingAnchor?.targetKey ?? null });
            vm.onAnchorReached();
        }
    }, [vm]);

    // Wrapped pagination + at-bottom callbacks so the View-side trigger is traced
    // immediately before the VM's own [TimelineVM] paginate logs. anchorInProgress
    // flags whether the trigger fired during one of our own programmatic scrolls.
    const onEndReached = useCallback(
        (index: number) => {
            const m = scrollMetaRef.current;
            // px from the viewport bottom to the list bottom; ~0 = genuinely at the
            // bottom, large = endReached fired without the user being near it.
            const distanceFromBottom = Math.round(m.scrollHeight - m.clientHeight - m.scrollTop);
            scrollTrace("endReached", {
                index,
                lastIndex: snapshotRef.current.items.length - 1,
                atLiveEnd: snapshotRef.current.atLiveEnd,
                isAtBottom: snapshotRef.current.isAtBottom,
                distanceFromBottom,
                scrollDelta: Math.round(m.scrollTop - m.lastScrollTop),
                anchorInProgress: isAnchorScrollInProgressRef.current,
                pendingAnchor: snapshotRef.current.pendingAnchor?.targetKey ?? null,
            });
            vm.onEndReached();
        },
        [vm],
    );

    const onStartReached = useCallback(
        (index: number) => {
            scrollTrace("startReached", {
                index,
                firstItemIndex: snapshotRef.current.firstItemIndex,
                anchorInProgress: isAnchorScrollInProgressRef.current,
            });
            vm.onStartReached();
        },
        [vm],
    );

    const onAtBottomStateChange = useCallback(
        (atBottom: boolean) => {
            scrollTrace("atBottomStateChange", { atBottom, atLiveEnd: snapshotRef.current.atLiveEnd });
            vm.onAtBottomStateChange(atBottom);
        },
        [vm],
    );

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
            scrollTrace("rangeChanged", {
                start: range.startIndex,
                end: range.endIndex,
                firstItemIndex: snapshotRef.current.firstItemIndex,
                lastIndex: snapshotRef.current.firstItemIndex + snapshotRef.current.items.length - 1,
                anchorInProgress: isAnchorScrollInProgressRef.current,
            });
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
            if (snapshot.pendingAnchor !== null) {
                scrollTrace("followOutput:disabled", { pendingAnchor: snapshot.pendingAnchor.targetKey });
                return false;
            }
            return (isAtBottom: boolean) => {
                // This decides whether Virtuoso snaps to the bottom when the list
                // grows (e.g. a forward-paginate append). `true` here is the "snap
                // to bottom" the user is seeing — if it fires mid-list it can put
                // the viewport back at the end and immediately re-trigger endReached.
                const follow = isAtBottom && snapshot.atLiveEnd;
                scrollTrace("followOutput:eval", { isAtBottom, atLiveEnd: snapshot.atLiveEnd, follow });
                return follow;
            };
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
                startReached={onStartReached}
                atBottomStateChange={onAtBottomStateChange}
                endReached={onEndReached}
                followOutput={followOutput}
                // scrollIntoViewOnChange={scrollIntoViewOnChange}
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

/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, {
    useCallback,
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
    type JSX,
    type ReactNode,
    type PropsWithChildren,
} from "react";
import { LogLevel, Virtuoso, type IndexLocationWithAlign, type VirtuosoHandle } from "react-virtuoso";
import { InlineSpinner } from "@vector-im/compound-web";

import { useViewModel } from "../../../core/viewmodel/useViewModel";
import type { ImmediateScroll, TimelineItem, TimelineViewProps } from "./types";
import { TimelineOverlayButtons } from "./TimelineOverlayButtons";

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
// Tiles that grow after mount (reply chains resolving, images loading, URL
// previews arriving, events decrypting) shift everything below them and cause
// scroll jumps. Set DEBUG_SIZES true to instrument every row; results aggregate
// by tile type into a registry surfaced from the devtools console:
//
//     __timelineHeightAudit.report()   // ranked table of what resizes & by how much
//     __timelineHeightAudit.reset()    // start a fresh capture
//
// Adds a second ResizeObserver per row, so keep it false except when profiling.
const DEBUG_SIZES = false;

/** `flow-root` establishes a block formatting context so the row's outer vertical
 * margins don't collapse through virtuoso's border/padding-less wrapper — which
 * would make virtuoso's ResizeObserver under-report the laid-out height. */
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

/** Per-resize forensic record: what concretely changed in the row's DOM between
 * mount and the height change. `changes` of "(no DOM diff…)" means the markup
 * was identical and the row purely re-wrapped (fonts, container width, CSS) —
 * the signal that separates content swaps from layout-level causes. */
interface ResizeDetail {
    key: string;
    type: string;
    delta: number;
    heights: string;
    changes: string;
    bodyPreview: string;
    /** performance.now() of the resize, ms — correlate against the [TimelineVM]
     * paginate-batch log lines to see whether resizes cluster around prepends. */
    ts: number;
}

class HeightAudit {
    private readonly stats = new Map<string, ResizeStat>();
    /** "mountType → resolvedType" → count. Surfaces placeholder→content reveals
     * (e.g. "event:? → event:m.image"), the prime post-mount growth pattern. */
    private readonly transitions = new Map<string, number>();
    /** First N per-resize forensic records (see {@link ResizeDetail}). */
    private readonly details: ResizeDetail[] = [];
    private static readonly MAX_DETAILS = 50;

    private stat(type: string): ResizeStat {
        let s = this.stats.get(type);
        if (!s) {
            s = {
                mounts: 0,
                resizes: 0,
                unstableRows: 0,
                maxDelta: 0,
                maxNetGrowth: 0,
                totalDelta: 0,
                samples: new Set(),
                features: new Map(),
            };
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
    public recordResize(
        type: string,
        key: string,
        mountHeight: number,
        prev: number,
        next: number,
        rowAlreadyUnstable: boolean,
        features: string[],
    ): void {
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

    public recordDetail(detail: ResizeDetail): void {
        if (this.details.length < HeightAudit.MAX_DETAILS) this.details.push(detail);
    }

    /** Print two tables: per-type instability, and mount→resolved transitions. */
    public report(): void {
        const rows = [...this.stats.entries()]
            .map(([type, s]) => ({
                type,
                "mounts": s.mounts,
                "unstableRows": s.unstableRows,
                "unstable%": s.mounts ? Math.round((s.unstableRows / s.mounts) * 100) : 0,
                "resizes": s.resizes,
                "maxDelta": Math.round(s.maxDelta),
                "avgDelta": s.resizes ? Math.round(s.totalDelta / s.resizes) : 0,
                "maxNetGrowth": Math.round(s.maxNetGrowth),
                "causes": [...s.features.entries()]
                    .sort((a, b) => b[1] - a[1])
                    .map(([f, n]) => `${f}×${n}`)
                    .join(", "),
                "samples": [...s.samples].join(", "),
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
        if (this.details.length) {
            // eslint-disable-next-line no-console
            console.table(this.details);
        }
        // eslint-disable-next-line no-console
        console.info(
            "[height-audit] Per-type table ranked by (unstable rows × max net growth). " +
                "The transitions table shows tiles that changed type after mount (placeholder → content) — " +
                "these are the reveals to stabilise by reserving space for the resolved tile. " +
                "The details table shows, per resize, what changed in the row's DOM since mount; " +
                "'(no DOM diff…)' means a pure re-wrap (fonts / container width / CSS), not a content swap.",
        );
    }

    public reset(): void {
        this.stats.clear();
        this.transitions.clear();
        this.details.length = 0;
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
// Traces Virtuoso's scroll callbacks (the VM logs its own paginate batches under
// [TimelineVM]); interleave the two in the console to diagnose scroll/pagination
// loops. Each line carries a sequence number and ms since the previous event, so
// a tight re-trigger loop shows up as a run of lines a few ms apart.
const DEBUG_SCROLL = false;
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

// ─── Content-jump detector (debug only) ────────────────────────────
//
// The height audit catches rows that change height; this catches the other
// class of visible jump: frames where the rendered content shifts relative to
// the viewport by an amount that doesn't match the scroll delta — i.e.
// virtuoso's prepend/anchor compensation was wrong, or landed a frame after
// the content change painted.
//
// Every animation frame we record the viewport-relative top of each rendered
// row (virtuoso's data-index is stable across prepends: firstItemIndex moves
// down exactly as array indices move up). For rows present in consecutive
// frames, plain scrolling moves them by exactly -ΔscrollTop, so
// median(Δtop) + ΔscrollTop is the content visibly jumping under the
// viewport. Jumps above the threshold are logged with ms-since-commit so they
// can be correlated with [TimelineVM] paginate batches and the height audit's
// `ts` column.
const DEBUG_JUMPS = true;
const JUMP_THRESHOLD_PX = 3;

interface CommitInfo {
    itemsLen: number;
    firstItemIndex: number;
    at: number;
}

function useContentJumpDetector(
    scrollerRef: React.MutableRefObject<HTMLElement | null>,
    commitRef: React.MutableRefObject<CommitInfo | null>,
): void {
    useEffect(() => {
        if (!DEBUG_JUMPS) return;
        let raf = 0;
        interface FrameSample {
            scrollTop: number;
            tops: Map<string, number>;
            /** Inline marginTop on virtuoso's item list = the live `deviation`
             * compensation ("auto" while idle under alignToBottom). */
            margin: string;
            /** Inline paddingTop on the item list = virtuoso's estimated height
             * of unrendered items above the window. */
            pad: string;
            t: number;
        }
        let prev: FrameSample | null = null;
        const tick = (): void => {
            raf = requestAnimationFrame(tick);
            const scroller = scrollerRef.current;
            if (!scroller) {
                prev = null;
                return;
            }
            const scrollerTop = scroller.getBoundingClientRect().top;
            const tops = new Map<string, number>();
            // Key on data-item-index (the STABLE display index), NOT data-index.
            // data-index is virtuoso's raw position and shifts by +N when N items
            // are prepended, so keying on it compares a different message before vs
            // after a prepend — inflating "rows moved" into a huge artifact on the
            // exact frames we care about. data-item-index is firstItemIndex-stable,
            // so the same message matches across the prepend and "rows moved"
            // reflects what the user actually saw. data-known-size narrows the
            // match to virtuoso's own measured item wrappers.
            for (const el of scroller.querySelectorAll<HTMLElement>("[data-item-index][data-known-size]")) {
                tops.set(el.dataset.itemIndex!, el.getBoundingClientRect().top - scrollerTop);
            }
            const list = scroller.querySelector<HTMLElement>('[data-testid="virtuoso-item-list"]');
            const sample: FrameSample = {
                scrollTop: scroller.scrollTop,
                tops,
                margin: list?.style.marginTop || "0",
                pad: list?.style.paddingTop || "0",
                t: Math.round(performance.now()),
            };
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
                        const commit = commitRef.current;
                        const sinceCommit = commit
                            ? `${Math.round(performance.now() - commit.at)}ms after commit (items=${commit.itemsLen}, firstItemIndex=${commit.firstItemIndex})`
                            : "no commit yet";
                        // eslint-disable-next-line no-console
                        console.debug(
                            `[TimelineView] CONTENT-JUMP ${Math.round(jump)}px — rows moved ${Math.round(median)}px, ` +
                                `scrollTop Δ${Math.round(sample.scrollTop - prev.scrollTop)}px, ${sinceCommit}, ` +
                                `margin ${prev.margin}→${sample.margin}, pad ${prev.pad}→${sample.pad}, ` +
                                `frameGap=${sample.t - prev.t}ms, ts=${sample.t}`,
                        );
                    }
                }
            }
            prev = sample;
        };
        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, [scrollerRef, commitRef]);
}

/** Map a `mx_…Body` DOM class onto a readable tile-type token. Falls back to
 * de-camelising any unrecognised `mx_XxxBody` class so new body types surface
 * with a sensible name instead of being lumped into `?`. */
function bodyClassToType(cls: string): string {
    switch (cls) {
        case "mx_MTextBody":
            return "m.text";
        case "mx_MNoticeBody":
            return "m.notice";
        case "mx_MEmoteBody":
            return "m.emote";
        case "mx_MImageBody":
        case "mx_ImageBody":
            return "m.image";
        case "mx_MImageReplyBody":
            return "m.image(reply)";
        case "mx_MVideoBody":
            return "m.video";
        case "mx_MAudioBody":
            return "m.audio";
        case "mx_MVoiceMessageBody":
            return "m.voice";
        case "mx_MFileBody":
            return "m.file";
        case "mx_MStickerBody":
            return "m.sticker";
        case "mx_MLocationBody":
            return "m.location";
        case "mx_MBeaconBody":
            return "m.beacon";
        case "mx_MPollBody":
            return "m.poll";
        case "mx_RedactedBody":
            return "redacted";
        case "mx_DecryptionFailureBody":
            return "decryption-failure";
        case "mx_UnknownBody":
            return "unknown";
        // e.g. "mx_MFooBarBody" → "m.foo-bar", "mx_FooBody" → "foo"
        default:
            return cls
                .replace(/^mx_M?/, "")
                .replace(/Body$/, "")
                .replace(/([a-z])([A-Z])/g, "$1-$2")
                .toLowerCase();
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

/** Cheap structural fingerprint of a row, captured at mount and re-captured on
 * each resize so the audit can say *what* changed, not just that height did. */
interface RowForensics {
    classes: string;
    bodyLen: number;
    bodyPreview: string;
    nodes: number;
    imgs: number;
    /** Images whose bitmap has arrived. An img loading grows the row without any
     * DOM mutation, so node/class diffs alone misreport it as a pure reflow. */
    imgsLoaded: number;
    pres: number;
    pills: number;
    replyRows: number;
    /** Row content width. If this changes between mount and resize the cause is
     * the *container* (scrollbar appearing, panel resize), not the row itself —
     * every text row near a wrap boundary then gains/loses a line at once. */
    width: number;
    /** Serialized-markup length: catches attribute/class/src changes on any
     * descendant that the coarse counters above can't see. */
    htmlLen: number;
}

function snapshotRow(wrapper: HTMLElement): RowForensics {
    const tile = wrapper.querySelector(".mx_EventTile");
    // Info/state tiles have no mx_EventTile_body — their text lives in
    // mx_TextualEvent. Fall back so their text changes (e.g. a member display
    // name resolving after pagination) are visible to the diff instead of
    // misreporting as "no DOM diff".
    const body = wrapper.querySelector(".mx_EventTile_body") ?? wrapper.querySelector(".mx_TextualEvent") ?? tile;
    const imgs = wrapper.querySelectorAll("img");
    let imgsLoaded = 0;
    for (const img of imgs) {
        if ((img as HTMLImageElement).naturalWidth > 0) imgsLoaded += 1;
    }
    return {
        classes: tile?.className ?? "",
        bodyLen: body?.textContent?.length ?? -1,
        bodyPreview: (body?.textContent ?? "").slice(0, 60),
        nodes: wrapper.querySelectorAll("*").length,
        imgs: imgs.length,
        imgsLoaded,
        pres: wrapper.querySelectorAll("pre").length,
        pills: wrapper.querySelectorAll(".mx_Pill").length,
        replyRows: wrapper.querySelectorAll(".mx_ReplyChain").length,
        width: wrapper.clientWidth,
        htmlLen: wrapper.innerHTML.length,
    };
}

/** Human-readable field-by-field diff of two row fingerprints. An empty diff is
 * the most useful outcome: the DOM didn't change, so the resize was a pure
 * re-wrap (font load, container width change, CSS) rather than a content swap. */
function diffForensics(a: RowForensics, b: RowForensics): string {
    const parts: string[] = [];
    if (a.classes !== b.classes) {
        const before = new Set(a.classes.split(/\s+/));
        const after = new Set(b.classes.split(/\s+/));
        const added = [...after].filter((c) => !before.has(c));
        const removed = [...before].filter((c) => !after.has(c));
        if (added.length) parts.push(`+class:${added.join("|")}`);
        if (removed.length) parts.push(`-class:${removed.join("|")}`);
    }
    if (a.bodyLen !== b.bodyLen) parts.push(`bodyLen:${a.bodyLen}→${b.bodyLen}`);
    if (a.imgs !== b.imgs) parts.push(`imgs:${a.imgs}→${b.imgs}`);
    if (a.imgsLoaded !== b.imgsLoaded) parts.push(`imgsLoaded:${a.imgsLoaded}→${b.imgsLoaded}`);
    if (a.pres !== b.pres) parts.push(`pres:${a.pres}→${b.pres}`);
    if (a.pills !== b.pills) parts.push(`pills:${a.pills}→${b.pills}`);
    if (a.replyRows !== b.replyRows) parts.push(`replyRows:${a.replyRows}→${b.replyRows}`);
    if (a.nodes !== b.nodes) parts.push(`nodes:${a.nodes}→${b.nodes}`);
    if (a.width !== b.width) parts.push(`WIDTH:${a.width}→${b.width}`);
    if (a.htmlLen !== b.htmlLen) parts.push(`htmlLen:${a.htmlLen}→${b.htmlLen}`);
    return parts.join(" ") || "(no DOM diff — pure reflow: fonts/wrapping/css)";
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
function HeightAuditProbe({
    itemKey,
    baseLabel,
    children,
}: PropsWithChildren<{ itemKey: string; baseLabel: string }>): ReactNode {
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        let mountType: string | null = null;
        let mountHeight = 0;
        let prevHeight: number | null = null;
        let rowUnstable = false;
        let forensics: RowForensics | null = null;
        const ro = new ResizeObserver((entries) => {
            const h = entries[entries.length - 1].borderBoxSize[0].blockSize;
            if (prevHeight === null) {
                // First delivery == mount. Classify now that the tile has rendered.
                mountType = classifyTile(el, baseLabel);
                mountHeight = h;
                prevHeight = h;
                forensics = snapshotRow(el);
                heightAudit.recordMount(mountType, itemKey);
                return;
            }
            if (h !== prevHeight && mountType) {
                // Re-classify: a placeholder that resolved (e.g. decrypting → image)
                // is now its real type, so attribute the growth to what it became.
                const currentType = classifyTile(el, baseLabel);
                heightAudit.recordResize(
                    currentType,
                    itemKey,
                    mountHeight,
                    prevHeight,
                    h,
                    rowUnstable,
                    detectFeatures(el),
                );
                if (currentType !== mountType) heightAudit.recordTransition(mountType, currentType);
                const next = snapshotRow(el);
                heightAudit.recordDetail({
                    key: itemKey,
                    type: currentType,
                    delta: Math.round(h - prevHeight),
                    heights: `${Math.round(mountHeight)}→${Math.round(prevHeight)}→${Math.round(h)}`,
                    changes: forensics ? diffForensics(forensics, next) : "?",
                    bodyPreview: next.bodyPreview,
                    ts: Math.round(performance.now()),
                });
                forensics = next;
                rowUnstable = true;
                prevHeight = h;
            }
        });
        ro.observe(el);
        return () => ro.disconnect();
    }, [itemKey, baseLabel]);

    return (
        <div ref={ref} style={ITEM_WRAPPER_STYLE}>
            {children}
        </div>
    );
}

export function TimelineView({ vm, renderItem }: TimelineViewProps): JSX.Element {
    const snapshot = useViewModel(vm);
    const virtuosoRef = useRef<VirtuosoHandle>(null);

    // Always-current snapshot reference for callbacks that fire outside React's
    // rendering cycle (Virtuoso's scroll/range/scrollToIndexOnChange callbacks).
    const snapshotRef = useRef(snapshot);
    snapshotRef.current = snapshot;

    // Initial-load cover + anchor settle. Virtuoso mounts hidden behind a centred
    // spinner and places its anchor; once placement settles we reveal it and tell
    // the VM to clear pendingAnchor (re-enabling followOutput).
    //
    // Settle is signalled per placement path: the initial mount uses the scroll
    // location's `done` callback (added by our patch, mirrors scrollIntoView's
    // `done`), which fires once scrollToIndex has converged on the target's final
    // position; in-place reloads call onSettled as soon as they issue the scroll.
    //
    // Holding pendingAnchor (→ followOutput === false) until then is load-bearing
    // on a cold mount: heights are unmeasured, and clearing early flips followOutput
    // back to a function, arming Virtuoso's trapNextSizeIncrease (it checks the
    // prop's identity, not its return value) so the next measure-driven growth
    // snaps the list to the bottom.
    //
    // `revealed` is one-shot (the panel is keyed on roomId, so it resets on room
    // switch); the anchor clear runs for every load.
    const [revealed, setRevealed] = useState(false);
    const revealedRef = useRef(false);
    const onSettled = useCallback(() => {
        scrollTrace("settled");
        if (!revealedRef.current) {
            revealedRef.current = true;
            setRevealed(true);
        }
        vm.onAnchorReached();
    }, [vm]);

    // Debug only: latest scroller pixel metrics, updated on every onScroll, so the
    // endReached trace can report how far (in px) the viewport is from the list
    // bottom. A large distanceFromBottom at endReached means it fired without the
    // user actually being near the bottom (spurious re-trigger); ~0 means genuine.
    const scrollMetaRef = useRef({ scrollTop: 0, scrollHeight: 0, clientHeight: 0, lastScrollTop: 0 });

    // Debug only: per-frame content-jump detection (see useContentJumpDetector).
    // The commit marker timestamps each items/firstItemIndex publish so a logged
    // jump can be attributed to (or ruled out from) a pagination batch.
    const scrollerElRef = useRef<HTMLElement | null>(null);
    const onScrollerRef = useCallback((el: HTMLElement | Window | null) => {
        scrollerElRef.current = el instanceof HTMLElement ? el : null;
    }, []);
    const commitInfoRef = useRef<CommitInfo | null>(null);
    useLayoutEffect(() => {
        if (!DEBUG_JUMPS) return;
        commitInfoRef.current = {
            itemsLen: snapshot.items.length,
            firstItemIndex: snapshot.firstItemIndex,
            at: performance.now(),
        };
    }, [snapshot.items, snapshot.firstItemIndex]);
    useContentJumpDetector(scrollerElRef, commitInfoRef);

    // Wrap each row in the flow-root BFC (see ITEM_WRAPPER_STYLE) so margins stay
    // contained and virtuoso measures the true laid-out height — under-reporting
    // shows up as "missing" scrollTop at the bottom and jumps during back-pagination.
    // In debug builds the audit probe wraps instead, applying the same box.
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

    // First-paint placement. Virtuoso reads this only at mount (it is not keyed on
    // the load, so it survives jump-to-live / jump-to-read-marker data swaps —
    // those go through scrollToIndexOnChange below). The empty-items gate keeps
    // Virtuoso unmounted until the initial load's first publish, so the value read
    // at mount carries that load's pendingAnchor and positions the anchor with no
    // post-mount correction. `done` fires onSettled once Virtuoso converges.
    const { items, pendingAnchor } = snapshot;
    const initialTopMostItemIndex = useMemo<IndexLocationWithAlign>(() => {
        const fallback: IndexLocationWithAlign = {
            index: Math.max(0, items.length - 1),
            align: "end",
            done: onSettled,
        };
        if (!pendingAnchor) return fallback;
        const index = items.findIndex((item) => item.key === pendingAnchor.targetKey);
        if (index === -1) {
            scrollTrace("initialTopMostItemIndex:miss", { targetKey: pendingAnchor.targetKey });
            return fallback;
        }
        scrollTrace("initialTopMostItemIndex", {
            index,
            align: pendingAnchor.align,
            targetKey: pendingAnchor.targetKey,
        });
        return { index, align: pendingAnchor.align, done: onSettled };
    }, [items, pendingAnchor, onSettled]);

    // Placement for in-place loads after the first mount (jump-to-live,
    // jump-to-read-marker). `scrollToIndexOnChange` is added by our patch
    // (patches/react-virtuoso@4.18.5.patch): invoked on every data/count change,
    // and unlike scrollIntoViewOnChange the returned location routes through
    // scrollToIndex — honouring `align` (center) with no "already visible"
    // short-circuit. We act only while a pendingAnchor is set (just after a load);
    // during pagination it is null, so this is a no-op. We settle as soon as the
    // scroll is issued — the reload already has its content, and waiting for the
    // scroll's `done` here left the spinner up noticeably too long.
    const scrollToIndexOnChange = useCallback(
        (params: { totalCount: number; scrollingInProgress: boolean }): IndexLocationWithAlign | false => {
            const snap = snapshotRef.current;
            const anchor = snap.pendingAnchor;
            if (!anchor) return false;
            const arrayIndex = snap.items.findIndex((item) => item.key === anchor.targetKey);
            if (arrayIndex === -1) {
                scrollTrace("scrollToIndexOnChange:miss", {
                    targetKey: anchor.targetKey,
                    totalCount: params.totalCount,
                });
                return false;
            }
            scrollTrace("scrollToIndexOnChange:scroll", {
                index: arrayIndex,
                align: anchor.align,
                targetKey: anchor.targetKey,
                totalCount: params.totalCount,
                scrollingInProgress: params.scrollingInProgress,
            });
            onSettled();
            return { index: arrayIndex, align: anchor.align, behavior: "auto" };
        },
        [onSettled],
    );

    // Debug-only: capture scroller pixel metrics for the endReached trace.
    const onScroll = useCallback((e: React.UIEvent<HTMLElement>) => {
        if (!DEBUG_SCROLL) return;
        const el = e.currentTarget;
        if (!el) return;
        const m = scrollMetaRef.current;
        m.lastScrollTop = m.scrollTop;
        m.scrollTop = el.scrollTop;
        m.scrollHeight = el.scrollHeight;
        m.clientHeight = el.clientHeight;
    }, []);

    // Wrapped pagination + at-bottom callbacks so the View-side trigger is traced
    // immediately before the VM's own [TimelineVM] paginate logs.
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
        virtuosoRef.current?.scrollToIndex({ index: arrayIndex, align: anchor.align, behavior: "auto" });
    }, []);

    // Track the visible range so the VM can persist the scroll position. Settling
    // is handled entirely by the scroll location's `done` (see onSettled), so
    // this no longer participates in anchor placement.
    const onRangeChanged = useCallback(
        (range: { startIndex: number; endIndex: number }) => {
            scrollTrace("rangeChanged", {
                start: range.startIndex,
                end: range.endIndex,
                firstItemIndex: snapshotRef.current.firstItemIndex,
                lastIndex: snapshotRef.current.firstItemIndex + snapshotRef.current.items.length - 1,
            });
            vm.onVisibleRangeChanged(range.startIndex, range.endIndex);
        },
        [vm],
    );

    // Auto-scroll to the bottom on new messages only when the user is already at
    // the bottom AND the window is at the live end.
    //
    // While pendingAnchor is set we return `false` (not a function): Virtuoso's
    // trapNextSizeIncrease checks the prop's identity, not its return value, so a
    // function would let measure-driven growth during the initial load hijack the
    // anchor scroll with a snap to the last item. Disabling it outright avoids that.
    const followOutput = useMemo<boolean | ((isAtBottom: boolean) => boolean)>(() => {
        if (snapshot.pendingAnchor !== null) {
            scrollTrace("followOutput:disabled", { pendingAnchor: snapshot.pendingAnchor.targetKey });
            return false;
        }
        return (isAtBottom: boolean) => {
            const follow = isAtBottom && snapshot.atLiveEnd;
            scrollTrace("followOutput:eval", { isAtBottom, atLiveEnd: snapshot.atLiveEnd, follow });
            return follow;
        };
    }, [snapshot.atLiveEnd, snapshot.pendingAnchor]);

    const EXTENDED_VIEWPORT_HEIGHT = 1000;
    const increaseViewportBy = useMemo(
        () => ({
            top: EXTENDED_VIEWPORT_HEIGHT,
            bottom: EXTENDED_VIEWPORT_HEIGHT,
        }),
        [],
    );

    return (
        <div style={{ height: "100%", width: "100%", position: "relative" }}>
            {snapshot.items.length > 0 && (
                <Virtuoso
                    ref={virtuosoRef}
                    data={snapshot.items}
                    firstItemIndex={snapshot.firstItemIndex}
                    initialTopMostItemIndex={initialTopMostItemIndex}
                    itemContent={itemContent}
                    computeItemKey={computeItemKey}
                    startReached={onStartReached}
                    atBottomStateChange={onAtBottomStateChange}
                    endReached={onEndReached}
                    followOutput={followOutput}
                    scrollToIndexOnChange={scrollToIndexOnChange}
                    increaseViewportBy={increaseViewportBy}
                    onScroll={onScroll}
                    scrollerRef={onScrollerRef}
                    rangeChanged={onRangeChanged}
                    // DEBUG level surfaces virtuoso's own "Upward scrolling
                    // compensation" decisions next to our CONTENT-JUMP lines.
                    logLevel={DEBUG_JUMPS ? LogLevel.DEBUG : LogLevel.ERROR}
                    alignToBottom
                    // Hidden (but still laid out, so heights measure and the
                    // anchor scroll applies) until the initial placement settles;
                    // see the `revealed` cover above.
                    style={{ height: "100%", width: "100%", visibility: revealed ? "visible" : "hidden" }}
                    skipAnimationFrameInResizeObserver={true}
                    // Pin the visible anchor synchronously before paint on a
                    // prepend (history pagination), rather than via Virtuoso's
                    // frame-split deviation→scrollBy dance. With expensive event
                    // tiles the deferred dance paints an uncompensated frame and
                    // the timeline visibly lurches; this keeps the top-of-viewport
                    // message fixed. Opt-in patch prop — see patches/react-virtuoso.
                    maintainVisibleContentPosition={true}
                />
            )}
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

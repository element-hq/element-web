/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { useEffect, useRef, type PropsWithChildren, type ReactNode } from "react";

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
// Extracted from TimelineView.tsx so the TanStack view can use the same tool;
// remove together with the other DEBUG_* flags before merge.
export const DEBUG_SIZES = true;

/** `flow-root` establishes a block formatting context so the row's outer vertical
 * margins don't collapse through the virtualizer's border/padding-less wrapper —
 * which would make the virtualizer's own measurement under-report the laid-out
 * height. */
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
    /** performance.now() of the resize, ms — correlate against the
     * [TimelineView] CONTENT-JUMP `ts=` field to see whether resizes
     * cluster around the frames a jump was detected. */
    ts: number;
}

class HeightAudit {
    private readonly stats = new Map<string, ResizeStat>();
    /** "mountType → resolvedType" → count. Surfaces placeholder→content reveals
     * (e.g. "event:? → event:m.image"), the prime post-mount growth pattern. */
    private readonly transitions = new Map<string, number>();
    /** First N per-resize forensic records (see {@link ResizeDetail}). */
    private readonly details: ResizeDetail[] = [];
    private static readonly MAX_DETAILS = 80;

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
                "maxNetGrowth>0 is the real signal: a row that ended TALLER than it mounted. " +
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
 * DEBUG_SIZES is true; otherwise rows render through their normal wrapper.
 *
 * The probe observes its *own* element — a sibling measurement to the
 * virtualizer's own measurement of the wrapper it renders around this one. They
 * watch different elements so they don't fight, but to avoid "ResizeObserver
 * loop … undelivered notifications" warnings the callback does no layout reads
 * beyond the delivered entry and no synchronous logging — results are aggregated
 * silently and surfaced on demand via report().
 *
 * Ignores deliveries where the element has detached (height 0 / disconnected):
 * a virtualizer removes rows that scroll out of the window, and counting that
 * collapse-to-0 as a "resize" would swamp the audit with unmount noise.
 *
 * @internal
 */
export function HeightAuditProbe({
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
            // Skip the collapse-to-0 that fires as the virtualizer detaches a row
            // scrolling out of the window — it is an unmount, not a content resize.
            if (h === 0 || !el.isConnected) return;
            if (prevHeight === null) {
                // First real delivery == mount. Classify now that the tile rendered.
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

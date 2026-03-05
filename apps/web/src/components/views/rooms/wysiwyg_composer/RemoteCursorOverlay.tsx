/*
Copyright 2026 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { memo, useEffect, useState } from "react";
import { computeNodeAndOffset } from "@vector-im/matrix-wysiwyg";

// ─── Colour palette ──────────────────────────────────────────────────────────

/**
 * Compound-flavoured cursor colours — enough variety for a busy room but
 * visually distinct from the local system caret.
 */
const CURSOR_COLORS = [
    "#0DBD8B", // green
    "#AC3BA8", // purple
    "#FF812D", // orange
    "#1E7DDC", // blue
    "#E34979", // pink
    "#368BD6", // lighter blue
    "#F5B731", // gold
    "#E26D69", // salmon
] as const;

/** FNV-1a (32-bit) hash for deterministic colour assignment. */
function fnv32a(str: string): number {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
}

export function colorForActor(actorId: string): string {
    return CURSOR_COLORS[fnv32a(actorId) % CURSOR_COLORS.length];
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface RemoteCursor {
    /** UTF-16 character offset of the selection anchor. */
    anchor: number;
    /** UTF-16 character offset of the selection focus (equals anchor for a plain caret). */
    focus: number;
    /** Colour string assigned to this remote participant. */
    color: string;
}

interface RemoteCursorOverlayProps {
    /** Ref to the contentEditable editor element. */
    editorRef: React.RefObject<HTMLElement | null>;
    /** Ref to the scroll container (the `.mx_DocumentView_content` div). */
    scrollContainerRef: React.RefObject<HTMLElement | null>;
    /** Map of actorId → cursor state for all remote peers. */
    cursors: ReadonlyMap<string, RemoteCursor>;
}

// ─── Geometry helpers ────────────────────────────────────────────────────────

interface Rect {
    top: number;
    left: number;
    width: number;
    height: number;
}

/**
 * Compute client rects for a selection range described by UTF-16 model offsets
 * inside the editor.
 *
 * Uses `computeNodeAndOffset` from the RTE package, which correctly accounts
 * for the implicit +1 separator the Rust model adds at block boundaries
 * (paragraph, list item, etc.).
 *
 * IMPORTANT: This function must NOT touch `window.getSelection()` because it
 * runs during React render (inside the overlay component).  Mutating the
 * window selection from render would:
 *   - Destroy backward mouse-drag selections in progress
 *   - Trigger `selectionchange` events that feed back into the Rust model
 *     with the wrong (remote) offsets
 *
 * Instead we build a detached DOM Range from the resolved nodes and read its
 * client rects — purely read-only with no side effects.
 */
function rectsForRange(
    editor: HTMLElement,
    start: number,
    end: number,
    containerRect: DOMRect,
    scrollTop: number,
): { caretRect: Rect | null; selectionRects: Rect[] } {
    const min = Math.min(start, end);
    const max = Math.max(start, end);

    // Resolve model offsets → (DOM node, char offset) using the RTE's
    // block-separator-aware walker.
    const startPos = computeNodeAndOffset(editor, min);
    const endPos = computeNodeAndOffset(editor, max);

    if (!startPos.node || !endPos.node) return { caretRect: null, selectionRects: [] };

    const range = document.createRange();
    try {
        range.setStart(startPos.node, startPos.offset);
        range.setEnd(endPos.node, endPos.offset);
    } catch {
        // Invalid offsets (e.g. past end of text node) — bail gracefully.
        return { caretRect: null, selectionRects: [] };
    }

    let rects = Array.from(range.getClientRects());
    // Collapsed range on a <br> or empty container returns no rects in some
    // browsers — fall back to the bounding rect.
    if (rects.length === 0) {
        const b = range.getBoundingClientRect();
        if (b.width !== 0 || b.height !== 0) rects = [b as DOMRect];
    }

    const translate = (r: DOMRect): Rect => ({
        top: r.top - containerRect.top + scrollTop,
        left: r.left - containerRect.left,
        width: r.width,
        height: r.height,
    });

    if (start === end) {
        // Collapsed caret: single zero-width rect.
        const r = rects[0];
        if (!r) return { caretRect: null, selectionRects: [] };
        return { caretRect: translate(r), selectionRects: [] };
    }

    // Selection: caretRect at the focus end, selectionRects for highlighting.
    const focusIsEnd = end === Math.max(start, end);
    const caretDomRect = focusIsEnd ? rects[rects.length - 1] : rects[0];
    const caretRect = caretDomRect
        ? {
              top: caretDomRect.top - containerRect.top + scrollTop,
              left: focusIsEnd
                  ? caretDomRect.right - containerRect.left
                  : caretDomRect.left - containerRect.left,
              width: 0,
              height: caretDomRect.height,
          }
        : null;

    return { caretRect, selectionRects: rects.map(translate) };
}

// ─── Component ───────────────────────────────────────────────────────────────

export const RemoteCursorOverlay = memo(function RemoteCursorOverlay({
    editorRef,
    scrollContainerRef,
    cursors,
}: RemoteCursorOverlayProps) {
    // Force a re-render when the DOM geometry changes so cursor positions
    // update after scrolling, resizing, or remote content changes.
    const [, setTick] = useState(0);
    const bump = (): void => setTick((t) => t + 1);

    useEffect(() => {
        const container = scrollContainerRef.current;
        if (!container) return;

        // Scroll → reposition.
        container.addEventListener("scroll", bump, { passive: true });

        // Resize → reposition.
        const ro = new ResizeObserver(bump);
        ro.observe(container);

        // Content changes → reposition.
        const mo = new MutationObserver(bump);
        if (editorRef.current) {
            mo.observe(editorRef.current, {
                childList: true,
                subtree: true,
                characterData: true,
            });
        }

        return () => {
            container.removeEventListener("scroll", bump);
            ro.disconnect();
            mo.disconnect();
        };
    }, [editorRef, scrollContainerRef]);

    const editor = editorRef.current;
    const scrollContainer = scrollContainerRef.current;
    if (!editor || !scrollContainer || cursors.size === 0) return null;

    const containerRect = scrollContainer.getBoundingClientRect();
    const scrollTop = scrollContainer.scrollTop;

    const elements: React.ReactNode[] = [];

    for (const [actorId, cursor] of cursors) {
        const { caretRect, selectionRects } = rectsForRange(
            editor,
            cursor.anchor,
            cursor.focus,
            containerRect,
            scrollTop,
        );

        // Selection highlight rects.
        for (let i = 0; i < selectionRects.length; i++) {
            const r = selectionRects[i];
            elements.push(
                <div
                    key={`${actorId}-sel-${i}`}
                    className="mx_RemoteCursorOverlay_selection"
                    style={{
                        top: r.top,
                        left: r.left,
                        width: r.width,
                        height: r.height,
                        backgroundColor: cursor.color,
                    }}
                />,
            );
        }

        // Caret line.
        if (caretRect) {
            elements.push(
                <div
                    key={`${actorId}-caret`}
                    className="mx_RemoteCursorOverlay_caret"
                    style={{
                        top: caretRect.top,
                        left: caretRect.left,
                        height: caretRect.height,
                        borderColor: cursor.color,
                    }}
                />,
            );
        }
    }

    return (
        <div className="mx_RemoteCursorOverlay" aria-hidden="true">
            {elements}
        </div>
    );
});

/*
Copyright 2026 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { memo, useEffect, useState } from "react";

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
 * Compute client rects for a selection range described by UTF-16 offsets
 * inside the editor.  Uses a temporary DOM Range via `selectContent()` would
 * be disruptive (it moves the real selection), so we walk text nodes manually.
 */
function rectsForRange(
    editor: HTMLElement,
    start: number,
    end: number,
    containerRect: DOMRect,
    scrollTop: number,
): { caretRect: Rect | null; selectionRects: Rect[] } {
    // Walk text nodes, converting UTF-16 code-unit offsets to DOM positions.
    const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
    let consumed = 0;

    let startNode: Text | null = null;
    let startOffset = 0;
    let endNode: Text | null = null;
    let endOffset = 0;

    const min = Math.min(start, end);
    const max = Math.max(start, end);

    while (walker.nextNode()) {
        const text = walker.currentNode as Text;
        const len = text.length; // JS string length === UTF-16 code units

        if (!startNode && consumed + len >= min) {
            startNode = text;
            startOffset = min - consumed;
        }
        if (!endNode && consumed + len >= max) {
            endNode = text;
            endOffset = max - consumed;
            break;
        }
        consumed += len;
    }

    if (!startNode || !endNode) return { caretRect: null, selectionRects: [] };

    const range = document.createRange();
    range.setStart(startNode, startOffset);
    range.setEnd(endNode, endOffset);

    const rects = Array.from(range.getClientRects());
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
              // Position the caret at the correct edge of the rect.
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

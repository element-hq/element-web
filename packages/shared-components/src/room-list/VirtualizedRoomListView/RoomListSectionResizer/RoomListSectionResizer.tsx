/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { memo, useCallback, useEffect, useRef, useState, type JSX } from "react";
import classNames from "classnames";
import { IconButton } from "@vector-im/compound-web";
import CollapseIcon from "@vector-im/compound-design-tokens/assets/web/icons/collapse";
import ExpandIcon from "@vector-im/compound-design-tokens/assets/web/icons/expand";

import styles from "./RoomListSectionResizer.module.css";
import { useI18n } from "../../../core/i18n/i18nContext";

/** The number of rooms a section is shrunk to by its minimise button. */
export const MINIMISED_SECTION_VISIBLE_COUNT = 5;

/**
 * Props for {@link RoomListSectionResizer}.
 */
export interface RoomListSectionResizerProps {
    /** The ID of the section ABOVE this divider — the one the divider resizes. */
    sectionId: string;
    /** How many rooms of that section are currently shown; fractional when the boundary row is clipped. */
    visibleCount: number;
    /** How many rooms that section has in total (ignoring truncation). */
    totalCount: number;
    /** Height in pixels of one room list item, used to convert the drag distance into rooms. */
    itemHeight: number;
    /** Called with the new visible count while resizing; `undefined` shows all rooms. */
    onResize: (sectionId: string, visibleCount: number | undefined) => void;
}

/** Mutable state for an in-progress divider drag. */
interface DragState {
    /** Pointer Y at drag start. */
    startY: number;
    /** Visible room count at drag start. */
    startCount: number;
    /** Last observed pointer Y, for velocity measurement. */
    lastY: number;
    /** Timestamp of the last velocity/animation sample (ms). */
    lastT: number;
    /** Smoothed pointer velocity in px/ms, kept while the pointer is inside the viewport. */
    velocity: number;
    /** The drag distance in px driving the resize — pointer-derived inside the viewport, velocity-driven outside. */
    virtualDelta: number;
    /** The visible count last sent to onResize, to avoid redundant updates. */
    lastSent: number;
    /** Whether the pointer is currently outside the viewport (velocity mode). */
    outside: boolean;
    /** Handle of the velocity-mode animation frame, if one is scheduled. */
    raf: number | null;
    /** The body cursor/user-select values to restore when the drag ends. */
    restoreBodyStyle: [cursor: string, userSelect: string];
}

/**
 * The draggable divider between two room list sections.
 *
 * Rendered along the top edge of a section header, it resizes the section ABOVE it: dragging
 * the divider changes how many of that section's rooms are shown, tracking the pointer
 * smoothly (the row at the boundary is partially clipped between whole rows).
 * When the pointer leaves the viewport mid-drag, the resize keeps going at the pointer's last
 * speed until the pointer returns or is released. Hovering the divider also reveals a button
 * that maximises a shrunken section, or shrinks a full one down to
 * {@link MINIMISED_SECTION_VISIBLE_COUNT} rooms.
 *
 * This is a pointer-only affordance (hidden from the accessibility tree): keyboard and screen
 * reader users can collapse/expand sections from their headers instead.
 */
export const RoomListSectionResizer = memo(function RoomListSectionResizer({
    sectionId,
    visibleCount,
    totalCount,
    itemHeight,
    onResize,
}: Readonly<RoomListSectionResizerProps>): JSX.Element {
    const { translate: _t } = useI18n();
    const [isDragging, setIsDragging] = useState(false);

    // The drag handlers live on window (the divider's DOM node can be recycled by the
    // virtualized list mid-drag), so they read the latest props through a ref.
    const propsRef = useRef({ sectionId, visibleCount, totalCount, itemHeight, onResize });
    propsRef.current = { sectionId, visibleCount, totalCount, itemHeight, onResize };

    const dragRef = useRef<DragState | null>(null);

    /** Convert the current virtualDelta into a visible count and push it to the view model. */
    const applyDrag = useCallback((): void => {
        const drag = dragRef.current;
        if (!drag) return;
        const { sectionId, totalCount, itemHeight, onResize } = propsRef.current;
        // Continuous (fractional) count, so the boundary follows the pointer smoothly rather
        // than snapping to whole rows; the view model clips the boundary row to the fraction.
        const target = drag.startCount + drag.virtualDelta / itemHeight;
        const clamped = Math.min(Math.max(target, 1), totalCount);
        // Skip sub-pixel changes to avoid churning the room list for nothing.
        if (Math.abs(clamped - drag.lastSent) * itemHeight < 1) return;
        drag.lastSent = clamped;
        onResize(sectionId, clamped >= totalCount ? undefined : clamped);
    }, []);

    /** Velocity mode: keep resizing at the last measured speed while the pointer is off-screen. */
    const velocityTick = useCallback(
        (now: number): void => {
            const drag = dragRef.current;
            if (!drag || !drag.outside) return;
            drag.virtualDelta += drag.velocity * (now - drag.lastT);
            drag.lastT = now;
            applyDrag();
            drag.raf = requestAnimationFrame(velocityTick);
        },
        [applyDrag],
    );

    const onWindowPointerMove = useCallback(
        (e: PointerEvent): void => {
            const drag = dragRef.current;
            if (!drag) return;
            const now = performance.now();
            const inside = e.clientY >= 0 && e.clientY <= window.innerHeight;

            if (inside) {
                // Pointer authority: follow the pointer and keep the velocity sample fresh so
                // that leaving the viewport continues at the speed the pointer was moving.
                const dt = now - drag.lastT;
                if (dt > 0) {
                    const instantaneous = (e.clientY - drag.lastY) / dt;
                    drag.velocity = drag.velocity * 0.7 + instantaneous * 0.3;
                }
                if (drag.raf !== null) {
                    cancelAnimationFrame(drag.raf);
                    drag.raf = null;
                }
                drag.outside = false;
                drag.virtualDelta = e.clientY - drag.startY;
                drag.lastY = e.clientY;
                drag.lastT = now;
                applyDrag();
            } else if (!drag.outside) {
                // Pointer left the viewport: switch to velocity mode from the current position.
                drag.outside = true;
                drag.lastY = e.clientY;
                drag.lastT = now;
                drag.raf = requestAnimationFrame(velocityTick);
            }
        },
        [applyDrag, velocityTick],
    );

    const endDrag = useCallback((): void => {
        const drag = dragRef.current;
        if (!drag) return;
        if (drag.raf !== null) cancelAnimationFrame(drag.raf);
        const [cursor, userSelect] = drag.restoreBodyStyle;
        document.body.style.cursor = cursor;
        document.body.style.userSelect = userSelect;
        dragRef.current = null;
        window.removeEventListener("pointermove", onWindowPointerMove);
        window.removeEventListener("pointerup", endDrag);
        window.removeEventListener("pointercancel", endDrag);
        setIsDragging(false);
    }, [onWindowPointerMove]);

    const onPointerDown = useCallback(
        (e: React.PointerEvent): void => {
            if (e.button !== 0 || dragRef.current) return;
            // Keep the pointer-down from starting a section drag-and-drop, moving focus, or
            // selecting text.
            e.preventDefault();
            e.stopPropagation();
            dragRef.current = {
                startY: e.clientY,
                startCount: propsRef.current.visibleCount,
                lastY: e.clientY,
                lastT: performance.now(),
                velocity: 0,
                virtualDelta: 0,
                lastSent: propsRef.current.visibleCount,
                outside: false,
                raf: null,
                restoreBodyStyle: [document.body.style.cursor, document.body.style.userSelect],
            };
            // The element under the pointer changes as rooms appear/disappear, so pin the
            // cursor on the body for the duration of the drag.
            document.body.style.cursor = "ns-resize";
            document.body.style.userSelect = "none";
            window.addEventListener("pointermove", onWindowPointerMove);
            window.addEventListener("pointerup", endDrag);
            window.addEventListener("pointercancel", endDrag);
            setIsDragging(true);
        },
        [onWindowPointerMove, endDrag],
    );

    // If the divider unmounts mid-drag (e.g. recycled out of the virtualized window), tear the
    // drag down so no window listeners or body styles leak.
    useEffect(() => endDrag, [endDrag]);

    const isShrunken = visibleCount < totalCount;
    // A full section that couldn't get any smaller from minimising has nothing to offer.
    const showButton = isShrunken || totalCount > MINIMISED_SECTION_VISIBLE_COUNT;

    return (
        // eslint-disable-next-line jsx-a11y/no-static-element-interactions
        <div
            className={classNames(styles.resizer, { [styles.dragging]: isDragging })}
            onPointerDown={onPointerDown}
            aria-hidden={true}
            data-testid="section-resizer"
        >
            {showButton && (
                <IconButton
                    className={styles.button}
                    size="20px"
                    tabIndex={-1}
                    aria-label={
                        isShrunken
                            ? _t("room_list|section_resizer|show_all")
                            : _t("room_list|section_resizer|show_fewer")
                    }
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={() => onResize(sectionId, isShrunken ? undefined : MINIMISED_SECTION_VISIBLE_COUNT)}
                >
                    {isShrunken ? <ExpandIcon /> : <CollapseIcon />}
                </IconButton>
            )}
        </div>
    );
});

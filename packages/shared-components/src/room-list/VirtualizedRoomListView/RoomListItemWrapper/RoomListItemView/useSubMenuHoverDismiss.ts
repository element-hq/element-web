/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { useCallback, useEffect, useRef, useState } from "react";

/**
 * Grace period, in milliseconds, allowed for the pointer to travel from the
 * submenu's trigger into the submenu itself before the submenu is dismissed.
 */
const HOVER_DISMISS_GRACE_MS = 300;

export interface SubMenuHoverDismiss {
    /** Whether the submenu is open. */
    open: boolean;
    /** Handler for the submenu's own open state changes. */
    onOpenChange: (open: boolean) => void;
    /** `onPointerLeave` for the submenu's trigger. */
    onTriggerPointerLeave: React.PointerEventHandler;
    /** `onPointerOver` for the submenu's contents. */
    onContentPointerOver: React.PointerEventHandler;
}

/**
 * Dismisses an open submenu when the mouse wanders away from it, without
 * dismissing the parent menu.
 *
 * Radix dismisses a submenu when the pointer reaches a sibling menu item or
 * leaves the menu altogether, but not when it lands on parent-menu space that
 * is not an item — the gap between items, or the padding — which is what
 * leaves the submenu stranded on screen.
 *
 * The behaviour implemented here is the standard cascade-menu pattern:
 *
 * - If the mouse never made it into the submenu, treat the open as accidental
 *   and dismiss the submenu shortly after the mouse leaves the trigger.
 * - Once the mouse has been over an item of the submenu, the user has shown
 *   intent, so keep it open until they explicitly dismiss it.
 *
 * Dismissal is only ever driven by a mouse, so submenus opened by keyboard or
 * touch are left alone rather than disappearing from under a user who cannot
 * chase them with a pointer.
 */
export function useSubMenuHoverDismiss(): SubMenuHoverDismiss {
    const [open, setOpen] = useState(false);

    // Whether the mouse has been inside the submenu during this open cycle.
    // Once it has, hovering out no longer dismisses the submenu.
    const hasEnteredContent = useRef(false);
    const dismissTimer = useRef<number | undefined>(undefined);

    const clearDismissTimer = useCallback((): void => {
        if (dismissTimer.current !== undefined) {
            window.clearTimeout(dismissTimer.current);
            dismissTimer.current = undefined;
        }
    }, []);

    // Start each open cycle with a clean slate.
    useEffect(() => {
        if (!open) {
            hasEnteredContent.current = false;
            clearDismissTimer();
        }
    }, [open, clearDismissTimer]);

    useEffect(() => clearDismissTimer, [clearDismissTimer]);

    const onTriggerPointerLeave = useCallback<React.PointerEventHandler>(
        (event) => {
            if (event.pointerType !== "mouse") return;
            // The trigger stays mounted while the submenu is closed, so
            // leaving it is routine and means nothing.
            if (!open) return;
            // The user has already committed to the submenu; leave it be.
            if (hasEnteredContent.current) return;
            clearDismissTimer();
            dismissTimer.current = window.setTimeout(() => {
                dismissTimer.current = undefined;
                if (!hasEnteredContent.current) setOpen(false);
            }, HOVER_DISMISS_GRACE_MS);
        },
        [open, clearDismissTimer],
    );

    const onContentPointerOver = useCallback<React.PointerEventHandler>(
        (event) => {
            if (event.pointerType !== "mouse") return;
            hasEnteredContent.current = true;
            clearDismissTimer();
        },
        [clearDismissTimer],
    );

    return { open, onOpenChange: setOpen, onTriggerPointerLeave, onContentPointerOver };
}

/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { type PointerEvent } from "react";
import { act, renderHook } from "@test-utils";
import { vi, describe, expect, it, beforeEach, afterEach } from "vitest";

import { useSubMenuHoverDismiss } from "./useSubMenuHoverDismiss";

/**
 * The hook only inspects the pointer type, so a stub is enough. This keeps
 * these tests independent of Radix and of element geometry — the end-to-end
 * behaviour is covered by
 * `apps/web/playwright/e2e/left-panel/room-list-panel/room-list-submenu-hover.spec.ts`,
 * which drives a real mouse.
 */
const pointerEvent = (pointerType: string): PointerEvent => ({ pointerType }) as PointerEvent;

const mouse = pointerEvent("mouse");
const touch = pointerEvent("touch");

/** Comfortably longer than the hook's internal grace period. */
const PAST_GRACE_PERIOD = 500;

describe("useSubMenuHoverDismiss", () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    /** Renders the hook and opens the submenu, as hovering the trigger would. */
    function openSubMenu() {
        const { result } = renderHook(() => useSubMenuHoverDismiss());

        act(() => result.current.onOpenChange(true));
        expect(result.current.open).toBe(true);

        return result;
    }

    it("should dismiss the submenu when the mouse leaves the trigger without entering it", () => {
        const result = openSubMenu();

        act(() => result.current.onTriggerPointerLeave(mouse));
        // The pointer is given time to travel, so nothing happens immediately.
        expect(result.current.open).toBe(true);

        act(() => vi.advanceTimersByTime(PAST_GRACE_PERIOD));

        expect(result.current.open).toBe(false);
    });

    it("should keep the submenu open once the mouse has entered it", () => {
        const result = openSubMenu();

        act(() => result.current.onContentPointerOver(mouse));
        act(() => result.current.onTriggerPointerLeave(mouse));
        act(() => vi.advanceTimersByTime(PAST_GRACE_PERIOD));

        expect(result.current.open).toBe(true);
    });

    it("should cancel dismissal when the mouse reaches the submenu within the grace period", () => {
        const result = openSubMenu();

        act(() => result.current.onTriggerPointerLeave(mouse));
        act(() => result.current.onContentPointerOver(mouse));
        act(() => vi.advanceTimersByTime(PAST_GRACE_PERIOD));

        expect(result.current.open).toBe(true);
    });

    it("should never dismiss the submenu for non-mouse pointers", () => {
        const result = openSubMenu();

        act(() => result.current.onTriggerPointerLeave(touch));
        act(() => vi.advanceTimersByTime(PAST_GRACE_PERIOD));

        expect(result.current.open).toBe(true);
    });

    it("should not let a touch inside the submenu make it sticky for the mouse", () => {
        const result = openSubMenu();

        act(() => result.current.onContentPointerOver(touch));
        act(() => result.current.onTriggerPointerLeave(mouse));
        act(() => vi.advanceTimersByTime(PAST_GRACE_PERIOD));

        expect(result.current.open).toBe(false);
    });

    it("should ignore the mouse leaving the trigger while the submenu is closed", () => {
        const { result } = renderHook(() => useSubMenuHoverDismiss());
        expect(result.current.open).toBe(false);

        act(() => result.current.onTriggerPointerLeave(mouse));
        act(() => vi.advanceTimersByTime(PAST_GRACE_PERIOD));

        expect(result.current.open).toBe(false);
    });

    it("should start each open cycle with a clean slate", () => {
        const result = openSubMenu();

        // First cycle: the user commits to the submenu, then it is dismissed.
        act(() => result.current.onContentPointerOver(mouse));
        act(() => result.current.onOpenChange(false));
        expect(result.current.open).toBe(false);

        // Second cycle: the stickiness must not have carried over.
        act(() => result.current.onOpenChange(true));
        act(() => result.current.onTriggerPointerLeave(mouse));
        act(() => vi.advanceTimersByTime(PAST_GRACE_PERIOD));

        expect(result.current.open).toBe(false);
    });

    it("should not dismiss the submenu after the hook has unmounted", () => {
        const { result, unmount } = renderHook(() => useSubMenuHoverDismiss());

        act(() => result.current.onOpenChange(true));
        act(() => result.current.onTriggerPointerLeave(mouse));
        unmount();

        // The pending timer must have been cleared, not fired against a gone component.
        expect(() => act(() => vi.advanceTimersByTime(PAST_GRACE_PERIOD))).not.toThrow();
    });
});

/*
Copyright 2026 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { describe, expect, it } from "vitest";

import { buildTitleBarCss } from "./macos-titlebar.js";

/**
 * Extract the `height` (in px) declared for the given selector.
 *
 * A selector may appear in more than one rule block (e.g. `.mx_SpaceRoomView::before` is both grouped with
 * `.mx_RoomView::before` for the drag declaration and given its own block for the height). We scan every
 * block whose selector list contains the target and return the height from the first block that declares one.
 */
function dragStripHeightPx(css: string, selector: string): number {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const blockRegex = new RegExp(`([^{}]*${escaped}[^{}]*)\\{([^}]*)\\}`, "g");
    let match: RegExpExecArray | null;
    let foundBlock = false;
    while ((match = blockRegex.exec(css)) !== null) {
        foundBlock = true;
        const heightMatch = /height:\s*(\d+(?:\.\d+)?)px/.exec(match[2]);
        if (heightMatch) {
            return Number.parseFloat(heightMatch[1]);
        }
    }
    expect(foundBlock, `expected a rule block for "${selector}"`).toBe(true);
    throw new Error(`expected a px height declared for "${selector}"`);
}

describe("buildTitleBarCss", () => {
    const css = buildTitleBarCss();

    it("returns a non-empty CSS string", () => {
        expect(typeof css).toBe("string");
        expect(css.length).toBeGreaterThan(0);
    });

    it.each([".mx_RoomView::before", ".mx_LeftPanel::before", ".mx_SpaceRoomView::before"])(
        "marks %s as a drag handle",
        (selector) => {
            const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            const blockMatch = new RegExp(`${escaped}[^}]*\\{([^}]*)\\}`).exec(css);
            expect(blockMatch, `expected a rule block for "${selector}"`).not.toBeNull();
            expect(blockMatch![1]).toMatch(/-webkit-app-region:\s*drag/);
        },
    );

    // Regression guard for #32018: the drag strips above the headers were ~13px and too small to grab.
    it("gives .mx_RoomView::before a drag strip at least 28px tall (regression #32018)", () => {
        expect(dragStripHeightPx(css, ".mx_RoomView::before")).toBeGreaterThanOrEqual(28);
    });

    it("gives .mx_LeftPanel_newRoomList::before a drag strip at least 28px tall (regression #32018)", () => {
        expect(dragStripHeightPx(css, ".mx_LeftPanel_newRoomList::before")).toBeGreaterThanOrEqual(28);
    });

    it("gives .mx_LeftPanel::before a drag strip at least 28px tall (regression #32018)", () => {
        expect(dragStripHeightPx(css, ".mx_LeftPanel::before")).toBeGreaterThanOrEqual(28);
    });

    it("gives .mx_SpaceRoomView::before a drag strip at least 28px tall (regression #32018)", () => {
        expect(dragStripHeightPx(css, ".mx_SpaceRoomView::before")).toBeGreaterThanOrEqual(28);
    });

    it("keeps interactive elements excluded from the drag region (no-drag)", () => {
        // The UserMenu buttons must remain clickable, not act as a drag handle.
        expect(css).toMatch(/\.mx_UserMenu\s*>\s*\*\s*\{[^}]*-webkit-app-region:\s*no-drag/);
    });

    it("keeps iframes excluded from the drag region (no-drag)", () => {
        // iframes (e.g. recaptcha, widgets) must remain interactive.
        expect(css).toMatch(/iframe\s*\{[^}]*-webkit-app-region:\s*no-drag/);
    });

    it("does not turn the traffic-light offset into a no-drag handle on .mx_UserMenu itself", () => {
        // The UserMenu container itself stays a drag handle (only its children are no-drag).
        expect(css).toMatch(/\.mx_UserMenu\s*\{[^}]*-webkit-app-region:\s*drag/);
    });
});

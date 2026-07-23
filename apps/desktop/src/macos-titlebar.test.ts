/*
Copyright 2026 Spencer Poisseroux
Copyright 2026 hayaksi1

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { afterEach, describe, expect, it, vi, type Mock } from "vitest";
import type { BrowserWindow } from "electron";

import { buildTitleBarCss, setupMacosTitleBar } from "./macos-titlebar.js";

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

    it("gives .mx_LeftPanel::before a drag strip at least 28px tall (regression #32018)", () => {
        expect(dragStripHeightPx(css, ".mx_LeftPanel::before")).toBeGreaterThanOrEqual(28);
    });

    it("gives .mx_SpaceRoomView::before a drag strip at least 28px tall (regression #32018)", () => {
        expect(dragStripHeightPx(css, ".mx_SpaceRoomView::before")).toBeGreaterThanOrEqual(28);
    });

    it("keeps the left panel's separator on its drag strip", () => {
        // The strip carries the panel's right-hand border up through the title bar band; widening it must not drop it.
        expect(css).toMatch(
            /\.mx_LeftPanel::before\s*\{[^}]*border-right:\s*1px\s+solid\s+var\(--cpd-color-bg-subtle-primary\)/,
        );
    });

    // Regression guard for #34243: against the default 68px rail the collapsed space panel's right-hand
    // separator crowds the green traffic light, so the panel is widened to clear it.
    it("widens the collapsed space panel so the separator clears the traffic lights", () => {
        expect(css).toMatch(/\.mx_SpacePanel\.collapsed\s*\{[^}]*width:\s*76px\s*!important/);
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

describe("setupMacosTitleBar", () => {
    /** Minimal `BrowserWindow` stand-in: the module only ever touches these members. */
    function mockWindow(): {
        window: BrowserWindow;
        windowHandlers: Map<string, () => void>;
        webContentsHandlers: Map<string, () => void>;
        insertCSS: Mock;
        removeInsertedCSS: Mock;
        isFullScreen: Mock;
    } {
        const windowHandlers = new Map<string, () => void>();
        const webContentsHandlers = new Map<string, () => void>();
        const insertCSS = vi.fn<(css: string) => Promise<string>>().mockResolvedValue("css-key-1");
        const removeInsertedCSS = vi.fn<(key: string) => Promise<void>>().mockResolvedValue(undefined);
        const isFullScreen = vi.fn<() => boolean>().mockReturnValue(false);

        const window = {
            on: vi.fn((event: string, handler: () => void) => {
                windowHandlers.set(event, handler);
            }),
            isFullScreen,
            webContents: {
                on: vi.fn((event: string, handler: () => void) => {
                    webContentsHandlers.set(event, handler);
                }),
                insertCSS,
                removeInsertedCSS,
            },
        } as unknown as BrowserWindow;

        return { window, windowHandlers, webContentsHandlers, insertCSS, removeInsertedCSS, isFullScreen };
    }

    /**
     * The listeners are `() => void` and start `applyStyling()` without awaiting it, so awaiting a handler's
     * own return value would prove nothing. Yield to the macrotask queue instead, which drains the pending
     * microtasks and lets that fire-and-forget promise settle before we assert on its effects.
     */
    function flushStyling(): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, 0));
    }

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("does nothing on non-darwin platforms", () => {
        vi.spyOn(process, "platform", "get").mockReturnValue("win32");
        const { window, insertCSS } = mockWindow();

        setupMacosTitleBar(window);

        expect(window.on).not.toHaveBeenCalled();
        expect(window.webContents.on).not.toHaveBeenCalled();
        expect(insertCSS).not.toHaveBeenCalled();
    });

    it("registers the full-screen and load listeners on darwin", () => {
        vi.spyOn(process, "platform", "get").mockReturnValue("darwin");
        const { window } = mockWindow();

        setupMacosTitleBar(window);

        expect(window.on).toHaveBeenCalledWith("enter-full-screen", expect.any(Function));
        expect(window.on).toHaveBeenCalledWith("leave-full-screen", expect.any(Function));
        expect(window.webContents.on).toHaveBeenCalledWith("did-finish-load", expect.any(Function));
    });

    it("injects the title bar CSS once the page has loaded", async () => {
        vi.spyOn(process, "platform", "get").mockReturnValue("darwin");
        const { window, webContentsHandlers, insertCSS } = mockWindow();

        setupMacosTitleBar(window);
        webContentsHandlers.get("did-finish-load")!();
        await flushStyling();

        expect(insertCSS).toHaveBeenCalledOnce();
        expect(insertCSS).toHaveBeenCalledWith(buildTitleBarCss());
    });

    it("does not inject the CSS if the window loads while already full screen", async () => {
        vi.spyOn(process, "platform", "get").mockReturnValue("darwin");
        const { window, webContentsHandlers, insertCSS, isFullScreen } = mockWindow();
        isFullScreen.mockReturnValue(true);

        setupMacosTitleBar(window);
        webContentsHandlers.get("did-finish-load")!();
        await flushStyling();

        expect(insertCSS).not.toHaveBeenCalled();
    });

    it("removes the injected CSS when entering full screen", async () => {
        vi.spyOn(process, "platform", "get").mockReturnValue("darwin");
        const { window, windowHandlers, webContentsHandlers, removeInsertedCSS } = mockWindow();

        setupMacosTitleBar(window);
        webContentsHandlers.get("did-finish-load")!();
        await flushStyling();
        windowHandlers.get("enter-full-screen")!();

        expect(removeInsertedCSS).toHaveBeenCalledWith("css-key-1");
    });

    it("does not attempt to remove the CSS if none was ever injected", async () => {
        vi.spyOn(process, "platform", "get").mockReturnValue("darwin");
        const { window, windowHandlers, removeInsertedCSS } = mockWindow();

        setupMacosTitleBar(window);
        windowHandlers.get("enter-full-screen")!();
        await flushStyling();

        expect(removeInsertedCSS).not.toHaveBeenCalled();
    });

    it("re-injects the CSS when leaving full screen", async () => {
        vi.spyOn(process, "platform", "get").mockReturnValue("darwin");
        const { window, windowHandlers, insertCSS } = mockWindow();

        setupMacosTitleBar(window);
        windowHandlers.get("leave-full-screen")!();
        await flushStyling();

        expect(insertCSS).toHaveBeenCalledWith(buildTitleBarCss());
    });
});

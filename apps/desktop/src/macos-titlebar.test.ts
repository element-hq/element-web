/*
Copyright 2026 Spencer Poisseroux
Copyright 2026 hayaksi1

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { afterEach, describe, expect, it, vi, type Mock } from "vitest";
import type { BrowserWindow } from "electron";

import { buildTitleBarCss, setupMacosTitleBar, TITLE_BAR_HEIGHT_PX } from "./macos-titlebar.js";

/**
 * Extract the declaration block for the first rule whose selector list contains the given selector.
 */
function ruleBlock(css: string, selector: string): string {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const blockMatch = new RegExp(`[^{}]*${escaped}[^{}]*\\{([^}]*)\\}`).exec(css);
    expect(blockMatch, `expected a rule block for "${selector}"`).not.toBeNull();
    return blockMatch![1];
}

describe("buildTitleBarCss", () => {
    const css = buildTitleBarCss();

    it("returns a non-empty CSS string", () => {
        expect(typeof css).toBe("string");
        expect(css.length).toBeGreaterThan(0);
    });

    it("draws the title bar band at the designed height", () => {
        const bar = ruleBlock(css, "body::before");
        expect(bar).toMatch(new RegExp(`height:\\s*${TITLE_BAR_HEIGHT_PX}px`));
        expect(bar).toMatch(/position:\s*fixed/);
    });

    it("styles the title bar with the canvas background and separator tokens", () => {
        // Matches the design spec: bg/canvas/default fill with a 1px separator/primary hairline below.
        const bar = ruleBlock(css, "body::before");
        expect(bar).toMatch(/background:\s*var\(--cpd-color-bg-canvas-default\b/);
        expect(bar).toMatch(/border-bottom:\s*1px\s+solid\s+var\(--cpd-color-separator-primary\b/);
    });

    it("makes the title bar a drag handle", () => {
        expect(ruleBlock(css, "body::before")).toMatch(/-webkit-app-region:\s*drag/);
    });

    it("pushes the app content below the title bar band", () => {
        const body = ruleBlock(css, "body");
        expect(body).toMatch(new RegExp(`padding-top:\\s*${TITLE_BAR_HEIGHT_PX}px`));
        expect(body).toMatch(/box-sizing:\s*border-box/);
    });

    it("keeps the window draggable through an overlapping dialog panel", () => {
        // Regression guard: a blanket `.mx_Dialog`/`.mx_Dialog_border` no-drag carves the panel
        // (incl. the Glass border) out of the band, killing the drag where a centred dialog overlaps
        // it. The panel must stay transparent to the drag calc so body::before shows through.
        expect(css).not.toMatch(/(^|[^_-])\.mx_Dialog\s*\{[^}]*no-drag/);
        expect(css).not.toMatch(/\.mx_Dialog_border\b[^{]*\{[^}]*no-drag/);
    });

    it("does not gate the drag region on a modal being open", () => {
        // Regression guard: an earlier draft no-dragged the whole bar via the aria-hidden modal
        // signal, making the window undraggable with e.g. the settings dialog open.
        expect(css).not.toContain("aria-hidden");
    });

    it("keeps floating portal overlays clickable within the band", () => {
        // Compound menus/tooltips render in body-level portals and can open anywhere, incl. the band.
        expect(css).toMatch(/\[data-radix-popper-content-wrapper\][^{]*\{[^}]*-webkit-app-region:\s*no-drag/);
    });

    it("no longer carves per-surface drag strips into the app chrome", () => {
        // The dedicated bar replaces the old hacks; their reappearance would double up the offset.
        expect(css).not.toContain(".mx_LeftPanel::before");
        expect(css).not.toContain(".mx_RoomView::before");
        expect(css).not.toContain(".mx_SpaceRoomView::before");
        expect(css).not.toContain(".mx_UserMenu");
        expect(css).not.toContain(".mx_SpacePanel");
    });

    it("keeps the lightbox sender info clear of the traffic lights", () => {
        expect(ruleBlock(css, ".mx_ImageView_info_wrapper")).toMatch(
            new RegExp(`margin-top:\\s*${TITLE_BAR_HEIGHT_PX}px`),
        );
    });

    it("keeps the lightbox header a drag handle with interactive elements excluded", () => {
        expect(ruleBlock(css, ".mx_ImageView_panel")).toMatch(/-webkit-app-region:\s*drag/);
        expect(css).toMatch(/\.mx_ImageView_panel\s*>\s*\.mx_ImageView_toolbar\s*>\s*\*\s*\{[^}]*no-drag/);
    });

    it("keeps context menus excluded from the drag region (no-drag)", () => {
        expect(ruleBlock(css, ".mx_ContextualMenu")).toMatch(/-webkit-app-region:\s*no-drag/);
    });

    it("keeps iframes excluded from the drag region (no-drag)", () => {
        // iframes (e.g. recaptcha, widgets) must remain interactive.
        expect(css).toMatch(/iframe\s*\{[^}]*-webkit-app-region:\s*no-drag/);
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

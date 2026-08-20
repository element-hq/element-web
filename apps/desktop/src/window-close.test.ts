/*
Copyright 2026 hayaksi1

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { app } from "electron";
import type { BrowserWindow, Event } from "electron";

import { handleWindowClose, revealMainWindow } from "./window-close.js";

vi.mock("electron", () => ({
    app: {
        hide: vi.fn(),
        show: vi.fn(),
    },
}));

function mockWindow(overrides: Partial<Record<keyof BrowserWindow, unknown>> = {}): BrowserWindow {
    return {
        hide: vi.fn(),
        show: vi.fn(),
        focus: vi.fn(),
        restore: vi.fn(),
        once: vi.fn(),
        setFullScreen: vi.fn(),
        isFullScreen: vi.fn().mockReturnValue(false),
        isVisible: vi.fn().mockReturnValue(true),
        isMinimized: vi.fn().mockReturnValue(false),
        ...overrides,
    } as unknown as BrowserWindow;
}

function mockEvent(): Event {
    return { preventDefault: vi.fn() } as unknown as Event;
}

function usePlatform(platform: NodeJS.Platform): void {
    vi.spyOn(process, "platform", "get").mockReturnValue(platform);
}

describe("handleWindowClose", () => {
    beforeEach(() => {
        vi.mocked(app.hide).mockClear();
        vi.mocked(app.show).mockClear();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("hides the whole app on macOS without a tray (#32267)", () => {
        usePlatform("darwin");
        const window = mockWindow();
        const event = mockEvent();

        handleWindowClose(event, window, { appQuitting: false, hasTray: false });

        expect(event.preventDefault).toHaveBeenCalled();
        expect(app.hide).toHaveBeenCalled();
        expect(window.hide).not.toHaveBeenCalled();
    });

    it("hides the whole app on macOS even when a tray is present", () => {
        usePlatform("darwin");
        const window = mockWindow();

        handleWindowClose(mockEvent(), window, { appQuitting: false, hasTray: true });

        expect(app.hide).toHaveBeenCalled();
        expect(window.hide).not.toHaveBeenCalled();
    });

    it("hides only the window on Linux with a tray", () => {
        usePlatform("linux");
        const window = mockWindow();
        const event = mockEvent();

        handleWindowClose(event, window, { appQuitting: false, hasTray: true });

        expect(event.preventDefault).toHaveBeenCalled();
        expect(window.hide).toHaveBeenCalled();
        expect(app.hide).not.toHaveBeenCalled();
    });

    it("hides only the window on Windows with a tray", () => {
        usePlatform("win32");
        const window = mockWindow();

        handleWindowClose(mockEvent(), window, { appQuitting: false, hasTray: true });

        expect(window.hide).toHaveBeenCalled();
        expect(app.hide).not.toHaveBeenCalled();
    });

    it("lets the window close on Linux without a tray", () => {
        usePlatform("linux");
        const window = mockWindow();
        const event = mockEvent();

        handleWindowClose(event, window, { appQuitting: false, hasTray: false });

        expect(event.preventDefault).not.toHaveBeenCalled();
        expect(window.hide).not.toHaveBeenCalled();
        expect(app.hide).not.toHaveBeenCalled();
    });

    it("lets the window close on Windows without a tray", () => {
        usePlatform("win32");
        const window = mockWindow();
        const event = mockEvent();

        handleWindowClose(event, window, { appQuitting: false, hasTray: false });

        expect(event.preventDefault).not.toHaveBeenCalled();
        expect(window.hide).not.toHaveBeenCalled();
    });

    it("lets the window close on macOS once a real quit is under way", () => {
        usePlatform("darwin");
        const window = mockWindow();
        const event = mockEvent();

        handleWindowClose(event, window, { appQuitting: true, hasTray: false });

        expect(event.preventDefault).not.toHaveBeenCalled();
        expect(app.hide).not.toHaveBeenCalled();
    });

    it("lets the window close on a quit that beats a tray", () => {
        usePlatform("linux");
        const window = mockWindow();
        const event = mockEvent();

        handleWindowClose(event, window, { appQuitting: true, hasTray: true });

        expect(event.preventDefault).not.toHaveBeenCalled();
        expect(window.hide).not.toHaveBeenCalled();
    });

    it("leaves fullscreen before hiding the app on macOS", () => {
        usePlatform("darwin");
        const window = mockWindow({ isFullScreen: vi.fn().mockReturnValue(true) });

        handleWindowClose(mockEvent(), window, { appQuitting: false, hasTray: false });

        expect(app.hide).not.toHaveBeenCalled();
        expect(window.setFullScreen).toHaveBeenCalledWith(false);
        expect(window.once).toHaveBeenCalledWith("leave-full-screen", expect.any(Function));

        vi.mocked(window.once).mock.calls[0][1]();
        expect(app.hide).toHaveBeenCalled();
    });

    it("leaves fullscreen before hiding the window on a tray platform", () => {
        usePlatform("linux");
        const window = mockWindow({ isFullScreen: vi.fn().mockReturnValue(true) });

        handleWindowClose(mockEvent(), window, { appQuitting: false, hasTray: true });

        expect(window.hide).not.toHaveBeenCalled();
        expect(window.setFullScreen).toHaveBeenCalledWith(false);

        vi.mocked(window.once).mock.calls[0][1]();
        expect(window.hide).toHaveBeenCalled();
    });

    it("still hides the app on macOS when the window has already gone away", () => {
        usePlatform("darwin");

        expect(() => handleWindowClose(mockEvent(), null, { appQuitting: false, hasTray: false })).not.toThrow();
        expect(app.hide).toHaveBeenCalled();
    });
});

describe("revealMainWindow", () => {
    beforeEach(() => {
        vi.mocked(app.show).mockClear();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("un-hides the app on macOS, which app.hide() left invisible to isVisible()", () => {
        usePlatform("darwin");
        const window = mockWindow();

        revealMainWindow(window);

        expect(app.show).toHaveBeenCalled();
        expect(window.focus).toHaveBeenCalled();
    });

    it("does not touch the application elsewhere", () => {
        usePlatform("linux");
        const window = mockWindow();

        revealMainWindow(window);

        expect(app.show).not.toHaveBeenCalled();
        expect(window.focus).toHaveBeenCalled();
    });

    it("shows a hidden window", () => {
        usePlatform("linux");
        const window = mockWindow({ isVisible: vi.fn().mockReturnValue(false) });

        revealMainWindow(window);

        expect(window.show).toHaveBeenCalled();
    });

    it("leaves an already visible window alone", () => {
        usePlatform("linux");
        const window = mockWindow();

        revealMainWindow(window);

        expect(window.show).not.toHaveBeenCalled();
        expect(window.restore).not.toHaveBeenCalled();
    });

    it("restores a minimised window", () => {
        usePlatform("linux");
        const window = mockWindow({ isMinimized: vi.fn().mockReturnValue(true) });

        revealMainWindow(window);

        expect(window.restore).toHaveBeenCalled();
        expect(window.focus).toHaveBeenCalled();
    });
});

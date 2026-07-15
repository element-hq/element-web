/*
Copyright 2026 Spencer Poisseroux

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { expect, describe, it, beforeEach, afterEach, vi } from "vitest";
import type { BrowserWindow } from "electron";

import { setupMacosTitleBar } from "./macos-titlebar.js";

function createFakeWindow(): {
    window: BrowserWindow;
    emitDidFinishLoad: () => void;
    insertCSS: ReturnType<typeof vi.fn>;
} {
    const listeners: Record<string, () => void> = {};
    const insertCSS = vi.fn().mockResolvedValue("css-key");
    const window = {
        isFullScreen: vi.fn().mockReturnValue(false),
        on: vi.fn(),
        webContents: {
            insertCSS,
            removeInsertedCSS: vi.fn(),
            on: vi.fn((event: string, listener: () => void) => {
                listeners[event] = listener;
            }),
        },
    } as unknown as BrowserWindow;

    return {
        window,
        insertCSS,
        emitDidFinishLoad: () => listeners["did-finish-load"]?.(),
    };
}

describe("setupMacosTitleBar", () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe("on macOS", () => {
        beforeEach(() => {
            vi.spyOn(process, "platform", "get").mockReturnValue("darwin");
        });

        it("widens the collapsed space panel so the separator clears the traffic lights", async () => {
            const { window, insertCSS, emitDidFinishLoad } = createFakeWindow();
            setupMacosTitleBar(window);
            emitDidFinishLoad();
            // insertCSS is async; wait for the microtask queue to flush
            await Promise.resolve();

            expect(insertCSS).toHaveBeenCalledTimes(1);
            const css = insertCSS.mock.calls[0][0] as string;
            expect(css).toContain(".mx_SpacePanel.collapsed");
            expect(css).toContain("width: 76px !important;");
        });
    });

    it("does nothing on non-macOS platforms", () => {
        vi.spyOn(process, "platform", "get").mockReturnValue("win32");
        const { window, insertCSS, emitDidFinishLoad } = createFakeWindow();
        setupMacosTitleBar(window);
        emitDidFinishLoad();
        expect(insertCSS).not.toHaveBeenCalled();
    });
});

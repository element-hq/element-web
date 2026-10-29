/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { expect, describe, it, beforeEach, afterEach, type Mock, vi } from "vitest";
import { Tray } from "electron";
import type { BrowserWindow } from "electron";

import { getConfig } from "./config.js";

vi.mock("electron", () => ({
    Tray: vi.fn(
        class {
            public setToolTip = vi.fn();
            public setContextMenu = vi.fn();
            public on = vi.fn<(event: string, listener: () => void) => void>();
        },
    ),
    Menu: {
        buildFromTemplate: vi.fn(),
    },
    nativeImage: {
        createFromPath: vi.fn(),
    },
    app: {
        isPackaged: true,
    },
}));

vi.mock("./icon.js");
vi.mock("./config.js");

describe("create", () => {
    let create: () => Promise<void>;

    beforeEach(async () => {
        vi.resetModules();
        vi.clearAllMocks();
        // The tray is disabled on macOS so test under win32
        vi.spyOn(process, "platform", "get").mockReturnValue("win32");
        ({ create } = await import("./tray.js"));
    });

    afterEach(() => {
        (global as unknown as { mainWindow: BrowserWindow | null }).mainWindow = null;
        vi.restoreAllMocks();
    });

    it("should use config.brand", async () => {
        vi.mocked(getConfig).mockReturnValue({ brand: "ChatApp", help_url: "HELP_URL", web_base_url: "WEB_BASE_URL" });
        await create();
        const tray = vi.mocked(Tray).mock.instances[0];
        expect(tray.setToolTip).toHaveBeenCalledWith("ChatApp");
    });

    it("should use the pre-click focus state to toggle the window", async () => {
        const window = {
            isVisible: vi.fn().mockReturnValue(true),
            isMinimized: vi.fn().mockReturnValue(false),
            isFocused: vi.fn().mockReturnValue(true),
            hide: vi.fn(),
            show: vi.fn(),
            focus: vi.fn(),
            restore: vi.fn(),
            webContents: { on: vi.fn() },
        } as unknown as BrowserWindow;
        (global as unknown as { mainWindow: BrowserWindow | null }).mainWindow = window;

        await create();

        const tray = vi.mocked(Tray).mock.instances[0];
        const on = tray.on as unknown as Mock<(event: string, listener: () => void) => void>;
        const mouseEnterHandler = on.mock.calls.find(([event]) => event === "mouse-enter")?.[1];
        const clickHandler = on.mock.calls.find(([event]) => event === "click")?.[1];
        expect(mouseEnterHandler).toBeDefined();
        expect(clickHandler).toBeDefined();

        mouseEnterHandler?.();
        vi.mocked(window.isFocused).mockReturnValue(false);
        clickHandler?.();
        expect(window.hide).toHaveBeenCalledOnce();

        vi.mocked(window.isVisible).mockReturnValue(true);
        mouseEnterHandler?.();
        clickHandler?.();
        expect(window.hide).toHaveBeenCalledOnce();
        expect(window.focus).toHaveBeenCalledOnce();

        vi.mocked(window.isVisible).mockReturnValue(false);
        mouseEnterHandler?.();
        clickHandler?.();
        expect(window.show).toHaveBeenCalledOnce();
        expect(window.focus).toHaveBeenCalledTimes(2);
    });
});

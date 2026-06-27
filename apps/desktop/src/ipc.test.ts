/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { expect, describe, it, vi, beforeAll, beforeEach, afterEach } from "vitest";
import { ipcMain, type IpcMainInvokeEvent } from "electron";

import { getConfig } from "./config.js";
import Store from "./store.js";

vi.mock("electron", () => ({
    ipcMain: {
        on: vi.fn(),
        once: vi.fn(),
        handle: vi.fn(),
    },
}));

vi.mock("./config.js");

describe("getConfig", () => {
    it("should call config.getConfig and return the value", async () => {
        const config = { brand: "BRAND", help_url: "HELP_URL", web_base_url: "WEB_BASE_URL" };
        vi.mocked(getConfig).mockReturnValue(config);

        await import("./ipc.js");

        const handler = vi.mocked(ipcMain.handle).mock.calls.find(([channel]) => channel === "getConfig")?.[1];
        expect(handler).toBeDefined();

        expect(handler!(new Event("test") as unknown as IpcMainInvokeEvent)).toStrictEqual(config);
        expect(getConfig).toHaveBeenCalled();
    });
});

describe("setThemeColor", () => {
    let handler: (ev: unknown, color: unknown) => void;
    let set: ReturnType<typeof vi.fn>;
    let get: ReturnType<typeof vi.fn>;
    let setBackgroundColor: ReturnType<typeof vi.fn>;
    let instanceSpy: ReturnType<typeof vi.spyOn>;

    beforeAll(async () => {
        await import("./ipc.js");
        handler = vi.mocked(ipcMain.on).mock.calls.find(([channel]) => channel === "setThemeColor")![1] as never;
        expect(handler).toBeDefined();
    });

    beforeEach(() => {
        set = vi.fn();
        get = vi.fn();
        setBackgroundColor = vi.fn();
        instanceSpy = vi.spyOn(Store, "instance", "get").mockReturnValue({ get, set } as unknown as Store);
        (global as unknown as { mainWindow: unknown }).mainWindow = { setBackgroundColor };
    });

    afterEach(() => {
        instanceSpy.mockRestore();
        (global as unknown as { mainWindow: unknown }).mainWindow = null;
    });

    it("persists a valid colour and repaints the live window", () => {
        handler({}, "rgb(16, 19, 23)");

        expect(set).toHaveBeenCalledWith("backgroundColor", "rgb(16, 19, 23)");
        expect(setBackgroundColor).toHaveBeenCalledWith("rgb(16, 19, 23)");
    });

    it("ignores an invalid colour", () => {
        handler({}, "javascript:alert(1)");

        expect(set).not.toHaveBeenCalled();
        expect(setBackgroundColor).not.toHaveBeenCalled();
    });

    it("ignores a non-string payload", () => {
        handler({}, { malicious: true });

        expect(set).not.toHaveBeenCalled();
        expect(setBackgroundColor).not.toHaveBeenCalled();
    });

    it("does not throw when there is no window", () => {
        (global as unknown as { mainWindow: unknown }).mainWindow = null;

        expect(() => handler({}, "#101317")).not.toThrow();
        expect(set).toHaveBeenCalledWith("backgroundColor", "#101317");
    });

    it("does not re-persist or repaint when the colour is unchanged", () => {
        get.mockReturnValue("#101317");

        handler({}, "#101317");

        expect(set).not.toHaveBeenCalled();
        expect(setBackgroundColor).not.toHaveBeenCalled();
    });
});

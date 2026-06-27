/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { expect, describe, it, vi, beforeAll, beforeEach, afterEach } from "vitest";
import { ipcMain, desktopCapturer, type IpcMainInvokeEvent } from "electron";

import { getConfig } from "./config.js";
import Store from "./store.js";
import { consumeDisplayMediaCallback } from "./displayMediaCallback.js";

vi.mock("electron", () => ({
    ipcMain: {
        on: vi.fn(),
        once: vi.fn(),
        handle: vi.fn(),
    },
    desktopCapturer: {
        getSources: vi.fn(),
    },
}));

vi.mock("./config.js");
vi.mock("./displayMediaCallback.js", () => ({
    consumeDisplayMediaCallback: vi.fn(),
}));

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

type IpcCallHandler = (ev: unknown, payload: unknown) => Promise<void>;

// The screen-share handlers are routed through the single `ipcCall` channel (switch on payload.name),
// so we grab that handler and drive it directly with a payload, asserting on the `ipcReply` it sends.
async function getIpcCallHandler(): Promise<IpcCallHandler> {
    await import("./ipc.js");
    const handler = vi.mocked(ipcMain.on).mock.calls.find(([channel]) => channel === "ipcCall")?.[1];
    expect(handler).toBeDefined();
    return handler as unknown as IpcCallHandler;
}

describe("ipcCall: getDesktopCapturerSources", () => {
    let handler: IpcCallHandler;
    let send: ReturnType<typeof vi.fn>;
    let instanceSpy: ReturnType<typeof vi.spyOn>;

    beforeAll(async () => {
        handler = await getIpcCallHandler();
    });

    beforeEach(() => {
        send = vi.fn();
        instanceSpy = vi.spyOn(Store, "instance", "get").mockReturnValue({} as unknown as Store);
        (global as unknown as { mainWindow: unknown }).mainWindow = { webContents: { send } };
        vi.mocked(desktopCapturer.getSources).mockReset();
        vi.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
        instanceSpy.mockRestore();
        vi.mocked(console.error).mockRestore();
        (global as unknown as { mainWindow: unknown }).mainWindow = null;
    });

    it("maps the native sources to id/name/thumbnailURL", async () => {
        vi.mocked(desktopCapturer.getSources).mockResolvedValue([
            { id: "screen:1", name: "Screen 1", thumbnail: { toDataURL: (): string => "data:thumb" } },
        ] as never);

        await handler({}, { name: "getDesktopCapturerSources", args: [{ types: ["screen"] }], id: 1 });

        expect(send).toHaveBeenCalledWith("ipcReply", {
            id: 1,
            reply: [{ id: "screen:1", name: "Screen 1", thumbnailURL: "data:thumb" }],
        });
    });

    it("replies with an empty list (so the renderer's picker never dangles) when getSources rejects", async () => {
        vi.mocked(desktopCapturer.getSources).mockRejectedValue(new Error("native failure"));

        await handler({}, { name: "getDesktopCapturerSources", args: [{}], id: 2 });

        expect(send).toHaveBeenCalledWith("ipcReply", { id: 2, reply: [] });
    });
});

describe("ipcCall: callDisplayMediaCallback", () => {
    let handler: IpcCallHandler;
    let send: ReturnType<typeof vi.fn>;
    let instanceSpy: ReturnType<typeof vi.spyOn>;

    beforeAll(async () => {
        handler = await getIpcCallHandler();
    });

    beforeEach(() => {
        send = vi.fn();
        instanceSpy = vi.spyOn(Store, "instance", "get").mockReturnValue({} as unknown as Store);
        (global as unknown as { mainWindow: unknown }).mainWindow = { webContents: { send } };
        vi.mocked(consumeDisplayMediaCallback).mockReset();
    });

    afterEach(() => {
        instanceSpy.mockRestore();
        (global as unknown as { mainWindow: unknown }).mainWindow = null;
    });

    it("invokes the consumed callback once with the chosen video source", async () => {
        const callback = vi.fn();
        vi.mocked(consumeDisplayMediaCallback).mockReturnValue(callback);

        await handler({}, { name: "callDisplayMediaCallback", args: [{ id: "screen:1" }], id: 3 });

        expect(consumeDisplayMediaCallback).toHaveBeenCalledTimes(1);
        expect(callback).toHaveBeenCalledWith({ video: { id: "screen:1" } });
        expect(send).toHaveBeenCalledWith("ipcReply", { id: 3, reply: null });
    });

    it("is a safe no-op for a stale/duplicate IPC with no pending callback", async () => {
        vi.mocked(consumeDisplayMediaCallback).mockReturnValue(null);

        await expect(handler({}, { name: "callDisplayMediaCallback", args: [{}], id: 4 })).resolves.toBeUndefined();

        expect(send).toHaveBeenCalledWith("ipcReply", { id: 4, reply: null });
    });
});

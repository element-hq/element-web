/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { expect, describe, it, beforeEach, afterEach, vi } from "vitest";
import { desktopCapturer } from "electron";

import { getConfig } from "./config.js";
import { consumeDisplayMediaCallback } from "./displayMediaCallback.js";

const { ipcHandlers, mockStore, send, randomArray } = vi.hoisted(() => ({
    ipcHandlers: {} as Record<string, (...args: unknown[]) => unknown>,
    mockStore: {
        isSecretUndecryptable: vi.fn<(key: string) => Promise<boolean>>(),
        setSecret: vi.fn<(key: string, secret: string) => Promise<void>>(),
        getSecret: vi.fn<(key: string) => Promise<string | undefined>>(),
        deleteSecret: vi.fn<(key: string) => Promise<void>>(),
        set: vi.fn<(key: string, value: unknown) => void>(),
        get: vi.fn<(key: string) => unknown>(),
    },
    send: vi.fn(),
    randomArray: vi.fn<(len: number) => Promise<string>>(),
}));

vi.mock("electron", () => ({
    app: { getVersion: vi.fn(() => "1.0.0") },
    autoUpdater: { getFeedURL: vi.fn() },
    desktopCapturer: { getSources: vi.fn() },
    ipcMain: {
        on: vi.fn((channel: string, cb: (...a: unknown[]) => unknown) => {
            ipcHandlers[channel] = cb;
        }),
        once: vi.fn((channel: string, cb: (...a: unknown[]) => unknown) => {
            ipcHandlers[channel] = cb;
        }),
        handle: vi.fn((channel: string, cb: (...a: unknown[]) => unknown) => {
            ipcHandlers[channel] = cb;
        }),
    },
    powerSaveBlocker: { isStarted: vi.fn(), start: vi.fn(), stop: vi.fn() },
    TouchBar: class {},
    nativeImage: { createFromBuffer: vi.fn() },
}));

vi.mock("./store.js", () => ({
    default: { instance: mockStore },
    clearDataAndRelaunch: vi.fn(),
    SafeStorageDecryptionError: class SafeStorageDecryptionError extends Error {},
}));
vi.mock("./utils.js", () => ({ randomArray }));
vi.mock("./displayMediaCallback.js", () => ({
    consumeDisplayMediaCallback: vi.fn(),
}));
vi.mock("./config.js");

await import("./ipc.js");

const ARGS = ["@alice:example.org", "DEVICEID"];

async function callIpc(name: string, id = 1, args: unknown[] = ARGS): Promise<void> {
    await ipcHandlers["ipcCall"]({}, { id, name, args });
}

describe("ipc pickle key handling", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        randomArray.mockResolvedValue("GENERATEDKEY");
        (global as unknown as { mainWindow: unknown }).mainWindow = { webContents: { send } };
    });

    describe("createPickleKey", () => {
        it("refuses to overwrite an existing but undecryptable pickle key", async () => {
            mockStore.isSecretUndecryptable.mockResolvedValue(true);

            await callIpc("createPickleKey", 7);

            expect(mockStore.setSecret).not.toHaveBeenCalled();
            expect(send).toHaveBeenCalledWith("ipcReply", { id: 7, reply: null });
        });

        it("creates and stores a new pickle key when none is present", async () => {
            mockStore.isSecretUndecryptable.mockResolvedValue(false);

            await callIpc("createPickleKey", 8);

            expect(mockStore.setSecret).toHaveBeenCalledWith("@alice:example.org|DEVICEID", "GENERATEDKEY");
            expect(send).toHaveBeenCalledWith("ipcReply", { id: 8, reply: "GENERATEDKEY" });
        });
    });

    describe("getPickleKey", () => {
        it("returns null when getSecret throws", async () => {
            mockStore.getSecret.mockRejectedValue(new Error("safeStorage unavailable"));

            await callIpc("getPickleKey", 9);

            expect(send).toHaveBeenCalledWith("ipcReply", { id: 9, reply: null });
        });

        it("returns null when the secret is present but cannot be decrypted", async () => {
            const { SafeStorageDecryptionError } = await import("./store.js");
            mockStore.getSecret.mockRejectedValue(
                new SafeStorageDecryptionError("Failed to decrypt safeStorage secret"),
            );

            await callIpc("getPickleKey", 10);

            expect(send).toHaveBeenCalledWith("ipcReply", { id: 10, reply: null });
        });
    });
});

describe("getConfig", () => {
    it("should call config.getConfig and return the value", async () => {
        const config = { brand: "BRAND", help_url: "HELP_URL", web_base_url: "WEB_BASE_URL" };
        vi.mocked(getConfig).mockReturnValue(config);

        const handler = ipcHandlers["getConfig"];
        expect(handler).toBeDefined();

        expect(handler({})).toStrictEqual(config);
        expect(getConfig).toHaveBeenCalled();
    });
});

describe("ipcCall: getDesktopCapturerSources", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(desktopCapturer.getSources).mockReset();
        vi.spyOn(console, "error").mockImplementation(() => {});
        (global as unknown as { mainWindow: unknown }).mainWindow = { webContents: { send } };
    });

    afterEach(() => {
        vi.mocked(console.error).mockRestore();
    });

    it("maps the native sources to id/name/thumbnailURL", async () => {
        vi.mocked(desktopCapturer.getSources).mockResolvedValue([
            { id: "screen:1", name: "Screen 1", thumbnail: { toDataURL: (): string => "data:thumb" } },
        ] as never);

        await callIpc("getDesktopCapturerSources", 11, [{ types: ["screen"] }]);

        expect(send).toHaveBeenCalledWith("ipcReply", {
            id: 11,
            reply: [{ id: "screen:1", name: "Screen 1", thumbnailURL: "data:thumb" }],
        });
    });

    it("replies with an empty list rather than leaving the picker awaiting when getSources rejects", async () => {
        vi.mocked(desktopCapturer.getSources).mockRejectedValue(new Error("native failure"));

        await callIpc("getDesktopCapturerSources", 12, [{}]);

        expect(send).toHaveBeenCalledWith("ipcReply", { id: 12, reply: [] });
    });
});

describe("ipcCall: callDisplayMediaCallback", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(consumeDisplayMediaCallback).mockReset();
        (global as unknown as { mainWindow: unknown }).mainWindow = { webContents: { send } };
    });

    it("invokes the consumed callback once with the chosen video source", async () => {
        const callback = vi.fn();
        vi.mocked(consumeDisplayMediaCallback).mockReturnValue(callback);

        await callIpc("callDisplayMediaCallback", 13, [{ id: "screen:1" }]);

        expect(consumeDisplayMediaCallback).toHaveBeenCalledTimes(1);
        expect(callback).toHaveBeenCalledWith({ video: { id: "screen:1" } });
        expect(send).toHaveBeenCalledWith("ipcReply", { id: 13, reply: null });
    });

    it("is a safe no-op when a stale or duplicate IPC finds no pending callback", async () => {
        vi.mocked(consumeDisplayMediaCallback).mockReturnValue(null);

        await callIpc("callDisplayMediaCallback", 14, [{}]);

        expect(send).toHaveBeenCalledWith("ipcReply", { id: 14, reply: null });
    });
});

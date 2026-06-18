/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { expect, describe, it, vi } from "vitest";
import { ipcMain, type IpcMainInvokeEvent } from "electron";

import { getConfig } from "./config.js";

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

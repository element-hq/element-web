/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { expect, describe, it, beforeEach, vi } from "vitest";
import { Tray } from "electron";

import { getConfig } from "./config.js";

vi.mock("electron", () => ({
    Tray: vi.fn(
        class {
            public setToolTip = vi.fn();
            public setContextMenu = vi.fn();
            public on = vi.fn();
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
        // The tray is disabled on macOS so test under win32
        vi.spyOn(process, "platform", "get").mockReturnValue("win32");
        ({ create } = await import("./tray.js"));
    });

    it("should use config.brand", async () => {
        vi.mocked(getConfig).mockReturnValue({ brand: "ChatApp", help_url: "HELP_URL", web_base_url: "WEB_BASE_URL" });
        await create();
        const tray = vi.mocked(Tray).mock.instances[0];
        expect(tray.setToolTip).toHaveBeenCalledWith("ChatApp");
    });
});

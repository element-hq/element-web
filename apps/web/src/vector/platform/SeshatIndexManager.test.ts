/*
Copyright 2025 New Vector Ltd.
Copyright 2020, 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { vi, describe, it, expect, afterEach } from "vitest";

import { IPCManager } from "./IPCManager.ts";
import { SeshatIndexManager } from "./SeshatIndexManager.ts";
import { TokenizerMode } from "../../settings/enums/TokenizerMode.ts";

describe("SeshatIndexManager", () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("passes tokenizerMode to initEventIndex IPC call", async () => {
        // IPCManager requires window.electron to exist.
        window.electron = {
            on: vi.fn(),
            send: vi.fn(),
        } as unknown as Electron;

        const ipcCallSpy = vi.spyOn(IPCManager.prototype, "call").mockResolvedValue(undefined);
        const mgr = new SeshatIndexManager();

        await mgr.initEventIndex("@user:example.org", "DEVICE123", TokenizerMode.Ngram);

        expect(ipcCallSpy).toHaveBeenCalledWith("initEventIndex", "@user:example.org", "DEVICE123", "ngram");
    });
});

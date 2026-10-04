/*
Copyright 2026 Hiroshi Shinaoka
Copyright 2020, 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { vi, describe, it, expect, afterEach } from "vitest";

import { IPCManager } from "./IPCManager.ts";
import { SeshatIndexManager } from "./SeshatIndexManager.ts";
import { type IIndexedEvent, type ILoadArgs } from "../../indexing/BaseEventIndexManager.ts";
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

    it("should forward loadEventIds arguments to IPC and return the result", async () => {
        window.electron = {
            on: vi.fn(),
            send: vi.fn(),
        } as unknown as Electron;

        const events: IIndexedEvent[] = [{ eventId: "$message", type: "m.room.message", serverTs: 1000 }];
        const ipcCallSpy = vi.spyOn(IPCManager.prototype, "call").mockResolvedValue(events);
        const mgr = new SeshatIndexManager();
        const args: ILoadArgs = {
            roomId: "!room:example.org",
            limit: 3,
            fromEvent: "$cursor",
            direction: "f",
        };

        expect(await mgr.loadEventIds(args)).toEqual(events);
        expect(ipcCallSpy).toHaveBeenCalledWith("loadEventIds", args);
    });
});

/*
Copyright 2025 New Vector Ltd.
Copyright 2020, 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { IPCManager } from "../../../../src/vector/platform/IPCManager";
import { SeshatIndexManager } from "../../../../src/vector/platform/SeshatIndexManager";

describe("SeshatIndexManager", () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    it("passes tokenizerMode to initEventIndex IPC call", async () => {
        // IPCManager requires window.electron to exist.
        window.electron = {
            on: jest.fn(),
            send: jest.fn(),
        } as unknown as Electron;

        const ipcCallSpy = jest.spyOn(IPCManager.prototype, "call").mockResolvedValue(undefined);
        const mgr = new SeshatIndexManager();

        await mgr.initEventIndex("@user:example.org", "DEVICE123", "ngram");

        expect(ipcCallSpy).toHaveBeenCalledWith("initEventIndex", "@user:example.org", "DEVICE123", "ngram");
    });
});

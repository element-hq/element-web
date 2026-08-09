/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { EventEmitter } from "node:events";
import { beforeEach, describe, expect, it, vi } from "vitest";

const electronApp = vi.hoisted(() => ({ isPackaged: true }));

vi.mock("electron", () => ({
    app: electronApp,
    BrowserWindow: { getAllWindows: vi.fn(() => []) },
    desktopCapturer: { getSources: vi.fn() },
    webContents: { fromFrame: vi.fn() },
    MessageChannelMain: class {},
}));

describe("display-media requester ownership", () => {
    beforeEach(() => {
        electronApp.isPackaged = true;
        delete process.env.ELEMENT_SCREEN_SHARE_AUDIO_FAKE_PROVIDER;
        vi.resetModules();
    });

    it("does not install the audit seam when packaged or not explicitly enabled", async () => {
        const packaged = await import("./display-media.js");
        expect(Object.hasOwn(electronApp, packaged.developmentFakeAuditProperty)).toBe(false);

        electronApp.isPackaged = false;
        vi.resetModules();
        const unpackaged = await import("./display-media.js");
        expect(Object.hasOwn(electronApp, unpackaged.developmentFakeAuditProperty)).toBe(false);
    });

    it("observes only cross-document navigation of the exact frame and detached frames", async () => {
        const { observeRequester } = await import("./display-media.js");
        const contents = new EventEmitter();
        const frame = { frameTreeNodeId: 17, detached: false };
        const listener = vi.fn();
        const dispose = observeRequester(
            frame as unknown as Electron.WebFrameMain,
            contents as unknown as Electron.WebContents,
        )(listener);

        contents.emit("did-start-navigation", { isSameDocument: true, frame });
        contents.emit("did-start-navigation", { isSameDocument: false, frame: { frameTreeNodeId: 18 } });
        expect(listener).not.toHaveBeenCalled();
        contents.emit("did-start-navigation", { isSameDocument: false, frame });
        expect(listener).toHaveBeenCalledOnce();

        dispose();
        contents.emit("did-start-navigation", { isSameDocument: false, frame });
        expect(listener).toHaveBeenCalledOnce();
    });

    it("rejects a requester observed detached during navigation", async () => {
        const { observeRequester } = await import("./display-media.js");
        const contents = new EventEmitter();
        const frame = { frameTreeNodeId: 17, detached: true };
        const listener = vi.fn();
        observeRequester(
            frame as unknown as Electron.WebFrameMain,
            contents as unknown as Electron.WebContents,
        )(listener);
        contents.emit("did-start-navigation", { isSameDocument: false, frame: { frameTreeNodeId: 18 } });
        expect(listener).toHaveBeenCalledOnce();
    });

    it("installs a frozen sanitized audit only for the explicitly enabled unpackaged fake", async () => {
        electronApp.isPackaged = false;
        process.env.ELEMENT_SCREEN_SHARE_AUDIO_FAKE_PROVIDER = "1";
        const { developmentFakeAuditProperty } = await import("./display-media.js");
        const descriptor = Object.getOwnPropertyDescriptor(electronApp, developmentFakeAuditProperty);
        expect(descriptor).toMatchObject({ enumerable: false, configurable: false, writable: false });
        expect(descriptor?.value()).toEqual({
            controller: {
                state: "Idle",
                activeRequests: 0,
                activeCaptures: 0,
                activeBridges: 0,
                completedCallbacks: 0,
                lastRequestId: 0,
            },
            bridge: {
                bridgeWindows: 0,
                messagePorts: 0,
                timers: 0,
                lastStage: null,
                lastFailure: null,
                captureObserved: false,
                lastCaptured: null,
                captureSamples: 0,
                falseSamplesAfterObserved: 0,
            },
            fake: { captures: 0, timers: 0 },
        });
    });
});

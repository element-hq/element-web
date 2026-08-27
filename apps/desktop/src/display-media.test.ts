/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { EventEmitter } from "node:events";
import { beforeEach, describe, expect, it, vi } from "vitest";

const electronApp = vi.hoisted(() => ({ isPackaged: true, getAppPath: vi.fn(() => "C:\\app") }));

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
        vi.resetModules();
    });

    it("extracts only bounded widget identities from the requesting frame URL", async () => {
        const { getRequesterWidgetId } = await import("./display-media.js");
        expect(getRequesterWidgetId("https://call.example/#?widgetId=fragment-only")).toBeNull();
        expect(getRequesterWidgetId("https://call.example/?widgetId=widget-1#/?room=x")).toBe("widget-1");
        expect(getRequesterWidgetId(`https://call.example/?widgetId=${"x".repeat(256)}`)).toBeNull();
        expect(getRequesterWidgetId("not a url")).toBeNull();
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
});

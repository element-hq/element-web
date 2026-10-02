/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { EventEmitter } from "node:events";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
    cancelDisplayMediaRequest,
    handleDisplayMediaPickerReply,
    handleDisplayMediaRequest,
} from "./display-media.js";

const electron = vi.hoisted(() => ({
    getSources: vi.fn(),
    fromFrame: vi.fn(),
}));

vi.mock("electron", () => ({
    desktopCapturer: { getSources: electron.getSources },
    webContents: { fromFrame: electron.fromFrame },
}));

const screenSource = { id: "screen:1:0", name: "Screen 1" };
const windowSource = { id: "window:2:0", name: "Window 1" };

describe("display media", () => {
    const send = vi.fn();
    const contents = Object.assign(new EventEmitter(), { id: 7 });
    const frame = { detached: false };

    beforeEach(() => {
        cancelDisplayMediaRequest();
        vi.clearAllMocks();
        electron.fromFrame.mockReturnValue(contents);
        electron.getSources.mockResolvedValue([screenSource, windowSource]);
        global.mainWindow = { webContents: { id: contents.id, send } } as unknown as Electron.BrowserWindow;
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    function request(audioRequested: boolean, callback = vi.fn()): ReturnType<typeof vi.fn> {
        handleDisplayMediaRequest({ frame, audioRequested } as never, callback);
        return callback;
    }

    function pickerRequestId(): number {
        return send.mock.lastCall?.[1].requestId;
    }

    it.each([screenSource, windowSource])("returns native loopback audio for $id on Windows", async (source) => {
        vi.spyOn(process, "platform", "get").mockReturnValue("win32");
        const callback = request(true);

        await handleDisplayMediaPickerReply(contents.id, {
            requestId: pickerRequestId(),
            sourceId: source.id,
            shareSystemAudio: true,
        });

        expect(callback).toHaveBeenCalledWith({ video: source, audio: "loopback" });
    });

    it("keeps unsupported platforms video-only", async () => {
        vi.spyOn(process, "platform", "get").mockReturnValue("linux");
        const callback = request(true);

        await handleDisplayMediaPickerReply(contents.id, {
            requestId: pickerRequestId(),
            sourceId: screenSource.id,
            shareSystemAudio: true,
        });

        expect(callback).toHaveBeenCalledWith({ video: screenSource });
    });

    it.each([
        { audioRequested: false, shareSystemAudio: true },
        { audioRequested: true, shareSystemAudio: false },
    ])("keeps audio-disabled requests video-only", async ({ audioRequested, shareSystemAudio }) => {
        vi.spyOn(process, "platform", "get").mockReturnValue("win32");
        const callback = request(audioRequested);

        await handleDisplayMediaPickerReply(contents.id, {
            requestId: pickerRequestId(),
            sourceId: windowSource.id,
            shareSystemAudio,
        });

        expect(callback).toHaveBeenCalledWith({ video: windowSource });
    });

    it("clears a cancelled request and ignores its stale reply", async () => {
        const callback = request(true);
        const requestId = pickerRequestId();

        await handleDisplayMediaPickerReply(contents.id, {
            requestId,
            sourceId: null,
            shareSystemAudio: false,
        });
        await handleDisplayMediaPickerReply(contents.id, {
            requestId,
            sourceId: screenSource.id,
            shareSystemAudio: true,
        });

        expect(callback).toHaveBeenCalledOnce();
        expect(callback).toHaveBeenCalledWith({ video: { id: "", name: "" } });
        expect(electron.getSources).not.toHaveBeenCalled();
    });

    it("cancels an older pending request when a new request starts", async () => {
        const firstCallback = request(true);
        const firstRequestId = pickerRequestId();
        const secondCallback = request(true);
        const secondRequestId = pickerRequestId();

        expect(firstCallback).toHaveBeenCalledWith({ video: { id: "", name: "" } });
        await handleDisplayMediaPickerReply(contents.id, {
            requestId: firstRequestId,
            sourceId: screenSource.id,
            shareSystemAudio: true,
        });
        expect(electron.getSources).not.toHaveBeenCalled();

        await handleDisplayMediaPickerReply(contents.id, {
            requestId: secondRequestId,
            sourceId: null,
            shareSystemAudio: false,
        });
        expect(secondCallback).toHaveBeenCalledOnce();
    });
});

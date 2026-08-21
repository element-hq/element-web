/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {
    BrowserWindow,
    desktopCapturer,
    webContents,
    type DisplayMediaRequestHandlerHandlerRequest,
    type Streams,
} from "electron";

import { ElectronScreenShareAudioBridgeFactory } from "./screen-share-audio/bridge.js";
import { createProcessLoopbackProvider } from "./screen-share-audio/process-loopback-provider.js";
import {
    DisplayMediaSessionController,
    type DisplayMediaRequest,
    type PickerReply,
    type ScreenShareAudioSessionRelease,
    type ScreenShareAudioSessionBinding,
} from "./screen-share-audio/session-controller.js";

const sessionIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isValidWidgetId(value: unknown): value is string {
    return (
        typeof value === "string" &&
        value.length > 0 &&
        value.length <= 255 &&
        [...value].every((character) => character.codePointAt(0)! >= 32 && character.codePointAt(0) !== 127)
    );
}

export function getRequesterWidgetId(frameUrl: string): string | null {
    try {
        const value = new URL(frameUrl).searchParams.get("widgetId");
        return isValidWidgetId(value) ? value : null;
    } catch {
        return null;
    }
}

export function observeRequester(
    frame: Electron.WebFrameMain,
    contents: Electron.WebContents,
): DisplayMediaRequest["onRequesterDestroyed"] {
    return (listener): (() => void) => {
        const frameTreeNodeId = frame.frameTreeNodeId;
        const navigationListener = (
            details: Electron.Event<Electron.WebContentsDidStartNavigationEventParams>,
        ): void => {
            if (details.isSameDocument) return;
            if (frame.detached || details.frame?.frameTreeNodeId === frameTreeNodeId) listener();
        };
        const goneListener = (): void => listener();
        contents.once("destroyed", listener);
        contents.once("render-process-gone", goneListener);
        contents.on("did-start-navigation", navigationListener);
        return (): void => {
            contents.removeListener("destroyed", listener);
            contents.removeListener("render-process-gone", goneListener);
            contents.removeListener("did-start-navigation", navigationListener);
        };
    };
}

const processLoopbackProvider = createProcessLoopbackProvider();

export const displayMediaController = new DisplayMediaSessionController({
    enumerateSources: async () => desktopCapturer.getSources({ types: ["screen", "window"] }),
    openPicker: (senderId, requestId, requesterWidgetId) => {
        const mainWindow = global.mainWindow;
        if (mainWindow?.webContents.id === senderId) {
            mainWindow.webContents.send("openDesktopCapturerSourcePicker", { requestId, requesterWidgetId });
            return true;
        }
        return false;
    },
    isElementOwnedSource: (source) =>
        BrowserWindow.getAllWindows().some(
            (window) => !window.isDestroyed() && window.getMediaSourceId() === source.id,
        ),
    provider: processLoopbackProvider,
    bridgeFactory: new ElectronScreenShareAudioBridgeFactory(),
});

export function handleDisplayMediaRequest(
    request: DisplayMediaRequestHandlerHandlerRequest,
    callback: (streams: Streams) => void,
): void {
    const frame = request.frame;
    const contents = frame && webContents.fromFrame(frame);
    if (!frame || frame.detached || !contents) {
        callback({ video: { id: "", name: "" } });
        return;
    }
    displayMediaController.begin({
        senderId: contents.id,
        requesterWidgetId: getRequesterWidgetId(frame.url),
        audioRequested: request.audioRequested,
        callback,
        onRequesterDestroyed: observeRequester(frame, contents),
    });
}

export function handleDisplayMediaPickerReply(senderId: number, reply: PickerReply): void {
    if (
        typeof reply !== "object" ||
        reply === null ||
        !Number.isSafeInteger(reply.requestId) ||
        (typeof reply.sourceId !== "string" && reply.sourceId !== null) ||
        (reply.requesterWidgetId !== undefined &&
            typeof reply.requesterWidgetId !== "string" &&
            reply.requesterWidgetId !== null) ||
        (reply.sessionId !== undefined && typeof reply.sessionId !== "string" && reply.sessionId !== null) ||
        (reply.sessionId !== undefined && reply.sessionId !== null && !sessionIdPattern.test(reply.sessionId))
    ) {
        return;
    }
    displayMediaController.reply(senderId, {
        ...reply,
        requesterWidgetId: reply.requesterWidgetId ?? null,
        sessionId: reply.sessionId ?? null,
    });
}

export function handleScreenShareAudioSessionRelease(senderId: number, release: ScreenShareAudioSessionRelease): void {
    if (
        typeof release !== "object" ||
        release === null ||
        !Number.isSafeInteger(release.requestId) ||
        !isValidWidgetId(release.requesterWidgetId) ||
        typeof release.sessionId !== "string" ||
        !sessionIdPattern.test(release.sessionId)
    ) {
        return;
    }
    void displayMediaController.release(senderId, release);
}

export function handleScreenShareAudioSessionBinding(
    senderId: number,
    binding: ScreenShareAudioSessionBinding,
): boolean {
    if (
        typeof binding !== "object" ||
        binding === null ||
        !Number.isSafeInteger(binding.requestId) ||
        !isValidWidgetId(binding.requesterWidgetId) ||
        typeof binding.sessionId !== "string" ||
        !sessionIdPattern.test(binding.sessionId)
    ) {
        return false;
    }
    return displayMediaController.bind(senderId, binding);
}

export async function supportsIsolatedScreenShareAudio(): Promise<boolean> {
    return (await processLoopbackProvider.getAvailability()) === "available";
}

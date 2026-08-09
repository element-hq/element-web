/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {
    app,
    BrowserWindow,
    desktopCapturer,
    webContents,
    type DisplayMediaRequestHandlerHandlerRequest,
    type Streams,
} from "electron";

import { ElectronScreenShareAudioBridgeFactory, getScreenShareAudioBridgeAudit } from "./screen-share-audio/bridge.js";
import { createDevelopmentFakeProvider, getFakeScreenShareAudioAudit } from "./screen-share-audio/fake-provider.js";
import {
    DisplayMediaSessionController,
    type DisplayMediaRequest,
    type PickerReply,
} from "./screen-share-audio/session-controller.js";

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

const developmentFakeProvider = createDevelopmentFakeProvider();

export const displayMediaController = new DisplayMediaSessionController({
    enumerateSources: async () => desktopCapturer.getSources({ types: ["screen", "window"] }),
    openPicker: (senderId, requestId) => {
        const mainWindow = global.mainWindow;
        if (mainWindow?.webContents.id === senderId) {
            mainWindow.webContents.send("openDesktopCapturerSourcePicker", { requestId });
            return true;
        }
        return false;
    },
    isElementOwnedSource: (source) =>
        BrowserWindow.getAllWindows().some(
            (window) => !window.isDestroyed() && window.getMediaSourceId() === source.id,
        ),
    provider: developmentFakeProvider,
    bridgeFactory: new ElectronScreenShareAudioBridgeFactory(),
});

export const developmentFakeAuditProperty = "__elementScreenShareAudioFakeAudit_9f8c24f1";
if (developmentFakeProvider && !app.isPackaged) {
    Object.defineProperty(app, developmentFakeAuditProperty, {
        enumerable: false,
        configurable: false,
        writable: false,
        value: () => {
            const controller = displayMediaController.getAudit();
            return {
                controller: {
                    state: controller.state,
                    activeRequests: controller.activeRequests,
                    activeCaptures: controller.activeCaptures,
                    activeBridges: controller.activeBridges,
                    completedCallbacks: controller.completedCallbacks,
                    lastRequestId: controller.lastRequestId,
                },
                bridge: getScreenShareAudioBridgeAudit(),
                fake: getFakeScreenShareAudioAudit(),
            };
        },
    });
}

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
        (typeof reply.sourceId !== "string" && reply.sourceId !== null)
    ) {
        return;
    }
    displayMediaController.reply(senderId, reply);
}

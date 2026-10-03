/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { desktopCapturer, webContents, type DisplayMediaRequestHandlerHandlerRequest, type Streams } from "electron";

interface DisplayMediaPickerReply {
    requestId: number;
    sourceId: string | null;
    shareSystemAudio: boolean;
}

interface PendingDisplayMediaRequest {
    requestId: number;
    senderId: number;
    audioRequested: boolean;
    callback: (streams: Streams) => void;
    dispose: () => void;
}

const emptySource = { id: "", name: "" };
let nextRequestId = 1;
let pendingRequest: PendingDisplayMediaRequest | undefined;

function complete(request: PendingDisplayMediaRequest, streams: Streams): void {
    if (pendingRequest !== request) return;
    pendingRequest = undefined;
    request.dispose();
    request.callback(streams);
}

function cancelPendingRequest(): void {
    const request = pendingRequest;
    if (request) complete(request, { video: emptySource });
}

/**
 * Handles a display-media request using the Element source picker.
 *
 * Electron's native loopback captures the complete system mix independently of the selected video source. The
 * renderer must therefore ask for it explicitly after explaining that scope to the user.
 */
export function handleDisplayMediaRequest(
    request: DisplayMediaRequestHandlerHandlerRequest,
    callback: (streams: Streams) => void,
): void {
    const frame = request.frame;
    const contents = frame && webContents.fromFrame(frame);
    const mainWindow = global.mainWindow;
    if (!frame || frame.detached || !contents || !mainWindow || mainWindow.webContents.id !== contents.id) {
        callback({ video: emptySource });
        return;
    }

    cancelPendingRequest();

    const requestId = nextRequestId++;
    const onRequesterDestroyed = (): void => cancelPendingRequest();
    contents.once("destroyed", onRequesterDestroyed);
    contents.once("render-process-gone", onRequesterDestroyed);

    pendingRequest = {
        requestId,
        senderId: contents.id,
        audioRequested: request.audioRequested,
        callback,
        dispose: () => {
            contents.removeListener("destroyed", onRequesterDestroyed);
            contents.removeListener("render-process-gone", onRequesterDestroyed);
        },
    };
    mainWindow.webContents.send("openDesktopCapturerSourcePicker", { requestId });
}

/** Completes the matching display-media request with the source selected in the renderer. */
export async function handleDisplayMediaPickerReply(senderId: number, reply: unknown): Promise<void> {
    if (
        typeof reply !== "object" ||
        reply === null ||
        !("requestId" in reply) ||
        !Number.isSafeInteger(reply.requestId) ||
        !("sourceId" in reply) ||
        (typeof reply.sourceId !== "string" && reply.sourceId !== null) ||
        !("shareSystemAudio" in reply) ||
        typeof reply.shareSystemAudio !== "boolean"
    ) {
        return;
    }

    const pickerReply = reply as unknown as DisplayMediaPickerReply;
    const request = pendingRequest;
    if (!request || request.senderId !== senderId || request.requestId !== pickerReply.requestId) return;
    if (pickerReply.sourceId === null) {
        complete(request, { video: emptySource });
        return;
    }

    try {
        const sources = await desktopCapturer.getSources({ types: ["screen", "window"] });
        if (pendingRequest !== request) return;
        const source = sources.find(({ id }) => id === pickerReply.sourceId);
        if (!source) {
            complete(request, { video: emptySource });
            return;
        }

        const shareSystemAudio = process.platform === "win32" && request.audioRequested && pickerReply.shareSystemAudio;
        complete(request, {
            video: source,
            ...(shareSystemAudio ? { audio: "loopback" as const } : {}),
        });
    } catch (error) {
        console.error("Failed to validate desktop capturer source", error);
        complete(request, { video: emptySource });
    }
}

/** Clears a pending picker request during application shutdown. */
export function cancelDisplayMediaRequest(): void {
    cancelPendingRequest();
}

/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { ipcRenderer } from "electron";

ipcRenderer.once("screen-share-audio-port", (event) => {
    const [port] = event.ports;
    const bridgeWindow = globalThis as unknown as {
        postMessage(message: string, targetOrigin: string, transfer: unknown[]): void;
    };
    if (port) bridgeWindow.postMessage("screen-share-audio-port", "*", [port]);
});

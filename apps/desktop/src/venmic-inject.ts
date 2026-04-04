/*
Copyright 2026 Joao Costa <me@joaocosta.dev>

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

/**
 * Injects the venmic getDisplayMedia patch into all frames (including iframes)
 * so that Element Call can capture audio from the venmic virtual microphone.
 *
 * NOTE: Cross-origin iframes may not have access to window.electron, in which
 * case venmic will not automatically stop when the stream ends. Cleanup will
 * happen on app close or reload.
 */

import type { WebContents } from "electron";

import { VENMIC_PATCH_SCRIPT } from "./venmic-patch.js";

export function setupVenmicInjection(webContents: WebContents): void {
    webContents.on("did-frame-finish-load", async (_event, isMainFrame) => {
        try {
            if (isMainFrame) {
                await webContents.executeJavaScript(VENMIC_PATCH_SCRIPT, true);
                console.debug("venmic: patch injected into main frame");
            } else {
                const mainFrame = webContents.mainFrame;
                if (mainFrame) {
                    await injectIntoAllFrames(mainFrame);
                }
            }
        } catch (err) {
            console.debug("venmic: failed to inject into frame:", err);
        }
    });

    const mainFrame = webContents.mainFrame;
    if (mainFrame) {
        void injectIntoAllFrames(mainFrame);
    }
}

async function injectIntoAllFrames(frame: Electron.WebFrameMain): Promise<void> {
    try {
        if (!frame.url) return;

        await frame.executeJavaScript(VENMIC_PATCH_SCRIPT, true);
        console.debug("venmic: patch injected into frame:", frame.url);
    } catch (err) {
        console.debug("venmic: failed to inject into frame:", err);
    }

    await Promise.all(frame.frames.map((childFrame) => injectIntoAllFrames(childFrame)));
}

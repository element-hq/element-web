/*
Copyright 2026 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { session, systemPreferences } from "electron";

/**
 * Bridge Chromium `getUserMedia` (camera/microphone) permission requests to the macOS
 * TCC (Transparency, Consent & Control) consent flow.
 *
 * Background (element-web#32373): on macOS the renderer's `getUserMedia` does not reliably
 * raise the OS consent dialog, so the underlying request is denied before the user is ever
 * prompted — surfacing as "Couldn't start capturing media". The fix is for the main process
 * to proactively call `systemPreferences.askForMediaAccess`, which (combined with the
 * `NS*UsageDescription` Info.plist strings declared in `electron-builder.ts`) makes macOS
 * show the prompt.
 *
 * Registering permission handlers overrides Electron's default "grant everything" behaviour
 * for *all* permission types, so both handlers below are deliberately **fail-open**: anything
 * we don't specifically bridge is still granted, and media is never gated by origin. This
 * preserves the previous baseline — notifications, fullscreen, screen-share (`display-capture`),
 * clipboard, and crucially media requested by remote-origin widget iframes (e.g. Jitsi, whose
 * requests arrive from a cross-origin subframe) all keep working exactly as before.
 */
export function setupMediaPermissions(): void {
    session.defaultSession.setPermissionRequestHandler(async (_webContents, permission, callback, details) => {
        if (permission === "media" && process.platform === "darwin") {
            try {
                const mediaTypes = (details as Electron.MediaAccessPermissionRequest).mediaTypes ?? [];
                // De-duplicate so an audio+video call only asks for each device once, and only request
                // the device types actually asked for (don't prompt for the camera on an audio-only call).
                const osTypes = new Set<"microphone" | "camera">();
                for (const mediaType of mediaTypes) {
                    osTypes.add(mediaType === "audio" ? "microphone" : "camera");
                }
                for (const osType of osTypes) {
                    // Only ask when the user hasn't decided yet. If already granted/denied/restricted the
                    // OS won't show a prompt, so calling it would be a no-op (and could block needlessly).
                    if (systemPreferences.getMediaAccessStatus(osType) === "not-determined") {
                        // Sequential on purpose: surface one native dialog at a time rather than stacking them.
                        // eslint-disable-next-line no-await-in-loop
                        await systemPreferences.askForMediaAccess(osType);
                    }
                }
            } catch (e) {
                // The native TCC call can throw (e.g. a missing Info.plist usage string in an unsigned
                // dev build). Never let that strand the request: fall through to the fail-open grant so
                // getUserMedia resolves (and fails cleanly at the OS layer if access really is denied)
                // rather than hanging forever with no callback.
                console.error("media-permissions: failed to request macOS media access", e);
            }
        }

        // Fail-open: keep Electron's default-allow baseline for every permission we don't bridge.
        callback(true);
    });

    // The synchronous pre-flight check `getUserMedia` runs before the request handler. Keep it
    // fail-open and origin-agnostic — `webContents` is null for cross-origin widget subframes — so
    // the check never denies remote widget media.
    session.defaultSession.setPermissionCheckHandler(() => true);
}

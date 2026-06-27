/*
Copyright 2026 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

/** What should happen when the main window receives a `close` event. */
export type WindowCloseBehavior = "quit" | "hide-app" | "hide-window";

/**
 * Decides what closing the main window should do.
 *
 * On macOS, closing the window (⌘W or the red traffic-light) is treated the same as hiding the
 * whole app (⌘H): we hide the *application* rather than just the window, so another app becomes
 * active and the user is not left with Element frontmost showing an empty menu bar and no window
 * — the "limbo state" reported in https://github.com/element-hq/element-web/issues/32267.
 *
 * Elsewhere, when a tray icon is present, closing minimises to the tray (the window is hidden).
 * Without a tray (and not on macOS) the window is allowed to actually close, which on the
 * single-window desktop app cascades into `window-all-closed` and quits the app.
 *
 * A real quit already in progress (`appQuitting`) always wins: the window must be allowed to close.
 *
 * @param opts.appQuitting - whether a genuine app quit is already underway
 * @param opts.hasTray - whether a tray icon exists to minimise to
 * @param opts.platform - the current platform (`process.platform`)
 */
export function resolveWindowCloseBehavior(opts: {
    appQuitting: boolean;
    hasTray: boolean;
    platform: NodeJS.Platform;
}): WindowCloseBehavior {
    if (opts.appQuitting) return "quit";
    if (opts.platform === "darwin") return "hide-app";
    if (opts.hasTray) return "hide-window";
    return "quit";
}

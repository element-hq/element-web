/*
Copyright 2026 hayaksi1

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { app } from "electron";
import type { BrowserWindow, Event } from "electron";

type WindowCloseBehavior = "quit" | "hide-app" | "hide-window";

function resolveWindowCloseBehavior(opts: {
    appQuitting: boolean;
    hasTray: boolean;
    platform: NodeJS.Platform;
}): WindowCloseBehavior {
    if (opts.appQuitting) return "quit";
    if (opts.platform === "darwin") return "hide-app";
    if (opts.hasTray) return "hide-window";
    return "quit";
}

/**
 * React to a `close` event on the main window.
 *
 * On macOS, closing the window (⌘W or the red traffic-light) is treated the same as hiding the
 * whole app (⌘H): the *application* is hidden rather than just the window, so another app becomes
 * active and the user is not left with Element frontmost showing an empty menu bar and no window
 * — the "limbo state" reported in https://github.com/element-hq/element-web/issues/32267.
 *
 * Elsewhere, when a tray icon is present, closing minimises to the tray (the window is hidden).
 * Without a tray (and not on macOS) the window is left to actually close, which on the
 * single-window desktop app cascades into `window-all-closed` and quits the app. A real quit
 * already in progress (`appQuitting`) always wins: the window must be allowed to close.
 *
 * A fullscreen window is taken out of fullscreen first and hidden once macOS has finished the
 * animation, otherwise it is restored to an empty fullscreen space.
 *
 * @param event - the `close` event, whose default is prevented unless the window may close
 * @param window - the main window, or null if it has already gone away
 * @param opts.appQuitting - whether a genuine app quit is already underway
 * @param opts.hasTray - whether a tray icon exists to minimise to
 */
export function handleWindowClose(
    event: Event,
    window: BrowserWindow | null,
    opts: { appQuitting: boolean; hasTray: boolean },
): void {
    const behavior = resolveWindowCloseBehavior({ ...opts, platform: process.platform });
    if (behavior === "quit") return;

    event.preventDefault();
    const hide = behavior === "hide-app" ? (): void => app.hide() : (): void => window?.hide();

    if (window?.isFullScreen()) {
        window.once("leave-full-screen", hide);
        window.setFullScreen(false);
    } else {
        hide();
    }
}

/**
 * Bring the main window back in front of the user, as the counterpart to {@link handleWindowClose}.
 *
 * `app.hide()` is an NSApplication-level hide which does not clear `BrowserWindow.isVisible()`, so
 * an `isVisible()` guard cannot see that the ⌘W path hid the app. The app is therefore un-hidden
 * unconditionally on macOS, which is a no-op when it was never hidden.
 *
 * @param window - the main window to reveal
 */
export function revealMainWindow(window: BrowserWindow): void {
    if (process.platform === "darwin") app.show();
    if (!window.isVisible()) window.show();
    if (window.isMinimized()) window.restore();
    window.focus();
}

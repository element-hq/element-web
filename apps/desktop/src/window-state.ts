/*
Copyright 2026 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type BrowserWindow, type Display } from "electron";

import Store, { type PersistedWindowState, type WindowBounds } from "./store.js";

/**
 * Remembers the main window's size, position, and maximized state across launches.
 *
 * This is an in-repo replacement for the unmaintained `electron-window-state` package (last
 * released 2018), which on macOS only ever flushed state on the BrowserWindow `closed` event.
 * Element hides-on-close on macOS (`event.preventDefault()` — the window is never destroyed), so
 * `closed` never fires and geometry was lost on any crash/force-quit (element-web#32228). The
 * replacement instead persists through the existing `electron-store`-backed {@link Store} (atomic,
 * durable writes) on every relevant window event, so the saved state always reflects reality.
 *
 * Fullscreen is deliberately **not** restored. The old library re-applied a persisted
 * `isFullScreen` flag on launch, which became sticky (Element quits without un-fullscreening, and
 * on Linux tiling WMs `isFullScreen()` is a false positive) and is the "always starts in
 * fullscreen" bug (element-web#32360). Like VS Code (`window.restoreFullscreen` defaults to false)
 * we only restore size/position/maximized, so the app never auto-enters fullscreen on launch.
 */

/** The default window size used on first launch and when persisted bounds are unusable. */
export const DEFAULT_WIDTH = 1024;
export const DEFAULT_HEIGHT = 768;

/** How much of the window (in px, each axis) must overlap a display's work area to count as visible. */
const MIN_VISIBLE_PX = 100;

/** Debounce applied to the high-frequency `resize`/`move` events before persisting. */
export const PERSIST_DEBOUNCE_MS = 250;

/** The subset of {@link BrowserWindow} we read when capturing state (also satisfied by test fakes). */
export interface WindowStateSource {
    isMaximized(): boolean;
    isFullScreen(): boolean;
    isMinimized(): boolean;
    getBounds(): WindowBounds;
}

/** The state handed to the {@link BrowserWindow} constructor and applied on `ready-to-show`. */
export interface RestoreState {
    /** `x`/`y` are omitted when there is nothing valid to restore, so Electron centres the window. */
    bounds: { x?: number; y?: number; width: number; height: number };
    isMaximized: boolean;
}

/** Validates that an untrusted value is a usable window rectangle (finite integers, positive dimensions). */
export function boundsAreValid(bounds: unknown): bounds is WindowBounds {
    if (typeof bounds !== "object" || bounds === null) return false;
    const { x, y, width, height } = bounds as Record<string, unknown>;
    return (
        Number.isInteger(x) &&
        Number.isInteger(y) &&
        Number.isInteger(width) &&
        Number.isInteger(height) &&
        (width as number) > 0 &&
        (height as number) > 0
    );
}

/**
 * Whether a usable chunk of the rectangle overlaps the *work area* of at least one display.
 *
 * Uses work area (not full display bounds) and an overlap test (not full containment) so a window
 * tucked under the macOS menu bar/notch, or dragged a little off an edge, is preserved rather than
 * reset — while a window stranded on a now-disconnected monitor still falls back to defaults.
 */
export function isVisibleOnSomeDisplay(bounds: WindowBounds, displays: Display[]): boolean {
    return displays.some((display) => {
        const { workArea } = display;
        const overlapWidth =
            Math.min(bounds.x + bounds.width, workArea.x + workArea.width) - Math.max(bounds.x, workArea.x);
        const overlapHeight =
            Math.min(bounds.y + bounds.height, workArea.y + workArea.height) - Math.max(bounds.y, workArea.y);
        return overlapWidth >= MIN_VISIBLE_PX && overlapHeight >= MIN_VISIBLE_PX;
    });
}

/**
 * Resolves the persisted state into the geometry to create the window with.
 *
 * Valid, on-screen bounds are restored verbatim; otherwise the default size is used (centred, by
 * omitting x/y). The maximized intent is always preserved — even when the normal bounds have to be
 * dropped — so the window restores maximized with a sane underlying size.
 */
export function resolveRestoreState(persisted: PersistedWindowState | undefined, displays: Display[]): RestoreState {
    const isMaximized = persisted?.isMaximized === true;

    const saved = persisted?.bounds;
    if (saved && boundsAreValid(saved) && isVisibleOnSomeDisplay(saved, displays)) {
        return { bounds: { x: saved.x, y: saved.y, width: saved.width, height: saved.height }, isMaximized };
    }
    return { bounds: { width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT }, isMaximized };
}

/**
 * Captures the current window state for persistence.
 *
 * The normal (windowed) bounds are only overwritten when the window is in a normal state, so the
 * last sensible size survives a capture taken while maximized or fullscreen. Fullscreen is detected
 * only to avoid persisting the fullscreen rectangle as the windowed size — it is never itself
 * persisted (see the module docstring / #32360). While minimized the geometry is unreliable, so the
 * previous state is returned untouched.
 */
export function captureState(win: WindowStateSource, previous: PersistedWindowState): PersistedWindowState {
    if (win.isMinimized()) return previous;

    const isMaximized = win.isMaximized();
    let bounds = previous.bounds;
    if (!isMaximized && !win.isFullScreen()) {
        const live = win.getBounds();
        bounds = { x: live.x, y: live.y, width: live.width, height: live.height };
    }
    return { bounds, isMaximized };
}

/**
 * Tracks and persists the main window's geometry. Mirrors the {@link import('./auto-launch.js')}
 * pattern: a thin class over a pure core plus the {@link Store} seam, so the logic is unit-testable
 * without a live window.
 */
export class WindowStateManager {
    private state: PersistedWindowState;
    private persistTimer?: ReturnType<typeof setTimeout>;

    public constructor() {
        this.state = Store.instance?.get("windowState") ?? {};
    }

    /** The geometry to create the window with, clamped to the currently-connected displays. */
    public getRestoreState(displays: Display[]): RestoreState {
        return resolveRestoreState(this.state, displays);
    }

    /**
     * Capture the window's current state and persist it durably through the store. Reading a
     * window that has already been torn down throws ("Object has been destroyed"); that is
     * swallowed so a late timer or a teardown-time flush is a no-op rather than a crash.
     */
    public persist(win: WindowStateSource): void {
        let next: PersistedWindowState;
        try {
            next = captureState(win, this.state);
        } catch {
            return;
        }
        this.state = next;
        Store.instance?.set("windowState", this.state);
    }

    private cancelPendingPersist(): void {
        if (this.persistTimer) {
            clearTimeout(this.persistTimer);
            this.persistTimer = undefined;
        }
    }

    /**
     * Subscribe to the window events that change persisted state. High-frequency `resize`/`move`
     * are debounced (coalesced into one write); discrete maximize/un-maximize and the return from
     * fullscreen persist immediately. The pending debounce is cancelled on `closed` so a stale
     * timer never fires against a destroyed window.
     */
    public monitor(win: BrowserWindow): void {
        const schedule = (): void => {
            this.cancelPendingPersist();
            this.persistTimer = setTimeout(() => this.persist(win), PERSIST_DEBOUNCE_MS);
        };
        const persistNow = (): void => this.persist(win);

        win.on("resize", schedule);
        win.on("move", schedule);
        win.on("maximize", persistNow);
        win.on("unmaximize", persistNow);
        win.on("leave-full-screen", persistNow);
        win.on("closed", () => this.cancelPendingPersist());
    }
}

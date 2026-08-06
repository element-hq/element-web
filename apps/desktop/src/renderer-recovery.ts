/*
Copyright 2026 hayaksi1

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type BrowserWindow, type RenderProcessGoneDetails, dialog } from "electron";

import { _t } from "./language-helper.js";
import { getConfig } from "./config.js";

/**
 * Auto-recovery for a dead renderer ("white screen, no UI after switching back", element-web#32222).
 *
 * IMPORTANT — this is a MITIGATION, not a root-cause fix. The white screen itself is an UPSTREAM
 * Electron/Chromium renderer/GPU-process crash (commonly a corrupted GPUCache) that reproduces across
 * Linux/Windows/macOS and which we cannot fix in this repository. What we *can* fix is the in-repo gap:
 * previously there was no `render-process-gone` / `unresponsive` handler anywhere in the main process,
 * so once the renderer died the window stayed permanently blank and the user had to kill the whole app.
 * We turn that dead window back into a reload. The render-process-gone → reload pattern is industry
 * standard (VS Code / Slack / Discord all do it).
 *
 * The decision logic is kept pure and the Electron wiring thin so it can be unit-tested without a GUI.
 */

/**
 * The crash-class `render-process-gone` reasons we treat as recoverable and reload for.
 *
 * Deliberately EXCLUDED from the union of possible reasons:
 *  - `clean-exit`       — the renderer exited normally (e.g. teardown); nothing to recover.
 *  - `killed`           — the process was killed (often by us / the OS on purpose); don't fight it.
 *  - `abnormal-exit`    — ambiguous; can be an intentional kill, so we stay conservative and don't reload.
 *  - `memory-eviction`  — Chromium reclaiming a backgrounded renderer to save memory; reloading here
 *                         would cause spurious reloads when the window is simply hidden.
 */
export const CRASH_REASONS = ["crashed", "oom", "launch-failed", "integrity-failure"] as const;

export type CrashReason = (typeof CRASH_REASONS)[number];

/** How many reloads we permit inside {@link RECOVERY_WINDOW_MS} before we give up and warn instead. */
export const RECOVERY_ATTEMPT_CAP = 3;

/** Rolling window over which {@link RECOVERY_ATTEMPT_CAP} is counted, to distinguish a one-off crash from a loop. */
export const RECOVERY_WINDOW_MS = 60 * 1000;

/** The action the recovery logic decides to take for a given `render-process-gone` event. */
export type RecoveryAction = "reload" | "dialog" | "ignore";

function isCrashReason(reason: RenderProcessGoneDetails["reason"]): reason is CrashReason {
    return (CRASH_REASONS as readonly string[]).includes(reason);
}

/**
 * Pure decision for what to do when the renderer is gone. No side effects, fully unit-testable.
 *
 * @param input.reason - the `render-process-gone` reason reported by Electron.
 * @param input.appQuitting - whether a legitimate app quit is underway (so we must NOT reload).
 * @param input.attemptsInWindow - reloads already performed inside the current rolling window.
 * @returns `"ignore"` for benign reasons / during quit, `"dialog"` once the cap is hit (crash loop),
 *          otherwise `"reload"`.
 */
export function decideRendererRecoveryAction(input: {
    reason: RenderProcessGoneDetails["reason"];
    appQuitting: boolean;
    attemptsInWindow: number;
}): RecoveryAction {
    // Never resurrect a renderer that went away as part of a legitimate shutdown (including the macOS
    // app.hide() path, where we deliberately tear things down) — reloading then would fight the quit.
    if (input.appQuitting) return "ignore";

    // Only act on genuine crash-class reasons; benign exits are left alone.
    if (!isCrashReason(input.reason)) return "ignore";

    // Crash-LOOP guard: once we've already reloaded the cap's worth of times in this window, stop
    // reloading (it clearly isn't recovering) and surface an error dialog instead.
    if (input.attemptsInWindow >= RECOVERY_ATTEMPT_CAP) return "dialog";

    return "reload";
}

/** Minimal surface of `BrowserWindow` the recovery needs — kept narrow so tests can fake it. */
type RecoverableWindow = Pick<BrowserWindow, "isDestroyed"> & {
    webContents: Pick<BrowserWindow["webContents"], "on" | "reload" | "isCrashed">;
};

/** Injectable dependencies so the wiring is testable without a live Electron GUI. */
export interface RendererRecoveryDeps {
    win: RecoverableWindow;
    /** Returns the current time in ms (injected so the rolling window can be tested deterministically). */
    clock: () => number;
    /** Whether a real quit is in progress (wraps `global.appQuitting`). */
    isQuitting: () => boolean;
    /** Shows the "couldn't recover" error dialog. Injected so tests don't pop a real dialog. */
    showDialog: () => void;
}

/**
 * Stateful coordinator wrapping {@link decideRendererRecoveryAction} with the attempt accounting and
 * the actual Electron side effects (reload / dialog). One instance per window.
 */
export class RendererRecovery {
    /** Timestamps (per {@link RendererRecoveryDeps.clock}) of the reloads still inside the rolling window. */
    private attempts: number[] = [];
    /** Whether we've already reloaded for an `unresponsive` hang in the current window (bounded once). */
    private unresponsiveHandled = false;

    public constructor(private readonly deps: RendererRecoveryDeps) {}

    /** Wire the recovery handlers onto the window's webContents. */
    public register(): void {
        this.deps.win.webContents.on("render-process-gone", (_event, details) => {
            this.onRenderProcessGone(details);
        });
        this.deps.win.webContents.on("unresponsive", () => {
            this.onUnresponsive();
        });
    }

    /** Drop attempt timestamps that have aged out of the rolling window. */
    private pruneAttempts(): void {
        const cutoff = this.deps.clock() - RECOVERY_WINDOW_MS;
        this.attempts = this.attempts.filter((t) => t > cutoff);
        // Once the window is quiet again, allow a future hang to be recovered once more.
        if (this.attempts.length === 0) this.unresponsiveHandled = false;
    }

    private onRenderProcessGone(details: RenderProcessGoneDetails): void {
        // MITIGATION (element-web#32222): the renderer died upstream — try to bring the UI back rather
        // than leaving a permanent white screen the user can only escape by killing the whole app.
        console.warn(`renderer-recovery: render-process-gone, reason=${details.reason}`);

        if (this.deps.win.isDestroyed()) return;

        this.pruneAttempts();
        const action = decideRendererRecoveryAction({
            reason: details.reason,
            appQuitting: this.deps.isQuitting(),
            attemptsInWindow: this.attempts.length,
        });

        this.performAction(action);
    }

    /**
     * Recover a renderer that is *already* crashed, driven by a user-initiated relaunch (the dock
     * `activate` / `second-instance` paths in electron-main.ts) rather than a `render-process-gone`
     * event. Routed through the SAME attempt cap as {@link onRenderProcessGone} so a relaunch can't
     * silently re-arm a crash loop we've already given up on (element-web#32222) — once the cap is hit
     * the user gets the error dialog instead of yet another reload.
     */
    public recoverIfCrashed(): void {
        if (this.deps.win.isDestroyed()) return;
        if (!this.deps.win.webContents.isCrashed()) return;

        this.pruneAttempts();
        const action = decideRendererRecoveryAction({
            // The renderer is crashed (isCrashed() above); treat it as a crash-class recovery.
            reason: "crashed",
            appQuitting: this.deps.isQuitting(),
            attemptsInWindow: this.attempts.length,
        });

        this.performAction(action);
    }

    /** Execute the decided {@link RecoveryAction}: reload (recording the attempt) / dialog / ignore. */
    private performAction(action: RecoveryAction): void {
        switch (action) {
            case "reload":
                this.attempts.push(this.deps.clock());
                console.warn(
                    `renderer-recovery: reloading renderer (attempt ${this.attempts.length}/${RECOVERY_ATTEMPT_CAP})`,
                );
                this.deps.win.webContents.reload();
                break;
            case "dialog":
                console.error("renderer-recovery: renderer crash loop detected, giving up and warning the user");
                this.deps.showDialog();
                break;
            case "ignore":
                break;
        }
    }

    private onUnresponsive(): void {
        // A hung (not crashed) renderer: conservatively reload at most once per rolling window, and never
        // during a quit. We reuse the same attempt cap so a hang-loop can't reload forever either.
        console.warn("renderer-recovery: renderer unresponsive");

        if (this.deps.win.isDestroyed() || this.deps.isQuitting()) return;

        this.pruneAttempts();
        if (this.unresponsiveHandled) return;
        if (this.attempts.length >= RECOVERY_ATTEMPT_CAP) {
            console.error("renderer-recovery: unresponsive while already at the reload cap, warning the user");
            this.deps.showDialog();
            return;
        }

        this.unresponsiveHandled = true;
        this.attempts.push(this.deps.clock());
        console.warn("renderer-recovery: reloading unresponsive renderer");
        this.deps.win.webContents.reload();
    }
}

/**
 * Show the "we couldn't recover the window" error dialog. Mirrors the dialog/i18n convention used by
 * store.ts / electron-main.ts (`dialog.showMessageBox` + `_t`).
 */
function showCrashLoopDialog(win: BrowserWindow): void {
    const brand = getConfig().brand;
    void dialog.showMessageBox(win, {
        type: "error",
        title: _t("renderer_crash|title", { brand }),
        message: _t("renderer_crash|message", { brand }),
        detail: _t("renderer_crash|detail"),
        buttons: [_t("action|close")],
    });
}

/**
 * Install renderer auto-recovery on the main window. Thin Electron wiring around {@link RendererRecovery};
 * follows the `setupX(win)` named-export seam used by media-auth.ts / media-permissions.ts.
 *
 * @param win - the main BrowserWindow whose renderer we guard.
 * @returns the {@link RendererRecovery} instance so the caller can route user-initiated relaunch
 *          recovery (dock `activate` / `second-instance`) through {@link RendererRecovery.recoverIfCrashed}.
 */
export function setupRendererRecovery(win: BrowserWindow): RendererRecovery {
    const recovery = new RendererRecovery({
        win,
        clock: (): number => Date.now(),
        isQuitting: (): boolean => global.appQuitting,
        showDialog: (): void => showCrashLoopDialog(win),
    });
    recovery.register();
    return recovery;
}

/*
Copyright 2026 hayaksi1

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { describe, it, expect, beforeEach, vi } from "vitest";
import { type BrowserWindow, type RenderProcessGoneDetails } from "electron";

import {
    CRASH_REASONS,
    RECOVERY_ATTEMPT_CAP,
    RECOVERY_WINDOW_MS,
    decideRendererRecoveryAction,
    RendererRecovery,
    setupRendererRecovery,
} from "./renderer-recovery.js";

// `_t` is irrelevant to the recovery logic; stub it so importing the module under test (which pulls in
// language-helper transitively via the dialog copy) never touches the real i18n machinery.
vi.mock("./language-helper.js", () => ({
    _t: (key: string): string => key,
}));

vi.mock("./config.js", () => ({
    getConfig: (): { brand: string } => ({ brand: "Element" }),
}));

describe("decideRendererRecoveryAction", () => {
    it.each(CRASH_REASONS)("returns 'reload' for the crash-class reason %s", (reason) => {
        expect(decideRendererRecoveryAction({ reason, appQuitting: false, attemptsInWindow: 0 })).toBe("reload");
    });

    it.each(["clean-exit", "killed", "abnormal-exit", "memory-eviction"] as const)(
        "returns 'ignore' for the non-crash reason %s",
        (reason) => {
            expect(decideRendererRecoveryAction({ reason, appQuitting: false, attemptsInWindow: 0 })).toBe("ignore");
        },
    );

    it("returns 'ignore' when a quit is in progress even for a crash reason", () => {
        expect(decideRendererRecoveryAction({ reason: "crashed", appQuitting: true, attemptsInWindow: 0 })).toBe(
            "ignore",
        );
    });

    it("returns 'reload' while still under the attempt cap", () => {
        expect(
            decideRendererRecoveryAction({
                reason: "crashed",
                appQuitting: false,
                attemptsInWindow: RECOVERY_ATTEMPT_CAP - 1,
            }),
        ).toBe("reload");
    });

    it("returns 'dialog' once the attempt cap is reached (crash-loop guard)", () => {
        expect(
            decideRendererRecoveryAction({
                reason: "crashed",
                appQuitting: false,
                attemptsInWindow: RECOVERY_ATTEMPT_CAP,
            }),
        ).toBe("dialog");
    });
});

// A fake BrowserWindow that captures the webContents listeners into a map so tests can fire them,
// mirroring the window-state.test.ts buildWin() pattern.
function buildFakeWin(): {
    win: BrowserWindow;
    handlers: Record<string, (...args: unknown[]) => void>;
    reload: ReturnType<typeof vi.fn>;
    isCrashed: ReturnType<typeof vi.fn>;
    isDestroyed: ReturnType<typeof vi.fn>;
} {
    const handlers: Record<string, (...args: unknown[]) => void> = {};
    const reload = vi.fn();
    const isCrashed = vi.fn(() => false);
    const isDestroyed = vi.fn(() => false);
    const win = {
        isDestroyed,
        webContents: {
            on: vi.fn((event: string, cb: (...args: unknown[]) => void) => {
                handlers[event] = cb;
            }),
            reload,
            isCrashed,
        },
    } as unknown as BrowserWindow;
    return { win, handlers, reload, isCrashed, isDestroyed };
}

const goneDetails = (reason: RenderProcessGoneDetails["reason"]): RenderProcessGoneDetails =>
    ({ reason }) as RenderProcessGoneDetails;

describe("RendererRecovery", () => {
    let now = 0;
    const clock = (): number => now;
    const showDialog = vi.fn<() => void>();

    beforeEach(() => {
        now = 0;
        showDialog.mockClear();
    });

    it("reloads the window on a 'crashed' render-process-gone event", () => {
        const { win, handlers, reload } = buildFakeWin();
        new RendererRecovery({ win, clock, isQuitting: (): boolean => false, showDialog }).register();

        handlers["render-process-gone"]({}, goneDetails("crashed"));

        expect(reload).toHaveBeenCalledTimes(1);
        expect(showDialog).not.toHaveBeenCalled();
    });

    it.each(["oom", "launch-failed", "integrity-failure"] as const)(
        "reloads the window on a '%s' render-process-gone event",
        (reason) => {
            const { win, handlers, reload } = buildFakeWin();
            new RendererRecovery({ win, clock, isQuitting: (): boolean => false, showDialog }).register();

            handlers["render-process-gone"]({}, goneDetails(reason));

            expect(reload).toHaveBeenCalledTimes(1);
        },
    );

    it("does NOT reload for 'clean-exit' or 'killed'", () => {
        const { win, handlers, reload } = buildFakeWin();
        new RendererRecovery({ win, clock, isQuitting: (): boolean => false, showDialog }).register();

        handlers["render-process-gone"]({}, goneDetails("clean-exit"));
        handlers["render-process-gone"]({}, goneDetails("killed"));

        expect(reload).not.toHaveBeenCalled();
        expect(showDialog).not.toHaveBeenCalled();
    });

    it("does NOT reload while the app is quitting (legitimate shutdown / macOS app.hide path)", () => {
        const { win, handlers, reload } = buildFakeWin();
        new RendererRecovery({ win, clock, isQuitting: (): boolean => true, showDialog }).register();

        handlers["render-process-gone"]({}, goneDetails("crashed"));

        expect(reload).not.toHaveBeenCalled();
        expect(showDialog).not.toHaveBeenCalled();
    });

    it("does NOT reload a window that has already been destroyed", () => {
        const { win, handlers, reload, isDestroyed } = buildFakeWin();
        isDestroyed.mockReturnValue(true);
        new RendererRecovery({ win, clock, isQuitting: (): boolean => false, showDialog }).register();

        handlers["render-process-gone"]({}, goneDetails("crashed"));

        expect(reload).not.toHaveBeenCalled();
    });

    it("stops reloading after the attempt cap and shows the error dialog instead (crash-loop guard)", () => {
        const { win, handlers, reload } = buildFakeWin();
        new RendererRecovery({ win, clock, isQuitting: (): boolean => false, showDialog }).register();

        // The first RECOVERY_ATTEMPT_CAP crashes reload; the next one trips the cap and shows the dialog.
        for (let i = 0; i < RECOVERY_ATTEMPT_CAP; i++) {
            handlers["render-process-gone"]({}, goneDetails("crashed"));
        }
        expect(reload).toHaveBeenCalledTimes(RECOVERY_ATTEMPT_CAP);
        expect(showDialog).not.toHaveBeenCalled();

        handlers["render-process-gone"]({}, goneDetails("crashed"));
        expect(reload).toHaveBeenCalledTimes(RECOVERY_ATTEMPT_CAP); // no further reload
        expect(showDialog).toHaveBeenCalledTimes(1);
    });

    it("resets the attempt counter once crashes fall outside the rolling window", () => {
        const { win, handlers, reload } = buildFakeWin();
        new RendererRecovery({ win, clock, isQuitting: (): boolean => false, showDialog }).register();

        for (let i = 0; i < RECOVERY_ATTEMPT_CAP; i++) {
            handlers["render-process-gone"]({}, goneDetails("crashed"));
        }
        expect(reload).toHaveBeenCalledTimes(RECOVERY_ATTEMPT_CAP);

        // Advance past the rolling window: the earlier attempts no longer count, so we reload again.
        now += RECOVERY_WINDOW_MS + 1;
        handlers["render-process-gone"]({}, goneDetails("crashed"));

        expect(reload).toHaveBeenCalledTimes(RECOVERY_ATTEMPT_CAP + 1);
        expect(showDialog).not.toHaveBeenCalled();
    });

    it("reloads once on the first 'unresponsive' event but not repeatedly (bounded)", () => {
        const { win, handlers, reload } = buildFakeWin();
        new RendererRecovery({ win, clock, isQuitting: (): boolean => false, showDialog }).register();

        handlers["unresponsive"]();
        expect(reload).toHaveBeenCalledTimes(1);

        // A second hang inside the same window must not stack reloads.
        handlers["unresponsive"]();
        expect(reload).toHaveBeenCalledTimes(1);
    });

    it("does NOT reload on 'unresponsive' while quitting", () => {
        const { win, handlers, reload } = buildFakeWin();
        new RendererRecovery({ win, clock, isQuitting: (): boolean => true, showDialog }).register();

        handlers["unresponsive"]();

        expect(reload).not.toHaveBeenCalled();
    });

    it("shows the error dialog (instead of reloading) when 'unresponsive' fires while already at the reload cap", () => {
        const { win, handlers, reload } = buildFakeWin();
        new RendererRecovery({ win, clock, isQuitting: (): boolean => false, showDialog }).register();

        // Fill the rolling window with crash reloads up to the cap so a hang now can't reload again.
        for (let i = 0; i < RECOVERY_ATTEMPT_CAP; i++) {
            handlers["render-process-gone"]({}, goneDetails("crashed"));
        }
        expect(reload).toHaveBeenCalledTimes(RECOVERY_ATTEMPT_CAP);

        handlers["unresponsive"]();

        expect(reload).toHaveBeenCalledTimes(RECOVERY_ATTEMPT_CAP); // no further reload
        expect(showDialog).toHaveBeenCalledTimes(1);
    });
});

// A user-initiated relaunch (dock activate / second-instance) must reload a crashed renderer through the
// SAME crash-loop cap, so a relaunch can't silently re-arm a loop the recovery has already given up on.
describe("RendererRecovery.recoverIfCrashed", () => {
    let now = 0;
    const clock = (): number => now;
    const showDialog = vi.fn<() => void>();

    beforeEach(() => {
        now = 0;
        showDialog.mockClear();
    });

    it("reloads a crashed renderer when under the cap", () => {
        const { win, reload, isCrashed } = buildFakeWin();
        isCrashed.mockReturnValue(true);
        const recovery = new RendererRecovery({ win, clock, isQuitting: (): boolean => false, showDialog });
        recovery.register();

        recovery.recoverIfCrashed();

        expect(reload).toHaveBeenCalledTimes(1);
        expect(showDialog).not.toHaveBeenCalled();
    });

    it("does nothing when the renderer is not crashed", () => {
        const { win, reload } = buildFakeWin(); // isCrashed defaults to false
        const recovery = new RendererRecovery({ win, clock, isQuitting: (): boolean => false, showDialog });
        recovery.register();

        recovery.recoverIfCrashed();

        expect(reload).not.toHaveBeenCalled();
        expect(showDialog).not.toHaveBeenCalled();
    });

    it("does NOT reload (and shows the dialog) when crashed but the crash-loop cap was already hit", () => {
        const { win, handlers, reload, isCrashed } = buildFakeWin();
        isCrashed.mockReturnValue(true);
        const recovery = new RendererRecovery({ win, clock, isQuitting: (): boolean => false, showDialog });
        recovery.register();

        // Exhaust the cap via genuine crash events so the loop has already been given up on.
        for (let i = 0; i < RECOVERY_ATTEMPT_CAP; i++) {
            handlers["render-process-gone"]({}, goneDetails("crashed"));
        }
        showDialog.mockClear();
        expect(reload).toHaveBeenCalledTimes(RECOVERY_ATTEMPT_CAP);

        // A user-initiated relaunch must not silently re-arm the loop.
        recovery.recoverIfCrashed();

        expect(reload).toHaveBeenCalledTimes(RECOVERY_ATTEMPT_CAP); // no extra reload
        expect(showDialog).toHaveBeenCalledTimes(1);
    });

    it("counts its OWN reloads toward the crash-loop cap (relaunch can't reload past the cap)", () => {
        const { win, reload, isCrashed } = buildFakeWin();
        isCrashed.mockReturnValue(true);
        const recovery = new RendererRecovery({ win, clock, isQuitting: (): boolean => false, showDialog });
        recovery.register();

        // Mashing dock-activate / second-instance on a crashed renderer must not reload past the cap:
        // recoverIfCrashed records each of its own reloads, so the shared cap is fed both ways.
        for (let i = 0; i < RECOVERY_ATTEMPT_CAP; i++) {
            recovery.recoverIfCrashed();
        }
        expect(reload).toHaveBeenCalledTimes(RECOVERY_ATTEMPT_CAP);
        expect(showDialog).not.toHaveBeenCalled();

        recovery.recoverIfCrashed();
        expect(reload).toHaveBeenCalledTimes(RECOVERY_ATTEMPT_CAP); // no extra reload — loop given up on
        expect(showDialog).toHaveBeenCalledTimes(1);
    });

    it("does nothing when the window is destroyed", () => {
        const { win, reload, isCrashed, isDestroyed } = buildFakeWin();
        isCrashed.mockReturnValue(true);
        isDestroyed.mockReturnValue(true);
        const recovery = new RendererRecovery({ win, clock, isQuitting: (): boolean => false, showDialog });
        recovery.register();

        recovery.recoverIfCrashed();

        expect(reload).not.toHaveBeenCalled();
        expect(showDialog).not.toHaveBeenCalled();
    });

    it("does nothing while the app is quitting", () => {
        const { win, reload, isCrashed } = buildFakeWin();
        isCrashed.mockReturnValue(true);
        const recovery = new RendererRecovery({ win, clock, isQuitting: (): boolean => true, showDialog });
        recovery.register();

        recovery.recoverIfCrashed();

        expect(reload).not.toHaveBeenCalled();
    });
});

describe("setupRendererRecovery", () => {
    it("registers render-process-gone and unresponsive listeners on the window's webContents", () => {
        const { win } = buildFakeWin();

        setupRendererRecovery(win);

        const on = vi.mocked(win.webContents.on);
        const events = on.mock.calls.map((c) => c[0]);
        expect(events).toContain("render-process-gone");
        expect(events).toContain("unresponsive");
    });

    it("returns the RendererRecovery instance so callers can route relaunch recovery through the cap", () => {
        const { win } = buildFakeWin();

        const recovery = setupRendererRecovery(win);

        expect(recovery).toBeInstanceOf(RendererRecovery);
    });
});

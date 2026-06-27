/*
Copyright 2026 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { describe, it, expect, beforeEach, vi } from "vitest";
import { type BrowserWindow, type Display } from "electron";

import {
    boundsAreValid,
    captureState,
    DEFAULT_HEIGHT,
    DEFAULT_WIDTH,
    isVisibleOnSomeDisplay,
    PERSIST_DEBOUNCE_MS,
    resolveRestoreState,
    WindowStateManager,
    type WindowStateSource,
} from "./window-state.js";
import Store, { type PersistedWindowState } from "./store.js";

vi.mock("./store.js", () => ({
    default: { instance: { get: vi.fn(), set: vi.fn() } },
}));

// Build a fake Electron Display exposing just the workArea our helpers read.
const display = (x: number, y: number, width: number, height: number): Display =>
    ({ workArea: { x, y, width, height } }) as unknown as Display;

// A single 1440x900 macOS-style display whose work area is inset 23px for the menu bar.
const PRIMARY = display(0, 23, 1440, 877);

// Build a fake window source for captureState / persist.
const fakeWin = (opts: {
    maximized?: boolean;
    fullscreen?: boolean;
    minimized?: boolean;
    bounds?: { x: number; y: number; width: number; height: number };
}): WindowStateSource => ({
    isMaximized: () => opts.maximized ?? false,
    isFullScreen: () => opts.fullscreen ?? false,
    isMinimized: () => opts.minimized ?? false,
    getBounds: () => opts.bounds ?? { x: 0, y: 0, width: 0, height: 0 },
});

describe("boundsAreValid", () => {
    it("accepts an integer rectangle with positive dimensions (incl. negative x/y for a left-hand display)", () => {
        expect(boundsAreValid({ x: 0, y: 0, width: 1024, height: 768 })).toBe(true);
        expect(boundsAreValid({ x: -1920, y: -200, width: 800, height: 600 })).toBe(true);
    });

    it.each([
        { x: 0, y: 0, width: 0, height: 768 },
        { x: 0, y: 0, width: 1024, height: -1 },
        { x: 0, y: 0, width: 800.5, height: 600 },
        { x: 1.5, y: 0, width: 800, height: 600 },
        { x: Number.NaN, y: 0, width: 800, height: 600 },
        { x: 0, y: 0, width: Number.POSITIVE_INFINITY, height: 600 },
    ])("rejects the non-integer / non-finite / non-positive rectangle %o", (bounds) => {
        expect(boundsAreValid(bounds)).toBe(false);
    });

    it.each([undefined, null, {}, { x: 0, y: 0 }, "1024x768", 5, { x: "0", y: 0, width: 1, height: 1 }])(
        "rejects the malformed value %o",
        (value) => {
            expect(boundsAreValid(value)).toBe(false);
        },
    );
});

describe("isVisibleOnSomeDisplay", () => {
    it("accepts a window fully inside the primary work area", () => {
        expect(isVisibleOnSomeDisplay({ x: 100, y: 100, width: 800, height: 600 }, [PRIMARY])).toBe(true);
    });

    it("accepts a window whose top sits under the menu bar (overlaps work area, not fully contained)", () => {
        // y:0 is above the work area (which starts at 23) — the old strict-containment check reset this.
        expect(isVisibleOnSomeDisplay({ x: 0, y: 0, width: 1440, height: 900 }, [PRIMARY])).toBe(true);
    });

    it("rejects a window entirely off-screen", () => {
        expect(isVisibleOnSomeDisplay({ x: 5000, y: 5000, width: 800, height: 600 }, [PRIMARY])).toBe(false);
    });

    it("accepts a window dragged partly off the right edge while a usable chunk stays visible", () => {
        // 300px of the 800px-wide window remains over the work area — comfortably grabbable.
        expect(isVisibleOnSomeDisplay({ x: 1140, y: 100, width: 800, height: 600 }, [PRIMARY])).toBe(true);
    });

    it("rejects a window with only a sliver visible (less than the grabbable minimum)", () => {
        // Only 40px peeks over the left edge — below the visibility threshold.
        expect(isVisibleOnSomeDisplay({ x: -760, y: 100, width: 800, height: 600 }, [PRIMARY])).toBe(false);
    });

    // Pin the exact MIN_VISIBLE_PX = 100 threshold (workArea.x of PRIMARY is 0), so an off-by-one
    // (>= vs >) or a moved constant is caught.
    it("accepts a window with exactly the minimum horizontal overlap (100px)", () => {
        // x:-700, width:800 -> overlap = (-700+800) - 0 = 100px exactly.
        expect(isVisibleOnSomeDisplay({ x: -700, y: 100, width: 800, height: 600 }, [PRIMARY])).toBe(true);
    });

    it("rejects a window one pixel below the minimum horizontal overlap (99px)", () => {
        expect(isVisibleOnSomeDisplay({ x: -701, y: 100, width: 800, height: 600 }, [PRIMARY])).toBe(false);
    });

    it("rejects a window one pixel below the minimum vertical overlap (99px)", () => {
        // workArea.y is 23; a window ending at y=122 overlaps the work area by 99px vertically.
        expect(isVisibleOnSomeDisplay({ x: 100, y: -478, width: 800, height: 600 }, [PRIMARY])).toBe(false);
    });

    it("accepts a window living on a secondary display to the left of the primary", () => {
        const secondary = display(-1920, 0, 1920, 1080);
        expect(isVisibleOnSomeDisplay({ x: -1800, y: 100, width: 800, height: 600 }, [PRIMARY, secondary])).toBe(true);
    });

    it("rejects when there are no displays at all", () => {
        expect(isVisibleOnSomeDisplay({ x: 0, y: 23, width: 800, height: 600 }, [])).toBe(false);
    });
});

describe("resolveRestoreState", () => {
    it("restores valid, on-screen persisted bounds and the maximized flag verbatim", () => {
        const persisted: PersistedWindowState = {
            bounds: { x: 100, y: 100, width: 900, height: 700 },
            isMaximized: true,
        };
        expect(resolveRestoreState(persisted, [PRIMARY])).toEqual({
            bounds: { x: 100, y: 100, width: 900, height: 700 },
            isMaximized: true,
        });
    });

    it("falls back to the centred default size (no x/y) when nothing is persisted", () => {
        const restore = resolveRestoreState(undefined, [PRIMARY]);
        expect(restore.bounds).toEqual({ width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT });
        expect(restore.bounds.x).toBeUndefined();
        expect(restore.bounds.y).toBeUndefined();
        expect(restore.isMaximized).toBe(false);
    });

    it("drops off-screen persisted bounds but preserves the maximized intent", () => {
        const persisted: PersistedWindowState = {
            bounds: { x: 6000, y: 6000, width: 900, height: 700 },
            isMaximized: true,
        };
        const restore = resolveRestoreState(persisted, [PRIMARY]);
        expect(restore.bounds).toEqual({ width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT });
        expect(restore.isMaximized).toBe(true);
    });

    it("ignores corrupt bounds (zero width) and uses the default size", () => {
        const persisted: PersistedWindowState = { bounds: { x: 0, y: 0, width: 0, height: 700 } };
        expect(resolveRestoreState(persisted, [PRIMARY]).bounds).toEqual({
            width: DEFAULT_WIDTH,
            height: DEFAULT_HEIGHT,
        });
    });

    it("never carries a fullscreen flag, so the app can never auto-start fullscreen (#32360)", () => {
        // Capturing a fullscreen window must not produce anything that re-enters fullscreen on launch.
        const captured = captureState(fakeWin({ fullscreen: true, bounds: { x: 0, y: 0, width: 1440, height: 900 } }), {
            bounds: { x: 50, y: 50, width: 800, height: 600 },
        });
        expect(captured).not.toHaveProperty("isFullScreen");

        const restore = resolveRestoreState(captured, [PRIMARY]);
        expect(restore).not.toHaveProperty("isFullScreen");
    });
});

describe("captureState", () => {
    const previous: PersistedWindowState = { bounds: { x: 10, y: 20, width: 800, height: 600 }, isMaximized: false };

    it("records the live bounds and clears maximized for a normal window", () => {
        const win = fakeWin({ bounds: { x: 30, y: 40, width: 1000, height: 700 } });
        expect(captureState(win, previous)).toEqual({
            bounds: { x: 30, y: 40, width: 1000, height: 700 },
            isMaximized: false,
        });
    });

    it("keeps the previous normal bounds when the window is maximized", () => {
        const win = fakeWin({ maximized: true, bounds: { x: 0, y: 0, width: 1440, height: 900 } });
        expect(captureState(win, previous)).toEqual({
            bounds: { x: 10, y: 20, width: 800, height: 600 },
            isMaximized: true,
        });
    });

    it("keeps the previous normal bounds when the window is fullscreen and does not remember fullscreen", () => {
        const win = fakeWin({ fullscreen: true, bounds: { x: 0, y: 0, width: 1440, height: 900 } });
        expect(captureState(win, previous)).toEqual({
            bounds: { x: 10, y: 20, width: 800, height: 600 },
            isMaximized: false,
        });
    });

    it("returns the previous state untouched while minimized (geometry is unreliable)", () => {
        const win = fakeWin({ minimized: true, bounds: { x: -8, y: -8, width: 0, height: 0 } });
        expect(captureState(win, previous)).toBe(previous);
    });

    it("leaves bounds undefined when maximized on first run with no previous bounds", () => {
        const win = fakeWin({ maximized: true, bounds: { x: 0, y: 0, width: 1440, height: 900 } });
        expect(captureState(win, {})).toEqual({ bounds: undefined, isMaximized: true });
    });
});

describe("WindowStateManager", () => {
    const storeGet = vi.mocked(Store.instance!.get);
    const storeSet = vi.mocked(Store.instance!.set);

    beforeEach(() => {
        vi.clearAllMocks();
        storeGet.mockReturnValue(undefined);
    });

    it("reads the persisted window state from the store on construction", () => {
        const saved: PersistedWindowState = { bounds: { x: 1, y: 2, width: 800, height: 600 } };
        storeGet.mockReturnValue(saved);

        const manager = new WindowStateManager();
        expect(storeGet).toHaveBeenCalledWith("windowState");
        expect(manager.getRestoreState([PRIMARY]).bounds).toEqual({ x: 1, y: 2, width: 800, height: 600 });
    });

    it("falls back to defaults when the store is empty", () => {
        const manager = new WindowStateManager();
        expect(manager.getRestoreState([PRIMARY]).bounds).toEqual({ width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT });
    });

    it("persists the captured state through the store", () => {
        const manager = new WindowStateManager();
        manager.persist(fakeWin({ bounds: { x: 30, y: 40, width: 1000, height: 700 } }));

        expect(storeSet).toHaveBeenCalledWith("windowState", {
            bounds: { x: 30, y: 40, width: 1000, height: 700 },
            isMaximized: false,
        });
    });

    it("retains the last normal bounds across a later maximized capture", () => {
        const manager = new WindowStateManager();
        manager.persist(fakeWin({ bounds: { x: 30, y: 40, width: 1000, height: 700 } }));
        manager.persist(fakeWin({ maximized: true, bounds: { x: 0, y: 0, width: 1440, height: 900 } }));

        expect(storeSet).toHaveBeenLastCalledWith("windowState", {
            bounds: { x: 30, y: 40, width: 1000, height: 700 },
            isMaximized: true,
        });
    });

    it("does not throw or persist when capturing a window that has already been destroyed", () => {
        const manager = new WindowStateManager();
        const thrower = (): never => {
            throw new Error("Object has been destroyed");
        };
        const destroyed = {
            isMinimized: thrower,
            isMaximized: thrower,
            isFullScreen: thrower,
            getBounds: thrower,
        } as unknown as WindowStateSource;

        expect(() => manager.persist(destroyed)).not.toThrow();
        expect(storeSet).not.toHaveBeenCalled();
    });

    describe("monitor", () => {
        const buildWin = (): {
            win: BrowserWindow;
            handlers: Record<string, () => void>;
            setFullscreen: (v: boolean) => void;
            setBounds: (b: { x: number; y: number; width: number; height: number }) => void;
        } => {
            const handlers: Record<string, () => void> = {};
            let fullscreen = false;
            let bounds = { x: 1, y: 2, width: 800, height: 600 };
            const win = {
                on: vi.fn((event: string, cb: () => void) => {
                    handlers[event] = cb;
                }),
                isMaximized: () => false,
                isFullScreen: () => fullscreen,
                isMinimized: () => false,
                getBounds: () => bounds,
            } as unknown as BrowserWindow;
            return {
                win,
                handlers,
                setFullscreen: (v): void => {
                    fullscreen = v;
                },
                setBounds: (b): void => {
                    bounds = b;
                },
            };
        };

        it("subscribes to every geometry/state transition plus window teardown", () => {
            const { win } = buildWin();
            new WindowStateManager().monitor(win);
            for (const event of ["resize", "move", "maximize", "unmaximize", "leave-full-screen", "closed"]) {
                expect(win.on).toHaveBeenCalledWith(event, expect.any(Function));
            }
        });

        it("persists the restored windowed bounds when leaving fullscreen (reads the live window)", () => {
            const { win, handlers, setFullscreen, setBounds } = buildWin();
            new WindowStateManager().monitor(win);

            // Leaving fullscreen returns the window to its windowed bounds; the handler must read those.
            setFullscreen(false);
            setBounds({ x: 7, y: 8, width: 900, height: 650 });
            handlers["leave-full-screen"]();

            expect(storeSet).toHaveBeenLastCalledWith("windowState", {
                bounds: { x: 7, y: 8, width: 900, height: 650 },
                isMaximized: false,
            });
        });

        it("coalesces a burst of resize/move events into a single persist, then re-arms", () => {
            vi.useFakeTimers();
            try {
                const { win, handlers } = buildWin();
                new WindowStateManager().monitor(win);

                handlers["move"]();
                vi.advanceTimersByTime(PERSIST_DEBOUNCE_MS - 1);
                handlers["resize"](); // resets the timer — proves clearTimeout coalescing
                handlers["move"]();
                vi.advanceTimersByTime(PERSIST_DEBOUNCE_MS - 1);
                expect(storeSet).not.toHaveBeenCalled(); // still within the debounce of the last event

                vi.advanceTimersByTime(1);
                expect(storeSet).toHaveBeenCalledTimes(1); // ONE write for the whole burst

                handlers["move"](); // re-arm after a flush
                vi.advanceTimersByTime(PERSIST_DEBOUNCE_MS);
                expect(storeSet).toHaveBeenCalledTimes(2);
            } finally {
                vi.useRealTimers();
            }
        });

        it("cancels a pending debounced persist once the window is closed", () => {
            vi.useFakeTimers();
            try {
                const { win, handlers } = buildWin();
                new WindowStateManager().monitor(win);

                handlers["move"](); // schedule a debounced persist
                handlers["closed"](); // window torn down — must cancel it
                vi.advanceTimersByTime(PERSIST_DEBOUNCE_MS * 2);

                expect(storeSet).not.toHaveBeenCalled();
            } finally {
                vi.useRealTimers();
            }
        });
    });
});

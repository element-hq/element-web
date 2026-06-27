/*
Copyright 2026 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { describe, expect, it } from "vitest";

import { resolveWindowCloseBehavior } from "./window-close.js";

describe("resolveWindowCloseBehavior", () => {
    it("hides the whole app on macOS without a tray (#32267)", () => {
        expect(resolveWindowCloseBehavior({ appQuitting: false, hasTray: false, platform: "darwin" })).toBe("hide-app");
    });

    it("hides the whole app on macOS even when a tray is present", () => {
        expect(resolveWindowCloseBehavior({ appQuitting: false, hasTray: true, platform: "darwin" })).toBe("hide-app");
    });

    it("hides the window (minimise to tray) on Linux with a tray", () => {
        expect(resolveWindowCloseBehavior({ appQuitting: false, hasTray: true, platform: "linux" })).toBe(
            "hide-window",
        );
    });

    it("quits on Linux without a tray", () => {
        expect(resolveWindowCloseBehavior({ appQuitting: false, hasTray: false, platform: "linux" })).toBe("quit");
    });

    it("hides the window (minimise to tray) on Windows with a tray", () => {
        expect(resolveWindowCloseBehavior({ appQuitting: false, hasTray: true, platform: "win32" })).toBe(
            "hide-window",
        );
    });

    it("quits on Windows without a tray", () => {
        expect(resolveWindowCloseBehavior({ appQuitting: false, hasTray: false, platform: "win32" })).toBe("quit");
    });

    it("quits on macOS when a real quit is already in progress", () => {
        expect(resolveWindowCloseBehavior({ appQuitting: true, hasTray: false, platform: "darwin" })).toBe("quit");
    });

    it("quits when appQuitting wins over a tray on Linux", () => {
        expect(resolveWindowCloseBehavior({ appQuitting: true, hasTray: true, platform: "linux" })).toBe("quit");
    });
});

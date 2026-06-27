/*
Copyright 2026 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { describe, expect, it } from "vitest";

import {
    DARK_BACKGROUND_COLOR,
    isValidThemeColor,
    LIGHT_BACKGROUND_COLOR,
    resolveBackgroundColor,
} from "./background-color.js";

describe("isValidThemeColor", () => {
    it.each([
        "#fff",
        "#ffffff",
        "#101317",
        "#ABC123",
        "rgb(16, 19, 23)",
        "rgb(255,255,255)",
        "rgba(0, 0, 0, 1)",
        "rgba(16, 19, 23, 1.0)",
    ])("accepts the opaque CSS colour %s", (color) => {
        expect(isValidThemeColor(color)).toBe(true);
    });

    it.each([
        // translucent values must be rejected to keep the window opaque (#32260 / blurry-font FAQ)
        "#ffff",
        "#ffffffff",
        "#0000",
        "#00000000",
        "rgba(16, 19, 23, 0.5)",
        "rgba(0,0,0,0)",
        "rgba(255,255,255,0.99)",
    ])("rejects the translucent colour %s", (color) => {
        expect(isValidThemeColor(color)).toBe(false);
    });

    it.each([
        "",
        "   ",
        "white",
        "transparent",
        "#ff",
        "#fffff",
        "#gggggg",
        "rgb()",
        "rgb(1,2)",
        "javascript:alert(1)",
        "url(evil)",
        "rgb(16, 19, 23); background: url(x)",
    ])("rejects the invalid colour %s", (color) => {
        expect(isValidThemeColor(color)).toBe(false);
    });

    it.each([undefined, null, 123, {}, [], true])("rejects the non-string %s", (value) => {
        expect(isValidThemeColor(value)).toBe(false);
    });
});

describe("resolveBackgroundColor", () => {
    it("returns a valid persisted colour over the theme default", () => {
        expect(resolveBackgroundColor("rgb(16, 19, 23)", false)).toBe("rgb(16, 19, 23)");
        expect(resolveBackgroundColor("#abcdef", true)).toBe("#abcdef");
    });

    it("falls back to the dark default when no persisted colour and the OS prefers dark", () => {
        expect(resolveBackgroundColor(undefined, true)).toBe(DARK_BACKGROUND_COLOR);
    });

    it("falls back to the light default when no persisted colour and the OS prefers light", () => {
        expect(resolveBackgroundColor(undefined, false)).toBe(LIGHT_BACKGROUND_COLOR);
    });

    it("ignores an invalid persisted colour and uses the theme default", () => {
        expect(resolveBackgroundColor("not-a-colour", true)).toBe(DARK_BACKGROUND_COLOR);
        expect(resolveBackgroundColor("", false)).toBe(LIGHT_BACKGROUND_COLOR);
    });

    it("ignores a translucent persisted colour and uses the opaque theme default", () => {
        expect(resolveBackgroundColor("rgba(16, 19, 23, 0.5)", true)).toBe(DARK_BACKGROUND_COLOR);
        expect(resolveBackgroundColor("#101317aa", false)).toBe(LIGHT_BACKGROUND_COLOR);
    });

    it("exposes the Element canvas colours as the defaults", () => {
        expect(LIGHT_BACKGROUND_COLOR).toBe("#ffffff");
        expect(DARK_BACKGROUND_COLOR).toBe("#101317");
    });
});

/*
Copyright 2026 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

/**
 * Resolves the native window background colour so the window can be painted in the
 * right colour before the web app's CSS has loaded, avoiding the white flash on launch.
 * See https://github.com/element-hq/element-web/issues/32260.
 */

/** The Element/Compound light theme canvas background (`--cpd-color-bg-canvas-default`). */
export const LIGHT_BACKGROUND_COLOR = "#ffffff";
/** The Element/Compound dark theme canvas background (`--cpd-color-bg-canvas-default`). */
export const DARK_BACKGROUND_COLOR = "#101317";

// Opaque hex only: `#rgb` / `#rrggbb`. Alpha forms (`#rgba` / `#rrggbbaa`) are rejected — they are
// not opaque, and Electron interprets hex alpha in a different byte order anyway.
const HEX_COLOR_RE = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
// `rgb(r, g, b)` or fully-opaque `rgba(r, g, b, 1)` as emitted by `getComputedStyle().backgroundColor`.
// A fractional alpha (anything other than 1) is rejected so the window background stays opaque.
const RGB_COLOR_RE = /^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(?:,\s*1(?:\.0+)?\s*)?\)$/i;

/**
 * Validates that an untrusted value is an **opaque** CSS colour we can safely hand to Electron's
 * `BrowserWindow` background. Only the opaque hex (`#rgb` / `#rrggbb`) and `rgb()` / fully-opaque
 * `rgba(…, 1)` forms emitted by the renderer's computed style are accepted. Translucent colours
 * (any alpha below 1) and anything else (named colours, `transparent`, arbitrary strings) are
 * rejected: a non-opaque window background reintroduces blurry font rendering and a see-through
 * launch window, and rejecting junk stops a buggy or compromised renderer poisoning the persisted value.
 */
export function isValidThemeColor(value: unknown): value is string {
    return typeof value === "string" && (HEX_COLOR_RE.test(value) || RGB_COLOR_RE.test(value));
}

/**
 * Picks the background colour for the main window.
 *
 * Prefers the colour the renderer last reported (persisted across launches, so the window
 * matches a user's chosen theme even when it differs from the OS theme). When there is no
 * valid persisted colour — e.g. the first ever launch — it falls back to the OS appearance
 * so that dark-mode users do not get a white flash.
 *
 * @param persistedColor - the colour last reported by the renderer, if any
 * @param prefersDark - whether the OS is currently using a dark appearance (`nativeTheme.shouldUseDarkColors`)
 */
export function resolveBackgroundColor(persistedColor: string | undefined, prefersDark: boolean): string {
    if (isValidThemeColor(persistedColor)) return persistedColor;
    return prefersDark ? DARK_BACKGROUND_COLOR : LIGHT_BACKGROUND_COLOR;
}

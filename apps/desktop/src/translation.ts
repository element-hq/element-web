/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import type { BrowserWindow } from "electron";

interface NativeTranslation {
    isAvailable(): boolean;
    showTranslation(viewHandle: Buffer, text: string, x: number, y: number, width: number, height: number): void;
}

let translationSupported = false;
let nativeTranslation: NativeTranslation | undefined;

try {
    // macOS-only native addon backed by the private TranslationUI.framework.
    if (process.platform === "darwin") {
        // `element-translation` is a CommonJS module; when imported into ESM, Node only synthesizes
        // named exports it can statically detect, so we use the `default` (the real module.exports).
        const mod = (await import("element-translation")) as unknown as {
            default?: NativeTranslation;
        } & NativeTranslation;
        nativeTranslation = mod.default ?? mod;
        translationSupported = true;
    }
} catch (e) {
    if ((<NodeJS.ErrnoException>e).code === "MODULE_NOT_FOUND") {
        console.log("Native translation isn't installed, message translation is disabled.");
    } else {
        console.warn("Native translation unexpected error:", e);
    }
}

export interface TranslationRect {
    x: number;
    y: number;
    width: number;
    height: number;
}

/**
 * Whether the native macOS translation popover can be shown.
 */
export function isTranslationAvailable(): boolean {
    try {
        return translationSupported && !!nativeTranslation?.isAvailable();
    } catch {
        return false;
    }
}

/**
 * Show the native macOS translation popover for the given text, anchored at the given
 * rect. The rect is provided by the renderer in CSS pixels relative to the top-left of
 * the web contents; we convert it into the content view's AppKit coordinate space
 * (bottom-left origin) before handing it to the addon.
 */
export function showTranslation(win: BrowserWindow, text: string, rect: TranslationRect): void {
    if (!isTranslationAvailable() || !text || !rect) return;

    try {
        const handle = win.getNativeWindowHandle();
        const [, contentHeight] = win.getContentSize();
        // Flip the Y axis: DOM coordinates have a top-left origin, AppKit views a bottom-left one.
        const x = rect.x;
        const y = contentHeight - (rect.y + rect.height);
        nativeTranslation!.showTranslation(handle, text, x, y, rect.width, rect.height);
    } catch (e) {
        console.error("Failed to show native translation popover", e);
    }
}

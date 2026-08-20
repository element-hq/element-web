/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

declare module "element-translation" {
    /**
     * Whether the native macOS translation popover is available
     * (i.e. the private TranslationUI.framework loaded successfully).
     */
    export function isAvailable(): boolean;

    /**
     * Show the native macOS translation popover.
     * @param viewHandle the NSView* handle from BrowserWindow.getNativeWindowHandle()
     * @param text the text to translate
     * @param x rect origin x, in the source view's (AppKit, bottom-left origin) coordinate space
     * @param y rect origin y, in the source view's coordinate space
     * @param width rect width
     * @param height rect height
     */
    export function showTranslation(
        viewHandle: Buffer,
        text: string,
        x: number,
        y: number,
        width: number,
        height: number,
    ): void;
}

/*
Copyright 2023, 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import type { BrowserWindow } from "electron";

/**
 * Height of the styled title bar band, matching the design spec
 * (https://www.figma.com/design/MAUsalKv7bRRNKlAAigtNd/Community-contributions?node-id=76-12996).
 * The `trafficLightPosition` in `electron-main.ts` vertically centres the native window controls
 * within this band — keep the two in sync.
 */
export const TITLE_BAR_HEIGHT_PX = 32;

/**
 * Build the CSS injected into the renderer to draw the macOS title bar band.
 *
 * `electron-main.ts` uses `titleBarStyle: "hidden"`, which keeps the native window frame, rounded
 * corners and traffic lights but removes the native bar surface. This CSS paints that surface: a
 * full-width strip at the top of the window in the canvas background colour with a hairline
 * separator underneath, and pushes the app content below it. The strip is the window's drag
 * handle.
 *
 * The drag region is built from `-webkit-app-region` rects only: elements keep the default value
 * (`none`) and are ignored unless they explicitly set `drag`/`no-drag`. So the band stays draggable
 * underneath any overlay whose surface is transparent to the calc (a dialog's backdrop, a menu's
 * container), and an overlay panel that a user clicks (dialog panels, context menus, the lightbox
 * chrome) sets `no-drag` so its rect is subtracted and it stays interactive. An element must never
 * be both clickable and a drag handle.
 *
 * Extracted as a pure helper so the string contract can be unit-tested (see macos-titlebar.test.ts).
 */
export function buildTitleBarCss(): string {
    return `
            /* Reserve a band at the top of the window for the title bar */
            body {
                box-sizing: border-box;
                height: 100%;
                padding-top: ${TITLE_BAR_HEIGHT_PX}px !important;
            }

            /* The title bar itself: canvas background with a hairline separator below */
            body::before {
                content: "";
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                height: ${TITLE_BAR_HEIGHT_PX}px;
                box-sizing: border-box;
                /* Fallback colours for pages loaded without the app themes (e.g. the error view) */
                background: var(--cpd-color-bg-canvas-default, #ffffff);
                border-bottom: 1px solid var(--cpd-color-separator-primary, #e1e6ec);
                -webkit-app-region: drag;
                -webkit-user-select: none;
            }

            /* Exclude floating menus and tooltips, which render in body-level portals */
            [data-radix-popper-content-wrapper] {
                -webkit-app-region: no-drag;
            }

            /* Mark the splash screen as a drag handle */
            .mx_MatrixChat_splash {
                -webkit-app-region: drag;
            }
            /* Exclude the splash buttons from being drag handles */
            .mx_MatrixChat_splashButtons {
                -webkit-app-region: no-drag;
            }

            /* Mark the background as a drag handle */
            .mx_AuthPage {
                -webkit-app-region: drag;
            }
            /* Exclude the main content elements from being drag handles */
            .mx_AuthPage .mx_AuthPage_modalContent,
            .mx_AuthPage .mx_AuthPage_modalBlur,
            .mx_AuthPage .mx_AuthFooter > *,
            .mx_AuthPage .mx_Dropdown_menu {
                -webkit-app-region: no-drag;
            }

            /* The image lightbox covers the whole window, including the title bar band; keep its
               sender info clear of the traffic lights, and let its header double as a drag handle */
            .mx_ImageView_info_wrapper {
                margin-top: ${TITLE_BAR_HEIGHT_PX}px;
            }
            .mx_ImageView_panel {
                -webkit-app-region: drag;
            }
            /* Exclude header interactive elements from being drag handles */
            .mx_ImageView_panel > .mx_ImageView_info_wrapper,
            .mx_ImageView_panel > .mx_ImageView_title,
            .mx_ImageView_panel > .mx_ImageView_toolbar > * {
                -webkit-app-region: no-drag;
            }

            /* Exclude context menus and their backgrounds, which may open within the band */
            .mx_ContextualMenu, .mx_ContextualMenu_background {
                -webkit-app-region: no-drag;
            }
            /* Exclude iframes, such as recaptcha */
            iframe {
                -webkit-app-region: no-drag;
            }
        `;
}

export function setupMacosTitleBar(window: BrowserWindow): void {
    if (process.platform !== "darwin") return;

    let cssKey: string | undefined;

    async function applyStyling(): Promise<void> {
        cssKey = await window.webContents.insertCSS(buildTitleBarCss());
    }

    window.on("enter-full-screen", () => {
        if (cssKey !== undefined) {
            void window.webContents.removeInsertedCSS(cssKey);
        }
    });
    window.on("leave-full-screen", () => {
        void applyStyling();
    });
    window.webContents.on("did-finish-load", () => {
        if (!window.isFullScreen()) {
            void applyStyling();
        }
    });
}

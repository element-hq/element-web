/*
Copyright 2023, 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import type { BrowserWindow } from "electron";

/**
 * Build the CSS injected into the renderer to make the (native-title-bar-less) macOS window draggable.
 *
 * Because `electron-main.ts` uses `titleBarStyle: "hidden"` there is no native title bar, so the only way
 * to drag the window is via `-webkit-app-region: drag` strips. The `::before` strips above the room and
 * left-panel headers were previously ~13px tall and too small to reliably grab (#32018); they are raised
 * to match the 32px traffic-light offset used elsewhere in this file. Interactive controls keep
 * `-webkit-app-region: no-drag` so they remain clickable (an element must never be both clickable and a
 * drag handle).
 *
 * Extracted as a pure helper so the string contract can be unit-tested (see macos-titlebar.test.ts).
 */
export function buildTitleBarCss(): string {
    return `
            /* Create margin of space for the traffic light buttons */
            .mx_UserMenu {
                /* We zero the margin and use padding as we want to use it as a drag handle */ 
                margin-top: 0 !important;
                margin-left: 0 !important;
                padding-top: 32px !important;
                -webkit-app-region: drag;
                -webkit-user-select: none;
            }
            /* Exclude the button from being a drag handle and not working */
            .mx_UserMenu > * {
                -webkit-app-region: no-drag;            
            }
            /* Maintain alignment of the toggle space panel button */
            .mx_SpacePanel_toggleCollapse {
                /* 19px original top value, 32px margin-top above, 12px original margin-top value */
                top: calc(19px + 32px - 12px) !important;
            }
            /* Widen the collapsed space panel so its right-hand separator clears the
               traffic light buttons. The buttons are inset 9px (see trafficLightPosition
               in electron-main) and the three-button cluster is ~52px wide, ending ~61px
               from the window edge; against the default 68px rail the separator crowds the
               green button. 76px restores ~15px of clearance, matching the compound 4x
               spacing step. */
            .mx_SpacePanel.collapsed {
                width: 76px !important;
            }
            /* Prevent the media lightbox sender info from clipping into the traffic light buttons */
            .mx_ImageView_info_wrapper {
                margin-top: 32px;
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
        
            /* Mark the home page background as a drag handle */
            .mx_HomePage {
                -webkit-app-region: drag;
            }
            /* Exclude interactive elements from being drag handles */
            .mx_HomePage .mx_HomePage_body,
            .mx_HomePage .mx_HomePage_default_wrapper > * {
                -webkit-app-region: no-drag;
            }
            
            /* Mark the header as a drag handle */
            .mx_ImageView_panel {
                -webkit-app-region: drag;
            }
            /* Exclude header interactive elements from being drag handles */
            .mx_ImageView_panel > .mx_ImageView_info_wrapper,
            .mx_ImageView_panel > .mx_ImageView_title,
            .mx_ImageView_panel > .mx_ImageView_toolbar > * {
                -webkit-app-region: no-drag;
            }
            
            /* Mark the background as a drag handle only if no modal is open */
            .mx_MatrixChat_wrapper[aria-hidden="false"] .mx_RoomView_wrapper,
            .mx_MatrixChat_wrapper[aria-hidden="false"] .mx_HomePage {
                -webkit-app-region: drag;
            }
            /* Exclude content elements from being drag handles */
            .mx_SpaceRoomView_landing > *,
            .mx_RoomPreviewBar,
            .mx_RoomView_body,
            .mx_AutoHideScrollbar,
            .mx_RightPanel_ResizeWrapper,
            .mx_RoomPreviewCard,
            .mx_LeftPanel,
            .mx_RoomView,
            .mx_SpaceRoomView,
            .mx_AccessibleButton,
            .mx_Dialog {
                -webkit-app-region: no-drag;
            }
            /* Exclude context menus and their backgrounds */
            .mx_ContextualMenu, .mx_ContextualMenu_background {
                -webkit-app-region: no-drag;
            }
            /* Exclude iframes, such as recaptcha */
            iframe {
                -webkit-app-region: no-drag;
            }

            /* Add a bar above room header + left panel */
            
            .mx_LeftPanel {
                flex-direction: column;
            }

            .mx_LeftPanel::before {
                content: "";
                /* Aligned with the 32px traffic-light offset so the empty top band is grabbable (#32018) */
                height: 32px;
                border-right: 1px solid var(--cpd-color-bg-subtle-primary);
                -webkit-app-region: drag;
            }

            .mx_RoomView::before,
            .mx_SpaceRoomView::before {
                content: "";
                -webkit-app-region: drag;
            }

            .mx_SpaceRoomView::before {
                display: block;
                /* Enlarged to match the traffic-light offset for a comfortable drag zone (#32018) */
                height: 32px;
            }

            .mx_RoomView::before {
                /* Enlarged from 13px to cover the empty band above the 64px room header (#32018) */
                height: 32px;
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

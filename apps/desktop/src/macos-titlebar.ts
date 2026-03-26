/*
Copyright 2023, 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import type { BrowserWindow } from "electron";

export function setupMacosTitleBar(window: BrowserWindow): void {
    if (process.platform !== "darwin") return;

    let cssKey: string | undefined;

    async function applyStyling(): Promise<void> {
        cssKey = await window.webContents.insertCSS(`
            /* Create margin of space for the traffic light buttons */
            .mx_UserMenu {
                /* We zero the margin and use padding as we want to use it as a drag handle */ 
                margin-top: 0 !important;
                margin-left: 0 !important;
                padding-top: 32px !important;
                padding-left: 20px !important;
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
                height: 20px;
                -webkit-app-region: drag;
            }
            
            .mx_LeftPanel_newRoomList::before {
                /* Aligned with the room header */
                height: 13px;
                border-right: 1px solid var(--cpd-color-bg-subtle-primary);
            }

            .mx_RoomView::before,
            .mx_SpaceRoomView::before {
                content: "";
                -webkit-app-region: drag;
            }
            
            .mx_SpaceRoomView::before {
                display: block;
                height: 24px;            
            }

            .mx_RoomView::before {
                height: 13px;
            }
        `);
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

/*
Copyright 2024 New Vector Ltd.
Copyright 2016 OpenMarket Ltd

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { app, shell, Menu, type MenuItem, type MenuItemConstructorOptions } from "electron";

import { _t } from "./language-helper.js";

const isMac = process.platform === "darwin";

export function buildMenuTemplate(): Menu {
    // Menu template from http://electron.atom.io/docs/api/menu/, edited
    const template: Array<MenuItemConstructorOptions | MenuItem> = [
        {
            label: _t("action|edit"),
            accelerator: "e",
            submenu: [
                {
                    role: "undo",
                    label: _t("action|undo"),
                },
                {
                    role: "redo",
                    label: _t("action|redo"),
                },
                { type: "separator" },
                {
                    role: "cut",
                    label: _t("action|cut"),
                },
                {
                    role: "copy",
                    label: _t("action|copy"),
                },
                {
                    role: "paste",
                    label: _t("action|paste"),
                },
                {
                    role: "pasteAndMatchStyle",
                    label: _t("action|paste_match_style"),
                },
                {
                    role: "delete",
                    label: _t("action|delete"),
                },
                {
                    role: "selectAll",
                    label: _t("action|select_all"),
                },
            ],
        },
        {
            label: _t("view_menu|view"),
            accelerator: "V",
            submenu: [
                { type: "separator" },
                {
                    role: "resetZoom",
                    accelerator: "CmdOrCtrl+Num0",
                    visible: false,
                },
                {
                    role: "zoomIn",
                    accelerator: "CmdOrCtrl+NumAdd",
                    visible: false,
                },
                {
                    role: "zoomOut",
                    accelerator: "CmdOrCtrl+NumSub",
                    visible: false,
                },
                {
                    role: "resetZoom",
                    label: _t("view_menu|actual_size"),
                },
                {
                    role: "zoomIn",
                    label: _t("action|zoom_in"),
                },
                {
                    role: "zoomOut",
                    label: _t("action|zoom_out"),
                },
                { type: "separator" },
                // in macOS the Preferences menu item goes in the first menu
                ...(!isMac
                    ? [
                          {
                              label: _t("common|preferences"),
                              click(): void {
                                  global.mainWindow?.webContents.send("preferences");
                              },
                          },
                      ]
                    : []),
                {
                    role: "togglefullscreen",
                    label: _t("view_menu|toggle_full_screen"),
                },
                {
                    role: "toggleDevTools",
                    label: _t("view_menu|toggle_developer_tools"),
                },
            ],
        },
        {
            label: _t("window_menu|label"),
            accelerator: "w",
            role: "window",
            submenu: [
                {
                    role: "minimize",
                    label: _t("action|minimise"),
                },
                {
                    role: "close",
                    label: _t("action|close"),
                },
            ],
        },
        {
            label: _t("common|help"),
            accelerator: "h",
            role: "help",
            submenu: [
                {
                    // XXX: vectorConfig won't have defaults applied to it so we need to duplicate them here
                    label: _t("common|brand_help", { brand: global.vectorConfig?.brand || "Element" }),
                    click(): void {
                        void shell.openExternal(global.vectorConfig?.help_url || "https://element.io/help");
                    },
                },
            ],
        },
    ];

    // macOS has specific menu conventions...
    if (isMac) {
        template.unshift({
            // first macOS menu is the name of the app
            role: "appMenu",
            label: app.name,
            submenu: [
                {
                    role: "about",
                    label: _t("common|about") + " " + app.name,
                },
                { type: "separator" },
                {
                    label: _t("common|preferences") + "…",
                    accelerator: "Command+,", // Mac-only accelerator
                    click(): void {
                        global.mainWindow?.webContents.send("preferences");
                    },
                },
                { type: "separator" },
                {
                    role: "services",
                    label: _t("menu|services"),
                    submenu: [],
                },
                { type: "separator" },
                {
                    role: "hide",
                    label: _t("menu|hide"),
                },
                {
                    role: "hideOthers",
                    label: _t("menu|hide_others"),
                },
                {
                    role: "unhide",
                    label: _t("menu|unhide"),
                },
                { type: "separator" },
                {
                    role: "quit",
                    label: _t("action|quit"),
                },
            ],
        });
        // Edit menu.
        // This has a 'speech' section on macOS
        (template[1].submenu as MenuItemConstructorOptions[]).push(
            { type: "separator" },
            {
                label: _t("edit_menu|speech"),
                submenu: [
                    {
                        role: "startSpeaking",
                        label: _t("edit_menu|speech_start_speaking"),
                    },
                    {
                        role: "stopSpeaking",
                        label: _t("edit_menu|speech_stop_speaking"),
                    },
                ],
            },
        );

        // Window menu.
        // This also has specific functionality on macOS
        template[3].submenu = [
            {
                label: _t("action|close"),
                accelerator: "CmdOrCtrl+W",
                role: "close",
            },
            {
                label: _t("action|minimise"),
                accelerator: "CmdOrCtrl+M",
                role: "minimize",
            },
            {
                label: _t("window_menu|zoom"),
                role: "zoom",
            },
            {
                type: "separator",
            },
            {
                label: _t("window_menu|bring_all_to_front"),
                role: "front",
            },
        ];
    } else {
        template.unshift({
            label: _t("file_menu|label"),
            accelerator: "f",
            submenu: [
                // For some reason, 'about' does not seem to work on windows.
                /*{
                    role: 'about',
                    label: _t('About'),
                },*/
                {
                    role: "quit",
                    label: _t("action|quit"),
                },
            ],
        });
    }

    return Menu.buildFromTemplate(template);
}

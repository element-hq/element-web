/*
Copyright 2021-2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {
    clipboard,
    nativeImage,
    Menu,
    MenuItem,
    shell,
    dialog,
    ipcMain,
    type NativeImage,
    type WebContents,
    type ContextMenuParams,
    type DownloadItem,
    type MenuItemConstructorOptions,
    type IpcMainEvent,
    type Event,
} from "electron";
import url from "node:url";
import fs from "node:fs";
import { pipeline } from "node:stream/promises";
import path from "node:path";

import { _t } from "./language-helper.js";

const MAILTO_PREFIX = "mailto:";

const PERMITTED_URL_SCHEMES: string[] = ["http:", "https:", MAILTO_PREFIX];

function safeOpenURL(target: string): void {
    // openExternal passes the target to open/start/xdg-open,
    // so put fairly stringent limits on what can be opened
    // (for instance, open /bin/sh does indeed open a terminal
    // with a shell, albeit with no arguments)
    const parsedUrl = url.parse(target);
    if (PERMITTED_URL_SCHEMES.includes(parsedUrl.protocol!)) {
        // explicitly use the URL re-assembled by the url library,
        // so we know the url parser has understood all the parts
        // of the input string
        const newTarget = url.format(parsedUrl);
        void shell.openExternal(newTarget);
    }
}

function onWindowOrNavigate(ev: Event, target: string): void {
    // always prevent the default: if something goes wrong,
    // we don't want to end up opening it in the electron
    // app, as we could end up opening any sort of random
    // url in a window that has node scripting access.
    ev.preventDefault();
    safeOpenURL(target);
}

function writeNativeImage(filePath: string, img: NativeImage): Promise<void> {
    switch (filePath.split(".").pop()?.toLowerCase()) {
        case "jpg":
        case "jpeg":
            return fs.promises.writeFile(filePath, img.toJPEG(100));
        case "bmp":
            return fs.promises.writeFile(filePath, img.toBitmap());
        case "png":
        default:
            return fs.promises.writeFile(filePath, img.toPNG());
    }
}

function onLinkContextMenu(ev: Event, params: ContextMenuParams, webContents: WebContents): void {
    let url = params.linkURL || params.srcURL;

    if (url.startsWith("vector://vector/webapp")) {
        // Avoid showing a context menu for app icons
        if (params.hasImageContents) return;
        const baseUrl = vectorConfig.web_base_url ?? "https://app.element.io/";
        // Rewrite URL so that it can be used outside the app
        url = baseUrl + url.substring(23);
    }

    const popupMenu = new Menu();
    // No point trying to open blob: URLs in an external browser: it ain't gonna work.
    if (!url.startsWith("blob:")) {
        popupMenu.append(
            new MenuItem({
                label: url,
                click(): void {
                    safeOpenURL(url);
                },
            }),
        );
    }

    if (params.hasImageContents) {
        popupMenu.append(
            new MenuItem({
                label: _t("right_click_menu|copy_image"),
                accelerator: "c",
                click(): void {
                    webContents.copyImageAt(params.x, params.y);
                },
            }),
        );
    }

    // No point offering to copy a blob: URL either
    if (!url.startsWith("blob:")) {
        // Special-case e-mail URLs to strip the `mailto:` like modern browsers do
        if (url.startsWith(MAILTO_PREFIX)) {
            popupMenu.append(
                new MenuItem({
                    label: _t("right_click_menu|copy_email"),
                    accelerator: "a",
                    click(): void {
                        clipboard.writeText(url.substr(MAILTO_PREFIX.length));
                    },
                }),
            );
        } else {
            popupMenu.append(
                new MenuItem({
                    label: params.hasImageContents
                        ? _t("right_click_menu|copy_image_url")
                        : _t("right_click_menu|copy_link_url"),
                    accelerator: "a",
                    click(): void {
                        clipboard.writeText(url);
                    },
                }),
            );
        }
    }

    // XXX: We cannot easily save a blob from the main process as
    // only the renderer can resolve them so don't give the user an option to.
    if (params.hasImageContents && !url.startsWith("blob:")) {
        popupMenu.append(
            new MenuItem({
                label: _t("right_click_menu|save_image_as"),
                accelerator: "s",
                async click(): Promise<void> {
                    const targetFileName = params.suggestedFilename || params.altText || "image.png";
                    const { filePath } = await dialog.showSaveDialog({
                        defaultPath: targetFileName,
                    });

                    if (!filePath) return; // user cancelled dialog

                    try {
                        if (url.startsWith("data:")) {
                            await writeNativeImage(filePath, nativeImage.createFromDataURL(url));
                        } else {
                            const resp = await fetch(url);
                            if (!resp.ok) throw new Error(`unexpected response ${resp.statusText}`);
                            if (!resp.body) throw new Error(`unexpected response has no body ${resp.statusText}`);
                            await pipeline(resp.body, fs.createWriteStream(filePath));
                        }
                    } catch (err) {
                        console.error(err);
                        void dialog.showMessageBox({
                            type: "error",
                            title: _t("right_click_menu|save_image_as_error_title"),
                            message: _t("right_click_menu|save_image_as_error_description"),
                        });
                    }
                },
            }),
        );
    }

    // popup() requires an options object even for no options
    popupMenu.popup({});
    ev.preventDefault();
}

function cutCopyPasteSelectContextMenus(
    params: ContextMenuParams,
    webContents: WebContents,
): MenuItemConstructorOptions[] {
    const options: MenuItemConstructorOptions[] = [];

    if (params.misspelledWord) {
        params.dictionarySuggestions.forEach((word) => {
            options.push({
                label: word,
                click: () => {
                    webContents.replaceMisspelling(word);
                },
            });
        });
        options.push(
            {
                type: "separator",
            },
            {
                label: _t("right_click_menu|add_to_dictionary"),
                click: () => {
                    webContents.session.addWordToSpellCheckerDictionary(params.misspelledWord);
                },
            },
            {
                type: "separator",
            },
        );
    }

    options.push(
        {
            role: "cut",
            label: _t("action|cut"),
            accelerator: "t",
            enabled: params.editFlags.canCut,
        },
        {
            role: "copy",
            label: _t("action|copy"),
            accelerator: "c",
            enabled: params.editFlags.canCopy,
        },
        {
            role: "paste",
            label: _t("action|paste"),
            accelerator: "p",
            enabled: params.editFlags.canPaste,
        },
        {
            role: "pasteAndMatchStyle",
            enabled: params.editFlags.canPaste,
        },
        {
            role: "selectAll",
            label: _t("action|select_all"),
            accelerator: "a",
            enabled: params.editFlags.canSelectAll,
        },
    );
    return options;
}

function onSelectedContextMenu(ev: Event, params: ContextMenuParams, webContents: WebContents): void {
    const items = cutCopyPasteSelectContextMenus(params, webContents);
    const popupMenu = Menu.buildFromTemplate(items);

    // popup() requires an options object even for no options
    popupMenu.popup({});
    ev.preventDefault();
}

function onEditableContextMenu(ev: Event, params: ContextMenuParams, webContents: WebContents): void {
    const items: MenuItemConstructorOptions[] = [
        { role: "undo" },
        { role: "redo", enabled: params.editFlags.canRedo },
        { type: "separator" },
        ...cutCopyPasteSelectContextMenus(params, webContents),
    ];

    const popupMenu = Menu.buildFromTemplate(items);

    // popup() requires an options object even for no options
    popupMenu.popup({});
    ev.preventDefault();
}

let userDownloadIndex = 0;
const userDownloadMap = new Map<number, string>(); // Map from id to path
ipcMain.on("userDownloadAction", function (ev: IpcMainEvent, { id, open = false }) {
    const path = userDownloadMap.get(id);
    if (open && path) {
        void shell.openPath(path);
    }
    userDownloadMap.delete(id);
});

export default (webContents: WebContents): void => {
    webContents.setWindowOpenHandler((details) => {
        safeOpenURL(details.url);
        return { action: "deny" };
    });

    webContents.on("will-navigate", (ev: Event, target: string): void => {
        if (target.startsWith("vector://")) return;
        return onWindowOrNavigate(ev, target);
    });

    webContents.on("context-menu", function (ev: Event, params: ContextMenuParams): void {
        if (params.linkURL || params.srcURL) {
            onLinkContextMenu(ev, params, webContents);
        } else if (params.selectionText) {
            onSelectedContextMenu(ev, params, webContents);
        } else if (params.isEditable) {
            onEditableContextMenu(ev, params, webContents);
        }
    });

    webContents.session.on("will-download", (event: Event, item: DownloadItem): void => {
        item.once("done", (event, state) => {
            if (state === "completed") {
                const savePath = item.getSavePath();
                const id = userDownloadIndex++;
                userDownloadMap.set(id, savePath);
                webContents.send("userDownloadCompleted", {
                    id,
                    name: path.basename(savePath),
                });
            }
        });
    });
};

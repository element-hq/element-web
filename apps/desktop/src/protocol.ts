/*
Copyright 2024 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { app, ipcMain } from "electron";
import { URL } from "node:url";
import path from "node:path";
import fs from "node:fs";
import { randomUUID } from "node:crypto";

const LEGACY_PROTOCOL = "element";
const SEARCH_PARAM = "element-desktop-ssoid";
const STORE_FILE_NAME = "sso-sessions.json";

// we getPath userData before electron-main changes it, so this is the default value
const storePath = path.join(app.getPath("userData"), STORE_FILE_NAME);

export default class ProtocolHandler {
    private readonly store: Record<string, string> = {};
    private readonly sessionId: string;

    public constructor(private readonly protocol: string) {
        // get all args except `hidden` as it'd mean the app would not get focused
        // XXX: passing args to protocol handlers only works on Windows, so unpackaged deep-linking
        // --profile/--profile-dir are passed via the SEARCH_PARAM var in the callback url
        const args = process.argv.slice(1).filter((arg) => arg !== "--hidden" && arg !== "-hidden");
        if (app.isPackaged) {
            app.setAsDefaultProtocolClient(this.protocol, process.execPath, args);
            app.setAsDefaultProtocolClient(LEGACY_PROTOCOL, process.execPath, args);
        } else if (process.platform === "win32") {
            // on Mac/Linux this would just cause the electron binary to open
            // special handler for running without being packaged, e.g `electron .` by passing our app path to electron
            app.setAsDefaultProtocolClient(this.protocol, process.execPath, [app.getAppPath(), ...args]);
            app.setAsDefaultProtocolClient(LEGACY_PROTOCOL, process.execPath, [app.getAppPath(), ...args]);
        }

        if (process.platform === "darwin") {
            // Protocol handler for macos
            app.on("open-url", (ev, url) => {
                ev.preventDefault();
                this.processUrl(url);
            });
        } else {
            // Protocol handler for win32/Linux
            app.on("second-instance", (ev, commandLine) => {
                const url = commandLine[commandLine.length - 1];
                if (!url.startsWith(`${this.protocol}:/`) && !url.startsWith(`${LEGACY_PROTOCOL}://`)) return;
                this.processUrl(url);
            });
        }

        this.store = this.readStore();
        this.sessionId = randomUUID();

        ipcMain.handle("getProtocol", this.onGetProtocol);
    }

    private readonly onGetProtocol = (): { protocol: string; sessionId: string } => {
        return {
            protocol: this.protocol,
            sessionId: this.sessionId,
        };
    };

    private processUrl(url: string): void {
        if (!global.mainWindow) return;

        const parsed = new URL(url);
        // sanity check: we only register for the one protocol, so we shouldn't
        // be getting anything else unless the user is forcing a URL to open
        // with the Element app.
        if (parsed.protocol !== `${this.protocol}:` && parsed.protocol !== `${LEGACY_PROTOCOL}:`) {
            console.log("Ignoring unexpected protocol: ", parsed.protocol);
            return;
        }

        const urlToLoad = new URL("vector://vector/webapp/");
        // ignore anything other than the search (used for SSO login redirect)
        // and the hash (for general element deep links)
        // There's no reason to allow anything else, particularly other paths,
        // since this would allow things like the internal jitsi wrapper to
        // be loaded, which would get the app stuck on that page and generally
        // be a bit strange and confusing.
        urlToLoad.search = parsed.search;
        urlToLoad.hash = parsed.hash;

        console.log("Opening URL: ", urlToLoad.href);
        void global.mainWindow.loadURL(urlToLoad.href);
    }

    private readStore(): Record<string, string> {
        try {
            const s = fs.readFileSync(storePath, { encoding: "utf8" });
            const o = JSON.parse(s);
            return typeof o === "object" ? o : {};
        } catch {
            return {};
        }
    }

    private writeStore(): void {
        fs.writeFileSync(storePath, JSON.stringify(this.store));
    }

    public initialise(userDataPath: string): void {
        for (const key in this.store) {
            // ensure each instance only has one (the latest) session ID to prevent the file growing unbounded
            if (this.store[key] === userDataPath) {
                delete this.store[key];
                break;
            }
        }
        this.store[this.sessionId] = userDataPath;
        this.writeStore();
    }

    public getProfileFromDeeplink(args: string[]): string | undefined {
        // check if we are passed a profile in the SSO callback url
        const deeplinkUrl = args.find(
            (arg) => arg.startsWith(`${this.protocol}:/`) || arg.startsWith(`${LEGACY_PROTOCOL}://`),
        );
        if (deeplinkUrl?.includes(SEARCH_PARAM)) {
            const parsedUrl = new URL(deeplinkUrl);
            if (parsedUrl.protocol === `${this.protocol}:` || parsedUrl.protocol === `${LEGACY_PROTOCOL}:`) {
                const store = this.readStore();
                let sessionId = parsedUrl.searchParams.get(SEARCH_PARAM);
                if (!sessionId) {
                    // In OIDC, we must shuttle the value in the `state` param rather than `element-desktop-ssoid`
                    // We encode it as a suffix like `:element-desktop-ssoid:XXYYZZ`
                    sessionId = parsedUrl.searchParams.get("state")!.split(`:${SEARCH_PARAM}:`)[1];
                }
                console.log("Forwarding to profile: ", store[sessionId]);
                return store[sessionId];
            }
        }
    }
}

/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type BrowserWindow, ipcMain, session } from "electron";

/**
 * Check for feature support from the server.
 * This requires asking the renderer process for supported versions.
 */
async function getSupportedVersions(window: BrowserWindow): Promise<string[]> {
    return new Promise((resolve) => {
        ipcMain.once("serverSupportedVersions", (_, versionsResponse) => {
            resolve(versionsResponse?.versions || []);
        });
        window.webContents.send("serverSupportedVersions"); // ping now that the listener exists
    });
}

/**
 * Get the access token for the user.
 * This requires asking the renderer process for the access token.
 */
async function getAccessToken(window: BrowserWindow): Promise<string | undefined> {
    return new Promise((resolve) => {
        ipcMain.once("userAccessToken", (_, accessToken) => {
            resolve(accessToken);
        });
        window.webContents.send("userAccessToken"); // ping now that the listener exists
    });
}

/**
 * Get the homeserver url
 * This requires asking the renderer process for the homeserver url.
 */
async function getHomeserverUrl(window: BrowserWindow): Promise<string> {
    return new Promise((resolve) => {
        ipcMain.once("homeserverUrl", (_, homeserver) => {
            resolve(homeserver);
        });
        window.webContents.send("homeserverUrl"); // ping now that the listener exists
    });
}

export function setupMediaAuth(window: BrowserWindow): void {
    session.defaultSession.webRequest.onBeforeRequest(async (req, callback) => {
        // This handler emulates the element-web service worker, where URLs are rewritten late in the request
        // for backwards compatibility. As authenticated media becomes more prevalent, this should be replaced
        // by the app using authenticated URLs from the outset.
        try {
            const url = new URL(req.url);
            if (
                !url.pathname.startsWith("/_matrix/media/v3/download") &&
                !url.pathname.startsWith("/_matrix/media/v3/thumbnail")
            ) {
                return callback({}); // not a URL we care about
            }

            const supportedVersions = await getSupportedVersions(window);
            // We have to check that the access token is truthy otherwise we'd be intercepting pre-login media request too,
            // e.g. those required for SSO button icons.
            const accessToken = await getAccessToken(window);
            if (supportedVersions.includes("v1.11") && accessToken) {
                url.href = url.href.replace(/\/media\/v3\/(.*)\//, "/client/v1/media/$1/");
                return callback({ redirectURL: url.toString() });
            } else {
                return callback({}); // no support == no modification
            }
        } catch (e) {
            console.error(e);
        }
    });

    session.defaultSession.webRequest.onBeforeSendHeaders(async (req, callback) => {
        try {
            const url = new URL(req.url);
            if (!url.pathname.startsWith("/_matrix/client/v1/media")) {
                return callback({}); // invoke unmodified
            }

            // Is this request actually going to the homeserver?
            // We don't combine this check with the one above on purpose.
            // We're fetching the homeserver url through IPC and should do so
            // as sparingly as possible.
            const homeserver = await getHomeserverUrl(window);
            const isRequestToHomeServer = homeserver && url.origin === new URL(homeserver).origin;
            if (!isRequestToHomeServer) {
                return callback({}); // invoke unmodified
            }

            // Only add authorization header to authenticated media URLs. This emulates the service worker
            // behaviour in element-web.
            const accessToken = await getAccessToken(window);
            // `accessToken` can be falsy, but if we're trying to download media without authentication
            // then we should expect failure anyway.
            const headers = { ...req.requestHeaders, Authorization: `Bearer ${accessToken}` };
            return callback({ requestHeaders: headers });
        } catch (e) {
            console.error(e);
        }
    });
}

/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// Parse the given window.location and return parameters that can be used when calling
// MatrixChat.showScreen(screen, params)
import { logger } from "matrix-js-sdk/src/logger";
import { type QueryDict } from "matrix-js-sdk/src/utils";

import { parseQsFromFragment, searchParamsToQueryDict } from "./url_utils";

// The hashes we have set whose hashchange events have not fired yet, oldest first, encoded as the browser does.
let pendingLocationHashes: string[] = [];

export interface IScreen {
    screen: string;
    params: QueryDict;
}

export function getScreenFromLocation(location: Location | URL): IScreen {
    const fragparts = parseQsFromFragment(location);
    return {
        screen: fragparts.location.substring(1),
        params: fragparts.params ? searchParamsToQueryDict(fragparts.params) : {},
    };
}

// Here, we do some crude URL analysis to allow
// deep-linking.
function routeUrl(location: Location | URL): void {
    if (!window.matrixChat) return;

    logger.log("Routing URL ", location.href);
    const s = getScreenFromLocation(location);
    window.matrixChat.showScreen(s.screen, s.params);
}

/**
 * Encode the given hash the same way the browser does when navigating to it, so it can be compared with
 * `location.hash`.
 */
function encodeHash(hash: string): string {
    return new URL(hash, "https://localhost/").hash;
}

function onHashChange(ev: HashChangeEvent): void {
    // Use the URL this event is for rather than the current location: the hash may have changed again
    // before the event fires, e.g. if we set it in onNewScreen, and we would then miss this navigation.
    const location = ev.newURL ? new URL(ev.newURL) : window.location;

    const pendingIndex = pendingLocationHashes.indexOf(location.hash);
    if (pendingIndex >= 0) {
        // we set this ourselves: no need to route it! Events fire in order, so drop any older hashes too.
        pendingLocationHashes = pendingLocationHashes.slice(pendingIndex + 1);
        return;
    }
    routeUrl(location);
}

// This will be called whenever the SDK changes screens,
// so a web page can update the URL bar appropriately.
export function onNewScreen(screen: string, replaceLast = false): void {
    logger.log("newscreen " + screen);
    const hash = "#/" + screen;
    const encodedHash = encodeHash(hash);
    const currentHash = window.location.hash;

    // if the new hash is the old one without its query, we are stripping fields e.g `via` so replace history
    if (screen.startsWith("room/") && currentHash.startsWith(encodedHash + "?")) {
        replaceLast = true;
    }

    // The browser only fires hashchange if the hash actually changes
    if (currentHash !== encodedHash) {
        pendingLocationHashes.push(encodedHash);
    }

    if (replaceLast) {
        window.location.replace(hash);
    } else {
        window.location.assign(hash);
    }
}

export function init(): void {
    window.addEventListener("hashchange", onHashChange);
}

const ScreenAfterLoginStorageKey = "mx_screen_after_login";
function getStoredInitialScreenAfterLogin(): ReturnType<typeof getScreenFromLocation> | undefined {
    const screenAfterLogin = sessionStorage.getItem(ScreenAfterLoginStorageKey);

    return screenAfterLogin ? JSON.parse(screenAfterLogin) : undefined;
}

function setInitialScreenAfterLogin(screenAfterLogin?: ReturnType<typeof getScreenFromLocation>): void {
    if (screenAfterLogin?.screen) {
        sessionStorage.setItem(ScreenAfterLoginStorageKey, JSON.stringify(screenAfterLogin));
    }
}

/**
 * Get the initial screen to be displayed after login,
 * for example when trying to view a room via a link before logging in
 *
 * If the current URL has a screen set that in session storage
 * Then retrieve the screen from session storage and return it
 * Using session storage allows us to remember login fragments from when returning from OIDC login
 * @returns screen and params or undefined
 */
export function getInitialScreenAfterLogin(location: Location): ReturnType<typeof getScreenFromLocation> | undefined {
    const screenAfterLogin = getScreenFromLocation(location);

    if (screenAfterLogin.screen || screenAfterLogin.params) {
        setInitialScreenAfterLogin(screenAfterLogin);
    }

    const storedScreenAfterLogin = getStoredInitialScreenAfterLogin();
    return storedScreenAfterLogin;
}

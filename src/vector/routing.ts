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

import { parseQsFromFragment } from "./url_utils";

let lastLocationHashSet: string | null = null;

export function getScreenFromLocation(location: Location): { screen: string; params: QueryDict } {
    const fragparts = parseQsFromFragment(location);
    return {
        screen: fragparts.location.substring(1),
        params: fragparts.params,
    };
}

// Here, we do some crude URL analysis to allow
// deep-linking.
function routeUrl(location: Location): void {
    if (!window.matrixChat) return;

    logger.log("Routing URL ", location.href);
    const s = getScreenFromLocation(location);
    window.matrixChat.showScreen(s.screen, s.params);
}

function onHashChange(): void {
    if (decodeURIComponent(window.location.hash) === lastLocationHashSet) {
        // we just set this: no need to route it!
        return;
    }
    routeUrl(window.location);
}

// This will be called whenever the SDK changes screens,
// so a web page can update the URL bar appropriately.
export function onNewScreen(screen: string, replaceLast = false): void {
    logger.log("newscreen " + screen);
    const hash = "#/" + screen;
    lastLocationHashSet = hash;

    // if the new hash is a substring of the old one then we are stripping fields e.g `via` so replace history
    if (
        screen.startsWith("room/") &&
        window.location.hash.includes("/$") === hash.includes("/$") && // only if both did or didn't contain event link
        window.location.hash.startsWith(hash)
    ) {
        replaceLast = true;
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

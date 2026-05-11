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

// Tracks how many app-internal history entries have been pushed.
// Used to prevent the back button from navigating outside the app.
let internalHistoryDepth = 0;

type NavigationListener = () => void;
const navigationListeners = new Set<NavigationListener>();

function notifyNavigationListeners(): void {
    navigationListeners.forEach((fn) => fn());
}

/**
 * Subscribe to changes in the internal navigation state (back/forward).
 * Returns an unsubscribe function.
 */
export function onNavigationChange(fn: NavigationListener): () => void {
    navigationListeners.add(fn);
    return () => navigationListeners.delete(fn);
}

/**
 * Returns true if there is at least one app-internal history entry to go back to,
 * i.e. going back will stay within the app rather than leaving to a previous site.
 */
export function canNavigateBack(): boolean {
    return internalHistoryDepth > 0;
}

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
        history.replaceState({ internalDepth: internalHistoryDepth }, "", hash);
    } else {
        internalHistoryDepth++;
        history.pushState({ internalDepth: internalHistoryDepth }, "", hash);
    }
    notifyNavigationListeners();
}

export function init(): void {
    // Restore depth from the current history state in case the user navigated
    // forward back into the app (e.g. via browser forward button).
    internalHistoryDepth = window.history.state?.internalDepth ?? 0;

    window.addEventListener("hashchange", onHashChange);

    // Keep internalHistoryDepth in sync when the user traverses history.
    window.addEventListener("popstate", (e: PopStateEvent) => {
        internalHistoryDepth = (e.state as { internalDepth?: number } | null)?.internalDepth ?? 0;
        notifyNavigationListeners();
    });
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

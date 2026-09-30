/*
Copyright 2026 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { logger } from "matrix-js-sdk/src/logger";

import { parseAppUrl } from "./url_utils";

/** How long to wait for the worker to adopt us before falling back to a reload. */
const CLAIM_TIMEOUT_MS = 2000;

/** Marks that this tab has already reloaded itself trying to regain control. */
const RELOAD_FLAG = "mx_sw_control_reload";

/**
 * Ensure a service worker is controlling this page.
 *
 * Authenticated media depends entirely on the worker. `Media.srcHttp` and friends
 * deliberately yield unauthenticated legacy URLs, and the worker rewrites them and
 * attaches the access token. Requests the application makes itself can authenticate
 * without it — see `Media.downloadSource` — but a URL handed to the DOM, an
 * `<img src>`, a `<video src>`, a CSS background, cannot carry a header. On an
 * uncontrolled page every avatar and thumbnail therefore 404s against a homeserver
 * with authenticated media enabled.
 *
 * A page ends up uncontrolled for reasons the user can neither see nor influence, the
 * most common being a hard reload, which bypasses the worker by design and leaves the
 * page uncontrolled for its whole lifetime. So:
 *
 * 1. Ask the active worker to adopt us. `clients.claim()` normally runs only when a
 *    worker activates, and by now this one activated long ago, but it is not restricted
 *    to `activate` — so the page can ask. This costs one postMessage and no reload.
 * 2. If that does not take effect, reload once. A normal navigation is controlled by the
 *    active worker, which is exactly why "just reload the page" is the workaround users
 *    cannot be expected to discover. The reload happens at most once per tab, and is
 *    skipped when the URL carries a credential a reload would re-submit.
 *
 * @param registration The registration returned by `navigator.serviceWorker.register`.
 */
export async function ensureServiceWorkerControl(registration: ServiceWorkerRegistration): Promise<void> {
    const container = globalThis.navigator?.serviceWorker;
    if (!container) return; // no service worker support at all

    if (container.controller) {
        // Controlled, so forget any earlier reload: a later hard reload in this same tab
        // is a fresh problem and deserves a fresh attempt.
        setReloadFlag(false);
        return;
    }

    // Nothing to ask, and a reload would find nothing either - the worker is still
    // installing, and its own activate will claim this page when it lands.
    if (!registration.active) return;

    if (await claim(container, registration.active)) return;

    if (getReloadFlag()) {
        logger.warn("Service worker still does not control this page after a reload; authenticated media may fail");
        return;
    }

    if (hasCredentialsInUrl()) {
        logger.warn("Service worker does not control this page, but reloading would re-submit the URL; not reloading");
        return;
    }

    logger.info("Service worker did not adopt this page; reloading once to regain control");
    setReloadFlag(true);
    window.location.reload();
}

/**
 * Ask the active worker to adopt this page.
 *
 * @returns Whether control was obtained within {@link CLAIM_TIMEOUT_MS}.
 */
function claim(container: ServiceWorkerContainer, worker: ServiceWorker): Promise<boolean> {
    return new Promise((resolve) => {
        // Hoisted, so the timeout and the listener can both reach it while it reaches
        // the two consts below: nothing calls it until both of those are initialised.
        function finish(controlled: boolean): void {
            clearTimeout(timeoutId);
            container.removeEventListener("controllerchange", onControllerChange);
            resolve(controlled);
        }

        const onControllerChange = (): void => finish(!!container.controller);
        const timeoutId = setTimeout(() => finish(false), CLAIM_TIMEOUT_MS);

        container.addEventListener("controllerchange", onControllerChange);
        worker.postMessage({ type: "claimClients" });
    });
}

/**
 * Whether the URL carries a login token, an authorization code or an invite secret — the
 * things a reload would re-submit, and which may not survive being used twice. Reuses the
 * app's own view of those parameters rather than keeping a second list of them.
 */
function hasCredentialsInUrl(): boolean {
    const { params } = parseAppUrl(window.location);
    return !!(params.legacy_sso ?? params.oauth2 ?? params.threepid ?? params.guest);
}

/** sessionStorage is unavailable in some privacy modes, where not reloading is the safe answer. */
function getReloadFlag(): boolean {
    try {
        return window.sessionStorage.getItem(RELOAD_FLAG) !== null;
    } catch {
        return true;
    }
}

function setReloadFlag(value: boolean): void {
    try {
        if (value) window.sessionStorage.setItem(RELOAD_FLAG, "1");
        else window.sessionStorage.removeItem(RELOAD_FLAG);
    } catch {
        // Nothing to do: getReloadFlag treats an unreadable store as "already tried".
    }
}

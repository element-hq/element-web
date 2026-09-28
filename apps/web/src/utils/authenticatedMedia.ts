/*
Copyright 2026 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type MatrixClient } from "matrix-js-sdk/src/matrix";

/** The spec version that introduced authenticated media (MSC3916). */
const AUTHENTICATED_MEDIA_VERSION = "v1.11";

/**
 * Rewrite an unauthenticated media URL to its authenticated equivalent.
 *
 * These are the two endpoints the service worker intercepts, and this is the rewrite it
 * performs on them. It lives here so the worker and the application cannot drift apart on
 * where authenticated media is served from.
 *
 * @param url An absolute media URL.
 * @returns The authenticated URL, or `url` unchanged if it is not one of the two
 *     unauthenticated media endpoints.
 */
export function toAuthenticatedMediaUrl(url: string): string {
    const parsed = new URL(url);
    parsed.pathname = parsed.pathname.replace(
        /^\/_matrix\/media\/v3\/(download|thumbnail)\//,
        "/_matrix/client/v1/media/$1/",
    );
    return parsed.href;
}

/**
 * `fetch` a media URL, doing for ourselves what the service worker does while it is in
 * control of the page.
 *
 * The `Media` getters deliberately yield unauthenticated URLs, because the service worker
 * rewrites them to the authenticated endpoints and attaches the access token. When no
 * worker controls the page nothing does that rewriting, the request goes out
 * unauthenticated, and a homeserver with authenticated media enabled answers 404 — with
 * no indication that the worker is the missing piece.
 *
 * A page can be uncontrolled for reasons a user can neither see nor influence: a hard
 * reload bypasses the worker by design, registration may have failed, and the worker can
 * be unregistered by a browser setting or an extension. `ensureServiceWorkerControl` tries
 * to win control back, which is the only thing that helps a URL handed to the DOM, since
 * an `<img src>` cannot carry a header. A `fetch` we make ourselves need not wait for it.
 *
 * @param url The unauthenticated media URL, as produced by the `Media` getters.
 * @param client The client whose access token and homeserver support to use.
 * @param init Passed through to `fetch`, with an Authorization header added when needed.
 * @returns The server's response, whatever its status.
 */
export async function fetchAuthenticatedMedia(
    url: string,
    client: MatrixClient,
    init?: RequestInit,
): Promise<Response> {
    // While a worker is in control it rewrites and authenticates this for us, so leave the
    // request exactly as it is today, including the caching the worker does for it.
    if (globalThis.navigator?.serviceWorker?.controller) return fetch(url, init);

    const accessToken = client.getAccessToken();
    if (!accessToken) return fetch(url, init);

    // The worker only rewrites when the homeserver actually supports authenticated media,
    // and so must we: against a server still serving the legacy endpoints, asking for the
    // authenticated one would turn a working download into a 404.
    if (!(await client.isVersionSupported(AUTHENTICATED_MEDIA_VERSION))) return fetch(url, init);

    const headers = new Headers(init?.headers);
    headers.set("Authorization", `Bearer ${accessToken}`);
    return fetch(toAuthenticatedMediaUrl(url), { ...init, headers });
}

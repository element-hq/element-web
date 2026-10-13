/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

/** URL schemes accepted by Matrix-compatible formatted HTML. */
const PERMITTED_URL_SCHEMES = [
    "file",
    "mailto",
    "http",
    "https",
    "ftp",
    "ftps",
    "bitcoin",
    "geo",
    "im",
    "magnet",
    "matrix",
    "news",
    "openpgp4fpr",
    "sip",
    "sms",
    "smsto",
    "tel",
    "urn",
    "xmpp",
] as const;

/**
 * Tests whether a URL from an untrusted source has a permitted scheme.
 * Invalid and relative URLs are rejected.
 */
export function isUrlPermitted(inputUrl: string): boolean {
    if (typeof inputUrl !== "string") return false;

    try {
        const protocol = new URL(inputUrl).protocol.slice(0, -1);
        return (PERMITTED_URL_SCHEMES as readonly string[]).includes(protocol);
    } catch {
        return false;
    }
}

export { PERMITTED_URL_SCHEMES };

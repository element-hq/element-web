/*
Copyright 2024 New Vector Ltd.
Copyright 2019-2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

/**
 * If a url has no path component, etc. abbreviate it to just the hostname
 *
 * @param {string} u The url to be abbreviated
 * @returns {string} The abbreviated url
 */
export function abbreviateUrl(u?: string): string {
    if (!u) return "";

    let parsedUrl: URL;
    try {
        parsedUrl = parseUrl(u);
    } catch (e) {
        console.error(e);
        // if it's something we can't parse as a url then just return it
        return u;
    }

    if (parsedUrl.pathname === "/") {
        // we ignore query / hash parts: these aren't relevant for IS server URLs
        return parsedUrl.host || "";
    }

    return u;
}

export function unabbreviateUrl(u?: string): string {
    if (!u) return "";

    let longUrl = u;
    if (!u.startsWith("https://")) longUrl = "https://" + u;
    const parsed = parseUrl(longUrl);
    if (!parsed.hostname) return u;

    return longUrl;
}

export function parseUrl(u: string): URL {
    if (!u.includes(":")) {
        u = window.location.protocol + u;
    }
    return new URL(u);
}

export const PERMITTED_URL_SCHEMES = [
    "bitcoin",
    "ftp",
    "geo",
    "http",
    "https",
    "im",
    "irc",
    "ircs",
    "magnet",
    "mailto",
    "matrix",
    "mms",
    "news",
    "nntp",
    "openpgp4fpr",
    "sip",
    "sftp",
    "sms",
    "smsto",
    "ssh",
    "tel",
    "urn",
    "webcal",
    "wtai",
    "xmpp",
];

/*
Copyright 2024 New Vector Ltd.
Copyright 2019-2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { isPermalinkHost } from "./permalinks/Permalinks";

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

/**
 * Find the URLs in a block of text.
 *
 * Links are inserted in the order they appear in the text, which guarantees
 * iteration order to be the same.
 *
 * @param content The text to search, e.g. plaintext from the message composer.
 * @returns The set of whitespace-separated words which parse as a URL.
 */
export function linksIn(content: string): Set<string> {
    return new Set(
        content
            .split(" ")
            .map((w) => w.trim())
            .filter(linkPreviewable),
    );
}

export function linkPreviewable(s: string): boolean {
    if (!s || !URL.canParse(s)) return false;

    const url = new URL(s);
    if (!["http:", "https:"].includes(url.protocol)) return false;
    if (isPermalinkHost(url.host)) return false;

    return true;
}

export function parseUrl(u: string): URL {
    if (!u.includes(":")) {
        u = window.location.protocol + u;
    }
    return new URL(u);
}

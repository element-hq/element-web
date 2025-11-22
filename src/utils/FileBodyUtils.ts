/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

export let DOWNLOAD_ICON_URL: string; // cached copy of the download.svg asset for the sandboxed iframe later on

export async function cacheDownloadIcon(): Promise<void> {
    if (DOWNLOAD_ICON_URL) return; // cached already
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const svg = await fetch(require("@vector-im/compound-design-tokens/icons/download.svg").default).then((r) =>
        r.text(),
    );
    DOWNLOAD_ICON_URL = "data:image/svg+xml;base64," + window.btoa(svg);
}

// Cache the asset immediately
// noinspection JSIgnoredPromiseFromCall
cacheDownloadIcon();

/**
 * Get the current CSS style for a DOMElement.
 * @param {HTMLElement} element The element to get the current style of.
 * @return {string} The CSS style encoded as a string.
 */
export function computedStyle(element: HTMLElement | null): string {
    if (!element) {
        return "";
    }
    const style = window.getComputedStyle(element, null);
    let cssText = style.cssText;
    // noinspection EqualityComparisonWithCoercionJS
    if (cssText == "") {
        // Firefox doesn't implement ".cssText" for computed styles.
        // https://bugzilla.mozilla.org/show_bug.cgi?id=137687
        for (const rule of style) {
            cssText += rule + ":";
            cssText += style.getPropertyValue(rule) + ";";
        }
    }
    return cssText;
}

/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import browserslist from "browserslist";

/**
 * The browsers we support, as a browserslist query.
 * See https://github.com/element-hq/element-web#supported-environments
 */
const SUPPORTED_BROWSER_QUERY =
    "last 2 Chrome versions, last 2 Firefox versions, last 2 Safari versions, last 2 Edge versions";

/**
 * Works out the oldest supported major version of each browser in {@link SUPPORTED_BROWSER_QUERY}, keyed by
 * lower-case browser name, e.g. `{ chrome: 140, firefox: 143 }`.
 *
 * This runs at build time and the result is baked into the app as `__MINIMUM_BROWSER_VERSIONS__`, so that
 * browserslist and its caniuse data aren't shipped to the browser. The caniuse data would be fixed at build time
 * either way, so the result is the same.
 */
export function getMinimumBrowserVersions(): Record<string, number> {
    const minimumVersions: Record<string, number> = {};
    for (const browser of browserslist(SUPPORTED_BROWSER_QUERY)) {
        const [name, version] = browser.split(" ");
        const browserName = name.toLowerCase();
        const browserVersion = parseInt(version, 10);
        // Skip non-numeric versions such as Safari's "TP" (Technology Preview)
        if (Number.isNaN(browserVersion)) continue;
        if (!(browserName in minimumVersions) || browserVersion < minimumVersions[browserName]) {
            minimumVersions[browserName] = browserVersion;
        }
    }
    return minimumVersions;
}

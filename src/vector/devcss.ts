/*
Copyright 2024 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

/**
 * This code is removed on production builds.
 *
 * Webpack's `string-replace-loader` searches for the `use theming` string
 * in this specific file, and replaces it with CSS requires statements that
 * are specific to the themes we have enabled.
 *
 * Without this workaround, webpack would import the CSS of all themes, which
 * would defeat the purpose of hot-reloading since all themes would be compiled,
 * which would result in compilation times on the order of 30s, even on a
 * powerful machine.
 *
 * For more details, see webpack.config.js:184 (string-replace-loader)
 */
if (process.env.NODE_ENV === "development") {
    ("use theming");
    /**
     * Clean up old hot-module script injections as they hog up memory
     * and anything other than the newest one is really not needed at all.
     * We don't need to do it more frequently than every half a minute or so,
     * but it's done to delay full page reload due to app slowness.
     */
    setInterval(() => {
        const elements = Array.from(document.querySelectorAll("script[src*=hot-update]"));
        if (elements.length > 1) {
            const oldInjects = elements.slice(0, elements.length - 1);
            oldInjects.forEach((e) => e.remove());
        }
    }, 1000);
}

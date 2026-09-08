/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// Note: eslint-plugin-jsdoc doesn't like import types as parameters, so we
// get around it with @typedef
/**
 * @typedef {import("@element-hq/element-web-module-api").Api} Api
 */

export default class UrlPreviewModule {
    static moduleApiVersion = "^1.17.0";
    /**
     * Basic module for testing URL previews.
     * @param {Api} api API object
     */
    constructor(api) {
        this.api = api;

        // Previews the URL itself, reporting back what the handler was given so that
        // tests can check whether the event was passed through.
        this.api.urlPreviews.registerPreviewHandler(/^https:\/\/module\.example\.org\//, async (url, mxEvent) => ({
            link: url,
            title: mxEvent ? `Module preview from ${mxEvent.sender}` : "Module preview without an event",
            siteName: "module.example.org",
            // Note: the event id is not asserted on, as previews are generated from the local
            // echo and so the id is still the pending transaction id at that point.
            description: mxEvent ? `Previewing ${mxEvent.type} in ${mxEvent.roomId}` : "No event was provided",
            showTooltipOnLink: false,
        }));

        // Declines to preview, so the client should fall back to the homeserver.
        this.api.urlPreviews.registerPreviewHandler(/^https:\/\/decline\.example\.org\//, async () => null);

        // Matches both of the above, but is registered last so it should never be used:
        // the first handler whose regex matches wins, whatever it returns.
        this.api.urlPreviews.registerPreviewHandler(/^https:\/\/(module|decline)\.example\.org\//, async (url) => ({
            link: url,
            title: "Later handler should not be used",
            siteName: "later.example.org",
            showTooltipOnLink: false,
        }));
    }
    async load() {}
}

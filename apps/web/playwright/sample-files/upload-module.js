/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// Note: eslint-plugin-jsdoc doesn't like import types as parameters, so we
// get around it with @typedef
/**
 * @typedef {import("@element-hq/element-web-module-api").Api} Api
 */

export default class CustomComponentModule {
    static moduleApiVersion = "^*";
    /**
     * Basic module for testing.
     * @param {Api} api API object
     */
    constructor(api) {
        this.api = api;
        this.api.composer.addFileUploadOption({
            type: "org.example.uploader",
            label: "Example uploader",
            onSelected: (roomId) => {
                this.api.composer.openFileUploadConfirmation([
                    new File(["test"], "testfile.txt", { type: "text/plain" }),
                ]);
            },
        });
    }
    async load() {}
}

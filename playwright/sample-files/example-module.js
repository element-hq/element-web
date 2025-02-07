/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

export default class ExampleModule {
    static moduleApiVersion = "^0.1.0";
    constructor(api) {
        this.api = api;
    }
    async load() {
        alert("Testing module loading successful!");
    }
}

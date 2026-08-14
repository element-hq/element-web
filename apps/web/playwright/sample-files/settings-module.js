/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

export default class SettingsModule {
    static moduleApiVersion = "^*";
    constructor(api) {
        this.api = api;
    }
    async load() {
        // oxlint-disable-next-line no-alert
        alert(this.api.settings.getValue("language"));
    }
}

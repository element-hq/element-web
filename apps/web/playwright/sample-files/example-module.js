/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

export default class ExampleModule {
    static moduleApiVersion = "^1.0.0";
    constructor(api) {
        this.api = api;

        this.api.i18n.register({
            key: {
                en: "%(brand)s module loading successful!",
                de: "%(brand)s-Module erfolgreich geladen!",
            },
        });
    }
    async load() {
        const brand = this.api.config.get("brand");
        alert(this.api.i18n.translate("key", { brand }));
    }
}

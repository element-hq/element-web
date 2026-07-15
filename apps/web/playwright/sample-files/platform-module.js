/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

export default class PlatformModule {
    static moduleApiVersion = "^1.0.0";
    constructor(api) {
        this.api = api;
    }
    async load() {
        const pickleKey = await this.api.platform.getPickleKey("@test:example.org", "TESTDEVICE");
        alert(String(pickleKey));
    }
}

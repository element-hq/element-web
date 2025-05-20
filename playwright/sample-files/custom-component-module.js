/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

export default class CustomComponentModule {
    static moduleApiVersion = "^1.0.0";
    constructor(api) {
        this.api = api;
        this.api.customComponents.register("TextualBody", (props, originalComponent) => {
            const body = props.mxEvent.getContent().body;
            if (body === "Do not replace me") {
                return originalComponent();
            }
            return `Custom text for ${body}`;
        });
    }
    async load() {}
}

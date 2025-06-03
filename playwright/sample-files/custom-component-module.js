/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

export default class CustomComponentModule {
    static moduleApiVersion = "^1.0.0";
    constructor(api) {
        this.api = api;
        this.api.customComponents.registerMessageRenderer("m.room.message", (props, originalComponent) => {
            const body = props.mxEvent.getContent().body;
            if (body === "Do not replace me") {
                return originalComponent();
            }
            else if (body === "Fall through here"){
                return null;
            }
            return `Custom text for ${body}`;
        });
        this.api.customComponents.registerMessageRenderer(/m\.room\.message/, (props) => {
            const body = props.mxEvent.getContent().body;
            if (body !== "Fall through here") {
                return null;
            }
            return `Fallthrough text for ${body}`;
        });
    }
    async load() {}
}

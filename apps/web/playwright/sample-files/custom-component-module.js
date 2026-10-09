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
    static moduleApiVersion = "^2.0.0";
    /**
     * Basic module for testing.
     * @param {Api} api API object
     */
    constructor(api) {
        this.api = api;
        this.api.customComponents.registerMessageRenderer(
            (evt) => evt.content.body === "Do not show edits",
            (_props, originalComponent) => {
                return originalComponent();
            },
            { allowEditingEvent: false },
        );
        this.api.customComponents.registerMessageRenderer(
            (evt) => evt.content.body === "Render as informational message",
            (_props, originalComponent) => {
                return originalComponent();
            },
            { renderAsInformationalMessage: true },
        );
        this.api.customComponents.registerMessageRenderer(
            (evt) => typeof evt.content["org.example.group"] === "string",
            (_props, originalComponent) => originalComponent(),
            {
                renderGroupSummary: {
                    getKey: (evt) => String(evt.content["org.example.group"]),
                    getSummary: (events) =>
                        `Module grouped ${String(events[0].content["org.example.group"])}: ${events.length} messages`,
                },
            },
        );
        this.api.customComponents.registerMessageRenderer(
            (evt) => evt.content.body === "Render without sender profile",
            (_props, originalComponent) => {
                return originalComponent();
            },
            { renderSenderProfile: false },
        );
        this.api.customComponents.registerMessageRenderer(
            (evt) => evt.content.body === "Fall through here",
            (props) => {
                const body = props.mxEvent.content.body;
                return `Fallthrough text for ${body}`;
            },
        );
        this.api.customComponents.registerMessageRenderer(
            (evt) => {
                if (evt.content.body === "Crash the filter!") {
                    throw new Error("Fail test!");
                }
                return false;
            },
            () => {
                return `Should not render!`;
            },
        );
        this.api.customComponents.registerMessageRenderer(
            (evt) => evt.content.body === "Crash the renderer!",
            () => {
                throw new Error("Fail test!");
            },
        );

        this.api.customComponents.registerMessageRenderer(
            (mxEvent) => mxEvent.type === "m.room.message" && mxEvent.content.msgtype === "m.image",
            (_props, originalComponent) => {
                return originalComponent();
            },
            {
                allowDownloadingMedia: async (mxEvent) => mxEvent.content.body !== "bad.png",
            },
        );

        // Order is specific here to avoid this overriding the other renderers
        this.api.customComponents.registerMessageRenderer("m.room.message", (props, originalComponent) => {
            const body = props.mxEvent.content.body;
            if (body === "Do not replace me") {
                return originalComponent();
            } else if (body === "Fall through here") {
                return null;
            }
            return `Custom text for ${body}`;
        });
    }
    async load() {}
}

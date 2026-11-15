/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { type IApp } from "../../../utils/WidgetUtils-types";

/**
 * Whether a widget URL may be handed to the compat wrapper. The wrapper runs on Element Web's own
 * origin and loads the URL in an iframe of its own, so a `javascript:` or `data:` URL would run
 * with access to the client. Only web pages are allowed.
 */
export function isCompatWrapperUrlAllowed(widgetUrl: string): boolean {
    try {
        const { protocol } = new URL(widgetUrl);
        return protocol === "https:" || protocol === "http:";
    } catch {
        // Not an absolute URL
        return false;
    }
}

/**
 * Builds the URL that embeds a legacy (matrix-widget-api) widget through the bundled compat
 * wrapper, which speaks MSC4412 to Element Web and the legacy protocol to the widget.
 *
 * The widget URL is passed untemplated: the wrapper resolves `$matrix_user_id` and friends itself
 * by asking the host for the Matrix and client context. The wrapper is addressed by directory,
 * like the embedded Element Call widget, so that hosts which strip `.html` still resolve its chunks.
 *
 * @param app The widget definition from room state.
 * @param opts.scalarToken An integration manager token to hand to the widget, if it needs one.
 * @throws If the widget URL is not one the wrapper may load, see {@link isCompatWrapperUrlAllowed}.
 */
export function buildCompatWrapperUrl(app: IApp, opts: { scalarToken?: string } = {}): string {
    if (!isCompatWrapperUrlAllowed(app.url)) {
        throw new Error("Refusing to embed a widget that is not a web page through the compat wrapper");
    }
    const wrapper = new URL("./widgets/compat-wrapper/", window.location.href);

    // Appended by hand rather than through URLSearchParams, which would percent-encode the `$` of
    // the template variables the wrapper has to see.
    let legacyUrl = app.url;
    if (opts.scalarToken) {
        legacyUrl += (legacyUrl.includes("?") ? "&" : "?") + "scalar_token=" + encodeURIComponent(opts.scalarToken);
    }

    wrapper.searchParams.set("legacy_widget_url", legacyUrl);
    wrapper.searchParams.set("legacy_widget_id", app.id);
    wrapper.searchParams.set("legacy_widget_name", app.name ?? app.id);
    wrapper.searchParams.set("legacy_wait_for_iframe_load", String(app.waitForIframeLoad !== false));
    if (app.data && Object.keys(app.data).length > 0) {
        wrapper.searchParams.set("legacy_widget_data", JSON.stringify(app.data));
    }
    wrapper.searchParams.set("client_origin", window.location.origin);
    return wrapper.toString();
}

/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import type * as Bindings from "@matrix-widget-tools/widget-host-bindings";

/**
 * The MSC4412 widget host bindings: the Rust `widget-host-driver` and its companions as TypeScript
 * plus one wasm module.
 */
export type WidgetHostBindings = typeof Bindings;

let loading: Promise<WidgetHostBindings> | undefined;

/**
 * Loads the widget host bindings and initialises their wasm module. The bindings are only needed
 * when a widget is rendered on the MSC4412 host, so they stay out of the main bundle and are loaded
 * on first use. Calling this again returns the same promise.
 *
 * This is the only place that imports the package; tests mock this module.
 */
export function loadWidgetHostBindings(): Promise<WidgetHostBindings> {
    return (loading ??= import(/* webpackChunkName: "widget-host" */ "@matrix-widget-tools/widget-host-bindings").then(
        async (bindings) => {
            await bindings.uniffiInitAsync();
            return bindings;
        },
    ));
}

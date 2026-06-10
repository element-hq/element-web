/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { z, type input } from "zod/mini";

z.config(z.locales.en());

export const WidgetTogglesConfig = z.object({
    /**
     * The widget types to show a toggle for.
     */
    types: z.array(z.string()),
});

export type WidgetTogglesConfig = z.infer<typeof WidgetTogglesConfig>;

export const CONFIG_KEY = "io.element.element-web-modules.widget-toggles";

declare module "@element-hq/element-web-module-api" {
    export interface Config {
        [CONFIG_KEY]: input<WidgetTogglesConfig>;
    }
}

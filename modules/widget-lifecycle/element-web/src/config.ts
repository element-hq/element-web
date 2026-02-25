/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { z } from "zod/mini";

z.config(z.locales.en());

/** The config.json key under which widget lifecycle module configuration is stored. */
export const CONFIG_KEY = "io.element.element-web-modules.widget-lifecycle";

export const WidgetConfigurationSchema = z.partial(
    z.looseObject({
        preload_approved: z.boolean(),
        identity_approved: z.boolean(),
        capabilities_approved: z.array(z.string().check(z.minLength(1))),
    }),
);

/** Per-widget approval settings: preload, identity, and capabilities. */
export type WidgetConfiguration = z.infer<typeof WidgetConfigurationSchema>;

const ModuleConfigSchema = z.partial(
    z.looseObject({
        widget_permissions: z.record(z.string(), WidgetConfigurationSchema),
    }),
);

/** Map from URL patterns to their widget approval configuration. */
export type WidgetLifecycleModuleConfig = Record<string, WidgetConfiguration>;

/**
 * Parse and validate the widget lifecycle module configuration.
 * Returns an empty config if the input is falsy; throws on schema violations.
 */
declare module "@element-hq/element-web-module-api" {
    export interface Config {
        [CONFIG_KEY]: z.input<typeof ModuleConfigSchema>;
    }
}

export const parseWidgetLifecycleConfig = (value: unknown): WidgetLifecycleModuleConfig => {
    if (!value) return {};

    const result = ModuleConfigSchema.safeParse(value);
    if (!result.success) {
        throw new Error(`Errors in the module configuration for "${CONFIG_KEY}": ${result.error.message}`);
    }

    return result.data.widget_permissions ?? {};
};

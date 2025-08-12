/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { z, ZodSchema, ZodTypeDef } from "zod";

export const ModuleConfig = z.object({
    /**
     * The URL of the homeserver where the guest users should be registered. This
     * must have the `synapse-restricted-guests-module` installed.
     * @example `https://synapse.local`
     */
    guest_user_homeserver_url: z.string().url(),

    /**
     * The username prefix that identifies guest users.
     * @defaultValue `@guest-`
     */
    guest_user_prefix: z
        .string()
        .regex(/@[a-zA-Z-_1-9]+/)
        .default("@guest-"),

    /**
     * If true, the user will be forwarded to the login page instead of to the SSO
     * login. This is only required if the home server has no SSO support.
     * @defaultValue `false`
     */
    skip_single_sign_on: z.boolean().default(false),
});

export type ModuleConfig = z.infer<typeof ModuleConfig>;

type ConfigSchema = ZodSchema<z.output<typeof ModuleConfig>, ZodTypeDef, z.input<typeof ModuleConfig>>;

export const CONFIG_KEY = "io.element.element-web-modules.restricted-guests";

declare module "@element-hq/element-web-module-api" {
    export interface Config {
        [CONFIG_KEY]: ConfigSchema["_input"];
    }
}

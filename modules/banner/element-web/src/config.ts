/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { z } from "zod";

const StaticConfig = z.object({
    type: z.literal("static"),

    /**
     * Alternative logo URL to display in the popover menu.
     * Will use the main logo url if omitted.
     */
    logo_url: z.string().url().optional(),

    /**
     * Categories of links to display in the menu.
     */
    categories: z.array(
        z.object({
            /**
             * The category display name
             */
            name: z.string(),
            /**
             * List of links to display in the category
             */
            links: z.array(
                z.object({
                    /**
                     * The URL to the icon.
                     */
                    icon_uri: z.string().url(),
                    /**
                     * The label of the link.
                     */
                    name: z.string(),
                    /**
                     * The destination URL of the link.
                     */
                    link_url: z.string().url(),
                    /**
                     * The browsing context in which the browser opens the link.
                     */
                    target: z.string().optional(),
                }),
            ),
        }),
    ),
});

export type StaticConfig = z.infer<typeof StaticConfig>;

const UniventionConfig = z.object({
    type: z.literal("univention"),

    /**
     * Alternative logo URL to display in the popover menu.
     * Will use the main logo url if omitted.
     */
    logo_url: z.string().url().optional(),

    /**
     * Base URL to an Intercom Service
     * https://docs.software-univention.de/intercom-service/latest/architecture.html#endpoints
     */
    ics_url: z.string().url(),
});

export type UniventionConfig = z.infer<typeof UniventionConfig>;

export const ModuleConfig = z.object({
    /**
     * The URL of the portal logo.svg file.
     * @example `https://example.com/logo.svg`
     */
    logo_url: z.string().url(),

    /**
     * The URL of the portal.
     * @example `https://example.com`
     */
    logo_link_url: z.string().url(),

    menu: z.discriminatedUnion("type", [StaticConfig, UniventionConfig]),
});

export type ModuleConfig = z.infer<typeof ModuleConfig>;

export const CONFIG_KEY = "io.element.element-web-modules.banner";

declare module "@element-hq/element-web-module-api" {
    export interface Config {
        [CONFIG_KEY]: ModuleConfig;
    }
}

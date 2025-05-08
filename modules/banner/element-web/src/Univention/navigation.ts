/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { z } from "zod";

import { StaticConfig } from "../config";

/**
 * Univention Central Navigation API
 * https://docs.software-univention.de/nubus-kubernetes-customization/1.x/en/api/central-navigation.html
 */
export const UniventionCentralNavigation = z.object({
    categories: z.array(
        z.object({
            identifier: z.string(),
            display_name: z.string(),
            entries: z.array(
                z.object({
                    /**
                     * A unique identifier for the navigation item.
                     */
                    identifier: z.string(),
                    /**
                     * The URL to the icon in SVG format.
                     */
                    icon_url: z.string(),
                    /**
                     * The label of the link.
                     */
                    display_name: z.string(),
                    /**
                     * The destination URL of the link.
                     */
                    link: z.string(),
                    /**
                     * The browsing context in which the browser opens the link.
                     * Corresponds to the `target` property of `<a>` tags in HTML.
                     */
                    target: z.string(),
                    /**
                     * It’s usually empty.
                     */
                    keywords: z.object({}).optional(),
                }),
            ),
        }),
    ),
});

type UniventionCentralNavigation = z.infer<typeof UniventionCentralNavigation>;

function navigationToConfig(navigation: UniventionCentralNavigation): StaticConfig {
    return {
        type: "static",
        categories: navigation.categories.map((category) => ({
            name: category.display_name,
            links: category.entries.map((entry) => ({
                icon_uri: entry.icon_url,
                name: entry.display_name,
                link_url: entry.link,
                target: entry.target,
            })),
        })),
    };
}

export async function fetchNavigation(icsUrl: string, language: string): Promise<StaticConfig> {
    const url = new URL("navigation.json", icsUrl);
    url.search = `?language=${language}`;

    const response = await fetch(url, {
        credentials: "include",
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch navigation: ${response.status}`);
    }

    const data = await response.json();
    const config = await UniventionCentralNavigation.parseAsync(data);
    return navigationToConfig(config);
}

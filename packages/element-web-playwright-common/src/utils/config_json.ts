/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { BrowserContext, Page } from "@playwright/test";

import { Config, CONFIG_JSON } from "../index.js";

/** Construct a suitable config.json for the given homeserver
 *
 * @param homeserverBaseUrl - The `baseUrl` of the homeserver that the client should be configured to connect to.
 * @param additionalConfig - Additional config to add to the default config.json.
 * @param labsFlags - Lab flags to enable in the client.
 * @param disablePresence - Whether to disable presence for the given homeserver.
 */
export function buildConfigJson(
    homeserverBaseUrl: string,
    additionalConfig: Partial<Config> = {},
    labsFlags: string[] = [],
    disablePresence: boolean = false,
): Partial<Config> {
    const json = {
        ...CONFIG_JSON,
        ...additionalConfig,
        default_server_config: {
            "m.homeserver": {
                base_url: homeserverBaseUrl,
            },
            ...additionalConfig.default_server_config,
        },
    };
    json["features"] = {
        ...json["features"],
        // Enable the lab features
        ...labsFlags.reduce<NonNullable<(typeof CONFIG_JSON)["features"]>>((obj, flag) => {
            obj[flag] = true;
            return obj;
        }, {}),
    };
    if (disablePresence) {
        json["enable_presence_by_hs_url"] = {
            [homeserverBaseUrl]: false,
        };
    }
    return json;
}

/**
 * Add a route to the browser context/page which will serve a suitable config.json for the given homeserver.
 *
 * @param context - The browser context or page to route the config.json to.
 * @param homeserverBaseUrl - The `baseUrl` of the homeserver that the client should be configured to connect to.
 * @param additionalConfig - Additional config to add to the default config.json.
 * @param labsFlags - Lab flags to enable in the client.
 * @param disablePresence - Whether to disable presence for the given homeserver.
 */
export async function routeConfigJson(
    context: BrowserContext | Page,
    homeserverBaseUrl: string,
    additionalConfig: Partial<Config> = {},
    labsFlags: string[] = [],
    disablePresence: boolean = false,
): Promise<void> {
    await context.route(`http://localhost:8080/config.json*`, async (route) => {
        const json = buildConfigJson(homeserverBaseUrl, additionalConfig, labsFlags, disablePresence);
        await route.fulfill({ json });
    });
}

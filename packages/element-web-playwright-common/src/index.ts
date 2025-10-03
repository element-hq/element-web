/*
Copyright 2024-2025 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type Config as BaseConfig } from "@element-hq/element-web-module-api";

import { test as base } from "./fixtures/index.js";
import { routeConfigJson } from "./utils/config_json.js";

export * from "./utils/config_json.js";
export * from "./utils/context.js";

export { populateLocalStorageWithCredentials } from "./fixtures/user.js";

// Enable experimental service worker support
// See https://playwright.dev/docs/service-workers-experimental#how-to-enable
process.env["PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS"] = "1";

// We extend the Module API Config interface so that all modules
// which use declaration merging will have their config types correctly applied.
export interface Config extends BaseConfig {
    default_server_config: {
        "m.homeserver"?: {
            base_url: string;
            server_name?: string;
        };
        "m.identity_server"?: {
            base_url: string;
            server_name?: string;
        };
    };
    enable_presence_by_hs_url?: Record<string, boolean>;
    setting_defaults: Record<string, unknown>;
    map_style_url?: string;
    features: Record<string, boolean>;
    modules?: string[];
}

// This is deliberately quite a minimal config.json, so that we can test that the default settings actually work.
export const CONFIG_JSON: Partial<Config> = {
    default_server_config: {},

    // The default language is set here for test consistency
    setting_defaults: {
        language: "en-GB",
    },

    // the location tests want a map style url.
    map_style_url: "https://api.maptiler.com/maps/streets/style.json?key=fU3vlMsMn4Jb6dnEIFsx",

    features: {
        // We don't want to go through the feature announcement during the e2e test
        feature_release_announcement: false,
    },
};

export interface TestFixtures {
    /**
     * The contents of the config.json to send when the client requests it.
     */
    config: Partial<typeof CONFIG_JSON>;

    labsFlags: string[];
    disablePresence: boolean;
}

export const test = base.extend<TestFixtures>({
    // We merge this atop the default CONFIG_JSON in the page fixture to make extending it easier
    config: async ({}, use) => use({}),
    labsFlags: async ({}, use) => use([]),
    disablePresence: async ({}, use) => use(false),
    page: async ({ homeserver, context, page, config, labsFlags, disablePresence }, use) => {
        await routeConfigJson(context, homeserver.baseUrl, config, labsFlags, disablePresence);
        await use(page);
    },
});

export { expect, type ToMatchScreenshotOptions } from "./expect/index.js";

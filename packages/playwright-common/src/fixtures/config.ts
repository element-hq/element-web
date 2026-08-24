/*
Copyright 2025-2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// We want to avoid using `mergeTests` because it drops useful type
// information about the fixtures. Instead, we just add our fixtures to the linear hierarchy.
import { test as base } from "./user.js";

import { type Config } from "@element-hq/element-web-module-api";

import { routeConfigJson } from "../utils/config_json.js";

interface TestFixtures {
    /**
     * The contents of the config.json to send when the client requests it.
     */
    config: Partial<Config>;

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

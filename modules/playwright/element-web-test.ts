/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { test as base, expect, type TestFixtures } from "@element-hq/element-web-playwright-common";

export interface Options {
    moduleDir: string;
    modules: string[];
}

export const test = base.extend<TestFixtures & Options>({
    moduleDir: ["", { option: true }],
    modules: async ({ moduleDir }, use) => {
        await use([`${moduleDir}/lib/index.js`]);
    },

    page: async ({ page, modules, config }, use) => {
        config.modules = [];
        for (let i = 0; i < modules.length; i++) {
            const module = `/modules/module-${i}/index.js`;
            await page.route(module, async (route) => {
                await route.fulfill({ path: modules[i] });
            });
            config.modules.push(module);
        }

        await use(page);
    },
});

export { expect };

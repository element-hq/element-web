/*
Copyright 2023 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import { test as base, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

import type mailhog from "mailhog";
import type { IConfigOptions } from "../src/IConfigOptions";
import { HomeserverInstance, StartHomeserverOpts } from "./plugins/utils/homeserver";
import { Synapse } from "./plugins/synapse";
import { Instance } from "./plugins/mailhog";

const CONFIG_JSON: Partial<IConfigOptions> = {
    // This is deliberately quite a minimal config.json, so that we can test that the default settings
    // actually work.
    //
    // The only thing that we really *need* (otherwise Element refuses to load) is a default homeserver.
    // We point that to a guaranteed-invalid domain.
    default_server_config: {
        "m.homeserver": {
            base_url: "https://server.invalid",
        },
    },

    // the location tests want a map style url.
    map_style_url: "https://api.maptiler.com/maps/streets/style.json?key=fU3vlMsMn4Jb6dnEIFsx",
};

export type TestOptions = {
    crypto: "legacy" | "rust";
};

export const test = base.extend<
    TestOptions & {
        axe: AxeBuilder;
        checkA11y: () => Promise<void>;
        config: typeof CONFIG_JSON;
        startHomeserverOpts: StartHomeserverOpts | string;
        homeserver: HomeserverInstance;
        mailhog?: { api: mailhog.API; instance: Instance };
    }
>({
    crypto: ["legacy", { option: true }],
    config: CONFIG_JSON,
    page: async ({ context, page, config, crypto }, use) => {
        await context.route(`http://localhost:8080/config.json*`, async (route) => {
            const json = { ...config };
            if (crypto === "rust") {
                json["features"] = {
                    ...json["features"],
                    feature_rust_crypto: true,
                };
            }
            await route.fulfill({ json });
        });
        await use(page);
    },

    startHomeserverOpts: "default",
    homeserver: async ({ request, startHomeserverOpts: opts }, use) => {
        if (typeof opts === "string") {
            opts = { template: opts };
        }

        const server = new Synapse(request);
        await use(await server.start(opts));
        await server.stop();
    },

    axe: async ({ page }, use) => {
        await use(new AxeBuilder({ page }));
    },
    checkA11y: async ({ axe }, use, testInfo) =>
        use(async () => {
            const results = await axe.analyze();

            await testInfo.attach("accessibility-scan-results", {
                body: JSON.stringify(results, null, 2),
                contentType: "application/json",
            });

            expect(results.violations).toEqual([]);
        }),
});

test.use({});

export { expect } from "@playwright/test";

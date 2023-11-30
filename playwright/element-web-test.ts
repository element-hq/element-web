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

import { test as base, expect, Locator } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import _ from "lodash";

import type mailhog from "mailhog";
import type { IConfigOptions } from "../src/IConfigOptions";
import { Credentials, Homeserver, HomeserverInstance, StartHomeserverOpts } from "./plugins/homeserver";
import { Synapse } from "./plugins/homeserver/synapse";
import { Dendrite, Pinecone } from "./plugins/homeserver/dendrite";
import { Instance } from "./plugins/mailhog";
import { ElementAppPage } from "./pages/ElementAppPage";
import { OAuthServer } from "./plugins/oauth_server";
import { Crypto } from "./pages/crypto";
import { Toasts } from "./pages/toasts";
import { Bot, CreateBotOpts } from "./pages/bot";

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
    cryptoBackend: "legacy" | "rust";
};

interface CredentialsWithDisplayName extends Credentials {
    displayName: string;
}

export const test = base.extend<
    TestOptions & {
        axe: AxeBuilder;
        checkA11y: () => Promise<void>;
        // The contents of the config.json to send
        config: typeof CONFIG_JSON;
        // The options with which to run the `homeserver` fixture
        startHomeserverOpts: StartHomeserverOpts | string;
        homeserver: HomeserverInstance;
        oAuthServer: { port: number };
        credentials: CredentialsWithDisplayName;
        user: CredentialsWithDisplayName;
        displayName?: string;
        app: ElementAppPage;
        mailhog?: { api: mailhog.API; instance: Instance };
        crypto: Crypto;
        room?: { roomId: string };
        toasts: Toasts;
        uut?: Locator; // Unit Under Test, useful place to refer a prepared locator
        botCreateOpts: CreateBotOpts;
        bot: Bot;
    }
>({
    cryptoBackend: ["legacy", { option: true }],
    config: CONFIG_JSON,
    page: async ({ context, page, config, cryptoBackend }, use) => {
        await context.route(`http://localhost:8080/config.json*`, async (route) => {
            const json = { ...CONFIG_JSON, ...config };
            if (cryptoBackend === "rust") {
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

        let server: Homeserver;
        const homeserverName = process.env["PLAYWRIGHT_HOMESERVER"];
        switch (homeserverName) {
            case "dendrite":
                server = new Dendrite(request);
                break;
            case "pinecone":
                server = new Pinecone(request);
                break;
            default:
                server = new Synapse(request);
        }

        await use(await server.start(opts));
        await server.stop();
    },
    // eslint-disable-next-line no-empty-pattern
    oAuthServer: async ({}, use) => {
        const server = new OAuthServer();
        const port = server.start();
        await use({ port });
        server.stop();
    },

    displayName: undefined,
    credentials: async ({ homeserver, displayName: testDisplayName }, use) => {
        const names = ["Alice", "Bob", "Charlie", "Daniel", "Eve", "Frank", "Grace", "Hannah", "Isaac", "Judy"];
        const username = _.uniqueId("user_");
        const password = _.uniqueId("password_");
        const displayName = testDisplayName ?? _.sample(names)!;

        const credentials = await homeserver.registerUser(username, password, displayName);
        console.log(`Registered test user ${username} with displayname ${displayName}`);

        await use({
            ...credentials,
            displayName,
        });
    },
    user: async ({ page, homeserver, credentials }, use) => {
        await page.addInitScript(
            ({ baseUrl, credentials }) => {
                // Seed the localStorage with the required credentials
                window.localStorage.setItem("mx_hs_url", baseUrl);
                window.localStorage.setItem("mx_user_id", credentials.userId);
                window.localStorage.setItem("mx_access_token", credentials.accessToken);
                window.localStorage.setItem("mx_device_id", credentials.deviceId);
                window.localStorage.setItem("mx_is_guest", "false");
                window.localStorage.setItem("mx_has_pickle_key", "false");
                window.localStorage.setItem("mx_has_access_token", "true");

                // Ensure the language is set to a consistent value
                window.localStorage.setItem("mx_local_settings", '{"language":"en"}');
            },
            { baseUrl: homeserver.config.baseUrl, credentials },
        );
        await page.goto("/");

        await page.waitForSelector(".mx_MatrixChat", { timeout: 30000 });

        await use(credentials);
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

    app: async ({ page }, use) => {
        const app = new ElementAppPage(page);
        await use(app);
    },
    crypto: async ({ page, homeserver, request }, use) => {
        await use(new Crypto(page, homeserver, request));
    },
    toasts: async ({ page }, use) => {
        await use(new Toasts(page));
    },

    botCreateOpts: {},
    bot: async ({ page, homeserver, botCreateOpts }, use) => {
        const bot = new Bot(page, homeserver, botCreateOpts);
        await bot.prepareClient(); // eagerly register the bot
        await use(bot);
    },
});

test.use({});

export { expect };

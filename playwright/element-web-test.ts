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

import { test as base, expect as baseExpect, Locator, Page, ExpectMatcherState, ElementHandle } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import _ from "lodash";
import { basename } from "node:path";

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
import { ProxyInstance, SlidingSyncProxy } from "./plugins/sliding-sync-proxy";
import { Webserver } from "./plugins/webserver";

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

    // The default language is set here for test consistency
    setting_defaults: {
        language: "en-GB",
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
        slidingSyncProxy: ProxyInstance;
        labsFlags: string[];
        webserver: Webserver;
    }
>({
    cryptoBackend: ["legacy", { option: true }],
    config: CONFIG_JSON,
    page: async ({ context, page, config, cryptoBackend, labsFlags }, use) => {
        await context.route(`http://localhost:8080/config.json*`, async (route) => {
            const json = { ...CONFIG_JSON, ...config };
            json["features"] = {
                ...json["features"],
                // Enable the lab features
                ...labsFlags.reduce((obj, flag) => {
                    obj[flag] = true;
                    return obj;
                }, {}),
            };
            if (cryptoBackend === "rust") {
                json.features.feature_rust_crypto = true;
            }
            await route.fulfill({ json });
        });
        await use(page);
    },

    startHomeserverOpts: "default",
    homeserver: async ({ request, startHomeserverOpts: opts }, use, testInfo) => {
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
        const logs = await server.stop();

        if (testInfo.status !== "passed") {
            for (const path of logs) {
                await testInfo.attach(`homeserver-${basename(path)}`, {
                    path,
                    contentType: "text/plain",
                });
            }
        }
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
        const password = _.uniqueId("password_");
        const displayName = testDisplayName ?? _.sample(names)!;

        const credentials = await homeserver.registerUser("user", password, displayName);
        console.log(`Registered test user @user:localhost with displayname ${displayName}`);

        await use({
            ...credentials,
            displayName,
        });
    },
    labsFlags: [],
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
    bot: async ({ page, homeserver, botCreateOpts, user }, use) => {
        const bot = new Bot(page, homeserver, botCreateOpts);
        await bot.prepareClient(); // eagerly register the bot
        await use(bot);
    },

    slidingSyncProxy: async ({ page, user, homeserver }, use) => {
        const proxy = new SlidingSyncProxy(homeserver.config.dockerUrl);
        const proxyInstance = await proxy.start();
        const proxyAddress = `http://localhost:${proxyInstance.port}`;
        await page.addInitScript((proxyAddress) => {
            window.localStorage.setItem(
                "mx_local_settings",
                JSON.stringify({
                    feature_sliding_sync_proxy_url: proxyAddress,
                }),
            );
            window.localStorage.setItem("mx_labs_feature_feature_sliding_sync", "true");
        }, proxyAddress);
        await page.goto("/");
        await page.waitForSelector(".mx_MatrixChat", { timeout: 30000 });
        await use(proxyInstance);
        await proxy.stop();
    },

    // eslint-disable-next-line no-empty-pattern
    webserver: async ({}, use) => {
        const webserver = new Webserver();
        await use(webserver);
        webserver.stop();
    },
});

export const expect = baseExpect.extend({
    async toMatchScreenshot(
        this: ExpectMatcherState,
        receiver: Page | Locator,
        name?: `${string}.png`,
        options?: {
            mask?: Array<Locator>;
            omitBackground?: boolean;
            timeout?: number;
            css?: string;
        },
    ) {
        const page = "page" in receiver ? receiver.page() : receiver;

        // We add a custom style tag before taking screenshots
        const style = (await page.addStyleTag({
            content: `
                .mx_MessagePanel_myReadMarker {
                    display: none !important;
                }
                .mx_RoomView_MessageList {
                    height: auto !important;
                }
                .mx_DisambiguatedProfile_displayName {
                    color: var(--cpd-color-blue-1200) !important;
                }
                .mx_BaseAvatar {
                    background-color: var(--cpd-color-fuchsia-1200) !important;
                    color: white !important;
                }
                .mx_ReplyChain {
                    border-left-color: var(--cpd-color-blue-1200) !important;
                }
                /* Use monospace font for timestamp for consistent mask width */
                .mx_MessageTimestamp {
                    font-family: Inconsolata !important;
                }
                ${options?.css ?? ""}
            `,
        })) as ElementHandle<Element>;

        await baseExpect(receiver).toHaveScreenshot(name, options);

        await style.evaluate((tag) => tag.remove());
        return { pass: true, message: () => "", name: "toMatchScreenshot" };
    },
});

test.use({
    permissions: ["clipboard-read"],
});

/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import { test as base, expect as baseExpect, Locator, Page, ExpectMatcherState, ElementHandle } from "@playwright/test";
import { sanitizeForFilePath } from "playwright-core/lib/utils";
import AxeBuilder from "@axe-core/playwright";
import _ from "lodash";
import { basename, extname } from "node:path";

import type mailhog from "mailhog";
import type { IConfigOptions } from "../src/IConfigOptions";
import { Credentials, Homeserver, HomeserverInstance, StartHomeserverOpts } from "./plugins/homeserver";
import { Synapse } from "./plugins/homeserver/synapse";
import { Dendrite, Pinecone } from "./plugins/homeserver/dendrite";
import { Instance, MailHogServer } from "./plugins/mailhog";
import { ElementAppPage } from "./pages/ElementAppPage";
import { OAuthServer } from "./plugins/oauth_server";
import { Crypto } from "./pages/crypto";
import { Toasts } from "./pages/toasts";
import { Bot, CreateBotOpts } from "./pages/bot";
import { ProxyInstance, SlidingSyncProxy } from "./plugins/sliding-sync-proxy";
import { Webserver } from "./plugins/webserver";

// Enable experimental service worker support
// See https://playwright.dev/docs/service-workers-experimental#how-to-enable
process.env["PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS"] = "1";

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

    features: {
        // We don't want to go through the feature announcement during the e2e test
        feature_release_announcement: false,
    },
};

interface CredentialsWithDisplayName extends Credentials {
    displayName: string;
}

export const test = base.extend<{
    axe: AxeBuilder;
    checkA11y: () => Promise<void>;

    /**
     * The contents of the config.json to send when the client requests it.
     */
    config: typeof CONFIG_JSON;

    /**
     * The options with which to run the {@link #homeserver} fixture.
     */
    startHomeserverOpts: StartHomeserverOpts | string;

    homeserver: HomeserverInstance;
    oAuthServer: { port: number };

    /**
     * The displayname to use for the user registered in {@link #credentials}.
     *
     * To set it, call `test.use({ displayName: "myDisplayName" })` in the test file or `describe` block.
     * See {@link https://playwright.dev/docs/api/class-test#test-use}.
     */
    displayName?: string;

    /**
     * A test fixture which registers a test user on the {@link #homeserver} and supplies the details
     * of the registered user.
     */
    credentials: CredentialsWithDisplayName;

    /**
     * The same as {@link https://playwright.dev/docs/api/class-fixtures#fixtures-page|`page`},
     * but adds an initScript which will populate localStorage with the user's details from
     * {@link #credentials} and {@link #homeserver}.
     *
     * Similar to {@link #user}, but doesn't load the app.
     */
    pageWithCredentials: Page;

    /**
     * A (rather poorly-named) test fixture which registers a user per {@link #credentials}, stores
     * the credentials into localStorage per {@link #homeserver}, and then loads the front page of the
     * app.
     */
    user: CredentialsWithDisplayName;

    /**
     * The same as {@link https://playwright.dev/docs/api/class-fixtures#fixtures-page|`page`},
     * but wraps the returned `Page` in a class of utilities for interacting with the Element-Web UI,
     * {@link ElementAppPage}.
     */
    app: ElementAppPage;

    mailhog: { api: mailhog.API; instance: Instance };
    crypto: Crypto;
    room?: { roomId: string };
    toasts: Toasts;
    uut?: Locator; // Unit Under Test, useful place to refer a prepared locator
    botCreateOpts: CreateBotOpts;
    bot: Bot;
    slidingSyncProxy: ProxyInstance;
    labsFlags: string[];
    webserver: Webserver;
}>({
    config: CONFIG_JSON,
    page: async ({ context, page, config, labsFlags }, use) => {
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

    pageWithCredentials: async ({ page, homeserver, credentials }, use) => {
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
        await use(page);
    },

    user: async ({ pageWithCredentials: page, credentials }, use) => {
        await page.goto("/");
        await page.waitForSelector(".mx_MatrixChat", { timeout: 30000 });
        await use(credentials);
    },

    axe: async ({ page }, use) => {
        await use(new AxeBuilder({ page }).exclude("[data-floating-ui-portal]"));
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

    // eslint-disable-next-line no-empty-pattern
    mailhog: async ({}, use) => {
        const mailhog = new MailHogServer();
        const instance = await mailhog.start();
        await use(instance);
        await mailhog.stop();
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

// Based on https://github.com/microsoft/playwright/blob/2b77ed4d7aafa85a600caa0b0d101b72c8437eeb/packages/playwright/src/util.ts#L206C8-L210C2
function sanitizeFilePathBeforeExtension(filePath: string): string {
    const ext = extname(filePath);
    const base = filePath.substring(0, filePath.length - ext.length);
    return sanitizeForFilePath(base) + ext;
}

export const expect = baseExpect.extend({
    async toMatchScreenshot(
        this: ExpectMatcherState,
        receiver: Page | Locator,
        name: `${string}.png`,
        options?: {
            mask?: Array<Locator>;
            includeDialogBackground?: boolean;
            showTooltips?: boolean;
            timeout?: number;
            css?: string;
        },
    ) {
        const testInfo = test.info();
        if (!testInfo) throw new Error(`toMatchScreenshot() must be called during the test`);

        const page = "page" in receiver ? receiver.page() : receiver;

        let css = `
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
            /* Avoid flakiness from hover styling */
            .mx_ReplyChain_show {
                color: var(--cpd-color-text-secondary) !important;
            }
            /* Use monospace font for timestamp for consistent mask width */
            .mx_MessageTimestamp {
                font-family: Inconsolata !important;
            }
        `;

        if (!options?.showTooltips) {
            css += `
                [data-floating-ui-portal],
                [role="tooltip"] {
                    visibility: hidden !important;
                }
            `;
        }

        if (!options?.includeDialogBackground) {
            css += `
                /* Make the dialog backdrop solid so any dialog screenshots don't show any components behind them */
                .mx_Dialog_background {
                    background-color: #030c1b !important;
                }
            `;
        }

        if (options?.css) {
            css += options.css;
        }

        // We add a custom style tag before taking screenshots
        const style = (await page.addStyleTag({
            content: css,
        })) as ElementHandle<Element>;

        const screenshotName = sanitizeFilePathBeforeExtension(name);
        await baseExpect(receiver).toHaveScreenshot(screenshotName, options);

        await style.evaluate((tag) => tag.remove());

        testInfo.annotations.push({
            // `_` prefix hides it from the HTML reporter
            type: "_screenshot",
            // include a path relative to `playwright/snapshots/`
            description: testInfo.snapshotPath(screenshotName).split("/playwright/snapshots/", 2)[1],
        });

        return { pass: true, message: () => "", name: "toMatchScreenshot" };
    },
});

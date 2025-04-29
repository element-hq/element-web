/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {
    type ExpectMatcherState,
    type MatcherReturnType,
    type Page,
    type Locator,
    type PlaywrightTestArgs,
    type Fixtures as _Fixtures,
} from "@playwright/test";
import {
    type TestFixtures as BaseTestFixtures,
    expect as baseExpect,
    type ToMatchScreenshotOptions,
} from "@element-hq/element-web-playwright-common";

import type { IConfigOptions } from "../src/IConfigOptions";
import { type Credentials } from "./plugins/homeserver";
import { ElementAppPage } from "./pages/ElementAppPage";
import { Crypto } from "./pages/crypto";
import { Toasts } from "./pages/toasts";
import { Bot, type CreateBotOpts } from "./pages/bot";
import { Webserver } from "./plugins/webserver";
import { type WorkerOptions, type Services, test as base } from "./services";

// Enable experimental service worker support
// See https://playwright.dev/docs/service-workers-experimental#how-to-enable
process.env["PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS"] = "1";

declare module "@element-hq/element-web-playwright-common" {
    // Improve the type for the config fixture based on the real type
    export interface Config extends Omit<IConfigOptions, "default_server_config"> {}
}

export interface CredentialsWithDisplayName extends Credentials {
    displayName: string;
}

export interface TestFixtures extends BaseTestFixtures {
    /**
     * The same as {@link https://playwright.dev/docs/api/class-fixtures#fixtures-page|`page`},
     * but wraps the returned `Page` in a class of utilities for interacting with the Element-Web UI,
     * {@link ElementAppPage}.
     */
    app: ElementAppPage;

    crypto: Crypto;
    room?: { roomId: string };
    toasts: Toasts;
    uut?: Locator; // Unit Under Test, useful place to refer a prepared locator
    botCreateOpts: CreateBotOpts;
    bot: Bot;
    webserver: Webserver;
}

type CombinedTestFixtures = PlaywrightTestArgs & TestFixtures;
export type Fixtures = _Fixtures<CombinedTestFixtures, Services & WorkerOptions, CombinedTestFixtures>;
export const test = base.extend<TestFixtures>({
    context: async ({ context }, use, testInfo) => {
        // We skip tests instead of using grep-invert to still surface the counts in the html report
        test.skip(
            testInfo.tags.includes(`@no-${testInfo.project.name.toLowerCase()}`),
            `Test does not work on ${testInfo.project.name}`,
        );
        await use(context);
    },

    axe: async ({ axe }, use) => {
        // Exclude floating UI for now
        await use(axe.exclude("[data-floating-ui-portal]"));
    },

    app: async ({ page }, use) => {
        const app = new ElementAppPage(page);
        await use(app);
        await app.cleanup();
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
    webserver: async ({}, use) => {
        const webserver = new Webserver();
        await use(webserver);
        webserver.stop();
    },
});

interface ExtendedToMatchScreenshotOptions extends ToMatchScreenshotOptions {
    includeDialogBackground?: boolean;
    showTooltips?: boolean;
    timeout?: number;
}

type Expectations = {
    toMatchScreenshot: (
        this: ExpectMatcherState,
        receiver: Page | Locator,
        name: `${string}.png`,
        options?: ExtendedToMatchScreenshotOptions,
    ) => Promise<MatcherReturnType>;
};

export const expect = baseExpect.extend<Expectations>({
    async toMatchScreenshot(receiver, name, options) {
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

        await baseExpect(receiver).toMatchScreenshot(name, {
            ...options,
            css,
        });

        return { pass: true, message: () => "", name: "toMatchScreenshot" };
    },
});

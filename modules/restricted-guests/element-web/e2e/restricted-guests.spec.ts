/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {
    type MasConfig,
    type StartedMatrixAuthenticationServiceContainer,
    type StartedSynapseContainer,
    type SynapseContainer,
} from "@element-hq/element-web-playwright-common/lib/testcontainers/index.js";
import { type Credentials } from "@element-hq/element-web-playwright-common/lib/utils/api";
import { makePostgres } from "@element-hq/element-web-playwright-common/lib/testcontainers/postgres.js";
import { makeMas } from "@element-hq/element-web-playwright-common/lib/testcontainers/mas.js";

import { RestrictedGuestsSynapseContainer, RestrictedGuestsSynapseWithMasContainer } from "./services";
import { test as subBase, expect } from "../../../../playwright/element-web-test";

const MAS_CLIENT_ID = "01ARZ3NDEKTSV4RRFFQ69G5FAV";
const MAS_CLIENT_SECRET = "restricted-guests-secret";
const MAS_SHARED_SECRET = "restricted-guests-shared-secret";
const MAS_INTERNAL_URL = "http://guest-mas:8080";
const GUEST_HOMESERVER_NAME = "guest-homeserver";

const MAS_HTTP_LISTENERS: NonNullable<MasConfig["http"]>["listeners"] = [
    {
        name: "web",
        resources: [
            { name: "discovery" },
            { name: "human" },
            { name: "oauth" },
            { name: "compat" },
            { name: "graphql" },
            { name: "assets" },
            { name: "adminapi" },
        ],
        binds: [
            {
                address: "[::]:8080",
            },
        ],
        proxy_protocol: false,
    },
    {
        name: "internal",
        resources: [
            {
                name: "health",
            },
        ],
        binds: [
            {
                address: "[::]:8081",
            },
        ],
        proxy_protocol: false,
    },
];

const BASE_MAS_CONFIG: Partial<MasConfig> = {
    http: {
        listeners: MAS_HTTP_LISTENERS,
        public_base: "",
    },
    policy: {
        data: {
            admin_clients: [MAS_CLIENT_ID],
            client_registration: {
                allow_insecure_uris: true,
            },
        },
    },
    clients: [
        {
            client_id: MAS_CLIENT_ID,
            client_auth_method: "client_secret_basic",
            client_secret: MAS_CLIENT_SECRET,
        },
    ],
};

declare module "@element-hq/element-web-module-api" {
    export interface Config {
        embedded_pages?: {
            login_for_welcome?: boolean;
        };
    }
}

// We do some wacky things here in order to run the test suite against multiple homeserver configurations
const base = subBase.extend<
    {
        testRoomId: string;
    },
    {
        auth: "mas" | "legacy";

        bot: Credentials;
        guestMas?: StartedMatrixAuthenticationServiceContainer;
        guestHomeserver: StartedSynapseContainer;
    }
>({
    testRoomId: [
        async ({ homeserver, bot }, use) => {
            const { room_id: roomId } = (await homeserver.csApi.request("POST", "/v3/createRoom", bot.accessToken, {
                name: "Test room",
                preset: "public_chat",
                topic: "All about happy hour",
                initial_state: [
                    {
                        // This is required to allow guests to join the room with this Synapse module
                        type: "m.room.join_rule",
                        state_key: "",
                        content: { join_rule: "knock" },
                    },
                ],
            })) as { room_id: string };
            await use(roomId);
        },
        { scope: "test" },
    ],
    bot: [
        async ({ homeserver }, use) => {
            const bot = await homeserver.registerUser("bot", "pAs5w0rD!", "Bot");
            await use(bot);
        },
        { scope: "worker" },
    ],

    auth: ["mas", { scope: "worker" }],
    // Optional MAS on the default homeserver, enabled only when we are testing the non-guest login UX
    mas: [
        async ({ logger, network, postgres, auth, synapseConfig }, use) => {
            if (auth !== "mas" || synapseConfig.allow_guest_access !== false) {
                return use(undefined);
            }
            const container = await makeMas(
                postgres,
                network,
                logger,
                {
                    ...BASE_MAS_CONFIG,
                    matrix: {
                        kind: "synapse",
                        homeserver: "homeserver",
                        endpoint: "http://homeserver:8008",
                        secret: MAS_SHARED_SECRET,
                    },
                },
                "mas",
            );
            await use(container);
            await container.stop();
        },
        { scope: "worker" },
    ],
    // Optional MAS on the module homeserver
    guestMas: [
        async ({ logger, network, auth }, use) => {
            if (auth !== "mas") {
                return use(undefined);
            }

            // We need a separate postgres so it doesn't fight with the default MAS
            const postgres = await makePostgres(network, logger, "guest-mas-postgres");

            const container = await makeMas(
                postgres,
                network,
                logger,
                {
                    ...BASE_MAS_CONFIG,
                    matrix: {
                        kind: "synapse",
                        homeserver: GUEST_HOMESERVER_NAME,
                        endpoint: "http://guest-homeserver:8008",
                        secret: MAS_SHARED_SECRET,
                    },
                },
                "guest-mas",
            );
            await use(container);
            await container.stop();
            await postgres.stop();
        },
        { scope: "worker" },
    ],
    // Module homeserver
    guestHomeserver: [
        async ({ logger, synapseConfig, network, guestMas }, use) => {
            let container: SynapseContainer;
            if (guestMas) {
                container = new RestrictedGuestsSynapseWithMasContainer({
                    adminApiBaseUrl: MAS_INTERNAL_URL,
                    oauthBaseUrl: MAS_INTERNAL_URL,
                    clientId: MAS_CLIENT_ID,
                    clientSecret: MAS_CLIENT_SECRET,
                }).withMatrixAuthenticationService(guestMas);
            } else {
                container = new RestrictedGuestsSynapseContainer();
            }

            const startedContainer = await container
                .withConfig(synapseConfig)
                .withConfig({
                    server_name: GUEST_HOMESERVER_NAME,
                })
                .withNetwork(network)
                .withNetworkAliases(GUEST_HOMESERVER_NAME)
                .withLogConsumer(logger.getConsumer("guest_homeserver"))
                .start();

            await use(startedContainer);
            await startedContainer.stop();
        },
        { scope: "worker" },
    ],
    displayName: "Tommy",
    labsFlags: ["feature_ask_to_join"],
    config: {
        embedded_pages: {
            login_for_welcome: true,
        },
    },
});

base.slow();
for (const auth of ["mas", "legacy"] as const) {
    for (const guestsEnabled of [true, false]) {
        const test = base.extend({
            auth,
            synapseConfig: {
                allow_guest_access: guestsEnabled,
            },
        });

        test.describe(`Restricted guests auth=${auth} guests=${guestsEnabled}`, () => {
            test("should error if config is missing", async ({ page }) => {
                await page.goto("/");
                await expect(page.getByText("Your Element is misconfigured")).toBeVisible();
                await expect(page.getByText("Errors in module configuration")).toBeVisible();
            });

            test.describe("with config", () => {
                test.beforeEach(async ({ config, guestHomeserver, page, testRoomId }) => {
                    config["io.element.element-web-modules.restricted-guests"] = {
                        guest_user_homeserver_url: guestHomeserver.baseUrl,
                    };
                    // Go to a room we are not a member of
                    await page.goto(`/#/room/${testRoomId}`);
                });

                if (guestsEnabled) {
                    // The screenshots between the two auth type tests for guests should be identical.
                    test(
                        "should show the default room preview bar for logged in users",
                        { tag: ["@screenshot"] },
                        async ({ page, user, testRoomId }) => {
                            // Go to a room we are not a member of
                            await page.goto(`/#/room/${testRoomId}`);
                            const button = page.getByRole("button", { name: "Join the discussion" });
                            await expect(button).toBeVisible();
                        },
                    );

                    test(
                        "should show the module's room preview bar for guests",
                        { tag: ["@screenshot"] },
                        async ({ page }) => {
                            const button = page.getByRole("button", { name: "Join as guest", exact: true });
                            await expect(button).toBeVisible();
                            await expect(page.locator(".mx_RoomPreviewBar")).toMatchScreenshot(`preview-bar.png`);

                            await button.click();
                            const dialog = page.getByRole("dialog");
                            await expect(dialog).toMatchScreenshot(`dialog.png`);

                            await dialog.getByPlaceholder("Name").fill("Jim");
                            await dialog.getByRole("button", { name: "Continue as guest" }).click();

                            await expect(page.getByText("Ask to join?")).toBeVisible();
                        },
                    );
                } else {
                    test("should show the module login ux", { tag: ["@screenshot"] }, async ({ page }) => {
                        const button = page.getByRole("button", { name: "Join as guest", exact: true });
                        await expect(button).toBeVisible();
                        await expect(page.getByRole("main")).toMatchScreenshot(`login-${auth}.png`);

                        await button.click();
                        const dialog = page.getByRole("dialog");
                        await expect(dialog).toMatchScreenshot(`dialog.png`);

                        await dialog.getByPlaceholder("Name").fill("Jim");
                        await dialog.getByRole("button", { name: "Continue as guest" }).click();

                        await expect(page.getByText("Join the discussion")).toBeVisible();
                    });
                }
            });
        });
    }
}

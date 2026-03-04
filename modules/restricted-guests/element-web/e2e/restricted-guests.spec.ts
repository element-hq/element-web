/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {
    MatrixAuthenticationServiceContainer,
    type MasConfig,
    type StartedMatrixAuthenticationServiceContainer,
    type StartedSynapseContainer,
    type SynapseConfig,
} from "@element-hq/element-web-playwright-common/lib/testcontainers/index.js";
import type { Credentials } from "@element-hq/element-web-playwright-common/lib/utils/api";
import type { Fixtures } from "@playwright/test";

import { test as base, expect } from "../../../../playwright/element-web-test";
import { RestrictedGuestsSynapseContainer, RestrictedGuestsSynapseWithMasContainer } from "./services";

const MAS_CLIENT_ID = "01ARZ3NDEKTSV4RRFFQ69G5FAV";
const MAS_CLIENT_SECRET = "restricted-guests-secret";
const MAS_SHARED_SECRET = "restricted-guests-shared-secret";
const MAS_INTERNAL_URL = "http://mas:8080";
const GUEST_HOMESERVER_NAME = "guest-homeserver";
const GUEST_HOMESERVER_INTERNAL_URL = "http://guest-homeserver:8008";

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

const MAS_CONFIG: Partial<MasConfig> = {
    http: {
        listeners: MAS_HTTP_LISTENERS,
        public_base: "",
    },
    matrix: {
        kind: "synapse",
        homeserver: GUEST_HOMESERVER_NAME,
        endpoint: GUEST_HOMESERVER_INTERNAL_URL,
        secret: MAS_SHARED_SECRET,
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

const applySharedTestConfig = (testInstance: typeof base) => {
    testInstance.use({
        displayName: "Tommy",
        synapseConfig: {
            allow_guest_access: true,
        },
        labsFlags: ["feature_ask_to_join"],
    });
};

const sharedFixtures: Fixtures<{ testRoomId: string }, { bot: Credentials }, any, any> = {
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
};

const test = base.extend<
    {
        testRoomId: string;
    },
    {
        guestHomeserver: StartedSynapseContainer;
        bot: Credentials;
    }
>({
    ...sharedFixtures,
    guestHomeserver: [
        async ({ logger, synapseConfig, network }, use) => {
            const container = await new RestrictedGuestsSynapseContainer()
                .withConfig(synapseConfig)
                .withConfig({ server_name: GUEST_HOMESERVER_NAME })
                .withNetwork(network)
                .withNetworkAliases(GUEST_HOMESERVER_NAME)
                .withLogConsumer(logger.getConsumer("guest_homeserver"))
                .start();

            await use(container);
            await container.stop();
        },
        { scope: "worker" },
    ],
});

const masTest = base.extend<
    {
        testRoomId: string;
    },
    {
        guestHomeserver: StartedSynapseContainer;
        guestMas: StartedMatrixAuthenticationServiceContainer;
        bot: Credentials;
    }
>({
    ...sharedFixtures,
    guestMas: [
        async ({ logger, network, postgres }, use) => {
            const container = await new MatrixAuthenticationServiceContainer(postgres)
                .withNetwork(network)
                .withNetworkAliases("mas")
                .withLogConsumer(logger.getConsumer("guest_mas"))
                .withConfig(MAS_CONFIG)
                .start();

            await use(container);
            await container.stop();
        },
        { scope: "worker" },
    ],
    guestHomeserver: [
        async ({ logger, synapseConfig, network, guestMas }, use) => {
            const container = await new RestrictedGuestsSynapseWithMasContainer({
                adminApiBaseUrl: MAS_INTERNAL_URL,
                oauthBaseUrl: MAS_INTERNAL_URL,
                clientId: MAS_CLIENT_ID,
                clientSecret: MAS_CLIENT_SECRET,
            })
                .withConfig(synapseConfig)
                .withConfig({
                    server_name: GUEST_HOMESERVER_NAME,
                    matrix_authentication_service: {
                        enabled: true,
                        endpoint: `${MAS_INTERNAL_URL}/`,
                        secret: MAS_SHARED_SECRET,
                    },
                    // Must be disabled when using MAS.
                    password_config: {
                        enabled: false,
                    },
                    // Must be disabled when using MAS.
                    enable_registration: false,
                } as Partial<SynapseConfig>)
                .withMatrixAuthenticationService(guestMas)
                .withNetwork(network)
                .withNetworkAliases(GUEST_HOMESERVER_NAME)
                .withLogConsumer(logger.getConsumer("guest_homeserver"))
                .start();

            await use(container);
            await container.stop();
        },
        { scope: "worker" },
    ],
});

type RestrictedGuestsTestInstance = typeof test;

const defineRestrictedGuestsTests = (testInstance: RestrictedGuestsTestInstance, suiteName: string) => {
    applySharedTestConfig(testInstance);

    testInstance.describe(suiteName, () => {
        testInstance.use({
            page: async ({ page }, use) => {
                await page.goto("/");
                await use(page);
            },
        });

        testInstance("should error if config is missing", async ({ page }) => {
            await expect(page.getByText("Your Element is misconfigured")).toBeVisible();
            await expect(page.getByText("Errors in module configuration")).toBeVisible();
        });

        testInstance.describe("with config", () => {
            testInstance.beforeEach(({ config, guestHomeserver }) => {
                config["io.element.element-web-modules.restricted-guests"] = {
                    guest_user_homeserver_url: guestHomeserver.baseUrl,
                };
            });

            testInstance(
                "should show the default room preview bar for logged in users",
                { tag: ["@screenshot"] },
                async ({ page, user, testRoomId }) => {
                    // Go to a room we are not a member of
                    await page.goto(`/#/room/${testRoomId}`);

                    const button = page.getByRole("button", { name: "Join the discussion" });
                    await expect(button).toBeVisible();
                },
            );

            testInstance(
                "should show the module's room preview bar for guests",
                { tag: ["@screenshot"] },
                async ({ page, testRoomId }) => {
                    // Go to a room we are not a member of
                    await page.goto(`/#/room/${testRoomId}`);

                    const button = page.getByRole("button", { name: "Join", exact: true });
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
        });
    });
};

// The screenshots between the two tests should be identical.
defineRestrictedGuestsTests(test, "Restricted Guests");
defineRestrictedGuestsTests(masTest as RestrictedGuestsTestInstance, "Restricted Guests (MAS)");

/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { StartedSynapseContainer } from "@element-hq/element-web-playwright-common/lib/testcontainers";
import { Credentials } from "@element-hq/element-web-playwright-common/lib/utils/api.ts";

import { test as base, expect } from "../../../../playwright/element-web-test.ts";
import { RestrictedGuestsSynapseContainer } from "./services.ts";

const test = base.extend<
    {
        testRoomId: string;
    },
    {
        guestHomeserver: StartedSynapseContainer;
        bot: Credentials;
    }
>({
    testRoomId: [
        async ({ homeserver, bot }, use) => {
            const { room_id: roomId } = await homeserver.csApi.request<{ room_id: string }>(
                "POST",
                "/v3/createRoom",
                bot.accessToken,
                {
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
                },
            );
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
    guestHomeserver: [
        async ({ logger, synapseConfig, network }, use) => {
            const container = await new RestrictedGuestsSynapseContainer()
                .withConfig(synapseConfig)
                .withConfig({ server_name: "guest-homeserver" })
                .withNetwork(network)
                .withNetworkAliases("guest-homeserver")
                .withLogConsumer(logger.getConsumer("guest_homeserver"))
                .start();

            await use(container);
            await container.stop();
        },
        { scope: "worker" },
    ],
});

test.use({
    displayName: "Tommy",
    synapseConfig: {
        allow_guest_access: true,
    },
    labsFlags: ["feature_ask_to_join"],
});

test.describe("Restricted Guests", () => {
    test.use({
        page: async ({ page, homeserver, guestHomeserver }, use) => {
            await page.goto("/");
            await use(page);
        },
    });

    test("should error if config is missing", async ({ page }) => {
        await expect(page.getByText("Your Element is misconfigured")).toBeVisible();
        await expect(page.getByText("Errors in module configuration")).toBeVisible();
    });

    test.describe("with config", () => {
        test.beforeEach(({ config, guestHomeserver }) => {
            config["io.element.element-web-modules.restricted-guests"] = {
                guest_user_homeserver_url: guestHomeserver.baseUrl,
            };
        });

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
            async ({ page, testRoomId }) => {
                // Go to a room we are not a member of
                await page.goto(`/#/room/${testRoomId}`);

                const button = page.getByRole("button", { name: "Join", exact: true });
                await expect(button).toBeVisible();
                await expect(page.locator(".mx_RoomPreviewBar")).toMatchScreenshot("preview-bar.png");

                await button.click();
                const dialog = page.getByRole("dialog");
                await expect(dialog).toMatchScreenshot("dialog.png");

                await dialog.getByPlaceholder("Name").fill("Jim");
                await dialog.getByRole("button", { name: "Continue as guest" }).click();

                await expect(page.getByText("Ask to join?")).toBeVisible();
            },
        );
    });
});

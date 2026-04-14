/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type SynapseContainer } from "@element-hq/element-web-playwright-common/lib/testcontainers/index.js";

import { test, expect } from "../../../../playwright/element-web-test.ts";

declare module "@element-hq/element-web-module-api" {
    interface Config {
        "io.element.element-web-modules.widget-lifecycle": {
            widget_permissions: {
                [url: string]: {
                    preload_approved?: boolean;
                    identity_approved?: boolean;
                    capabilities_approved?: string[];
                };
            };
        };
    }
}

const WIDGET_URL = "http://localhost:8080/widget.html";

test.use({
    displayName: "Timmy",
    synapseConfig: async ({ synapseConfig, _homeserver: homeserver }, use) => {
        (homeserver as SynapseContainer).withConfigField("listeners[0].resources[0].names", ["client", "openid"]);
        await use(synapseConfig);
    },
    page: async ({ context, page, moduleDir }, use) => {
        await context.route(`${WIDGET_URL}*`, async (route) => {
            await route.fulfill({ path: `${moduleDir}/e2e/fixture/widget.html`, contentType: "text/html" });
        });

        await page.goto("/");
        await use(page);
    },
    bypassCSP: true,
    launchOptions: {
        args: ["--disable-web-security"],
    },
});

test.describe("Widget Lifecycle", () => {
    test.describe("trusted widgets", () => {
        // Configure the module to pre-approve the widget URL for preloading, identity tokens,
        // and the m.room.topic state event capability.
        test.use({
            config: {
                "io.element.element-web-modules.widget-lifecycle": {
                    widget_permissions: {
                        [`${WIDGET_URL}*`]: {
                            preload_approved: true,
                            identity_approved: true,
                            capabilities_approved: ["org.matrix.msc2762.receive.state_event:m.room.topic"],
                        },
                    },
                },
            },
        });

        test("auto-approves preload and identity", async ({ page, user, homeserver, toasts }, testInfo) => {
            toasts.rejectToastIfExists("Verify this device");

            // A bot creates a room with the widget pinned to the top panel, then invites the test user.
            // Because the widget was added by a different user (the bot), Element would normally show a
            // preload consent dialog before loading it — this test verifies that dialog is skipped.
            const bot = await homeserver.registerUser(`bot_${testInfo.testId}`, "password", "Bot");
            const { room_id: roomId } = await homeserver.csApi.request<{ room_id: string }>(
                "POST",
                "/v3/createRoom",
                bot.accessToken,
                {
                    name: "Trusted Widget",
                },
            );
            await homeserver.csApi.request<{ event_id: string }>(
                "PUT",
                `/v3/rooms/${encodeURIComponent(roomId)}/state/im.vector.modular.widgets/1`,
                bot.accessToken,
                {
                    id: "1",
                    creatorUserId: bot.userId,
                    type: "custom",
                    name: "Trusted Widget",
                    url: `${WIDGET_URL}?hsUrl=${encodeURIComponent(homeserver.baseUrl)}&caps=org.matrix.msc2762.receive.state_event:m.room.topic`,
                },
            );
            await homeserver.csApi.request(
                "PUT",
                `/v3/rooms/${encodeURIComponent(roomId)}/state/io.element.widgets.layout/`,
                bot.accessToken,
                {
                    widgets: {
                        "1": {
                            container: "top",
                        },
                    },
                },
            );
            await homeserver.csApi.request("POST", `/v3/rooms/${encodeURIComponent(roomId)}/invite`, bot.accessToken, {
                user_id: user.userId,
            });

            await page.getByText("Trusted Widget").click();
            await page.getByRole("button", { name: "Accept" }).click();

            // No preload dialog should appear — the widget loads immediately.
            await expect(page.getByRole("button", { name: "Continue" })).not.toBeVisible();

            // The widget greets the user by ID, proving the identity token was also auto-approved
            // and passed to the widget without any consent prompts.
            await expect(
                page
                    .frameLocator('iframe[title="Trusted Widget"]')
                    .getByRole("heading", { name: `Hello ${user.userId}!` }),
            ).toBeVisible();
        });

        test("prompts for capabilities not in the allowlist", async ({ page, user, homeserver, toasts }, testInfo) => {
            toasts.rejectToastIfExists("Verify this device");

            const bot = await homeserver.registerUser(`bot_${testInfo.testId}`, "password", "Bot");
            const { room_id: roomId } = await homeserver.csApi.request<{ room_id: string }>(
                "POST",
                "/v3/createRoom",
                bot.accessToken,
                {
                    name: "Capabilities Widget",
                },
            );
            // The widget requests two capabilities: m.room.topic (in the allowlist) and m.room.name (not in the allowlist).
            await homeserver.csApi.request<{ event_id: string }>(
                "PUT",
                `/v3/rooms/${encodeURIComponent(roomId)}/state/im.vector.modular.widgets/1`,
                bot.accessToken,
                {
                    id: "1",
                    creatorUserId: bot.userId,
                    type: "custom",
                    name: "Capabilities Widget",
                    url: `${WIDGET_URL}?hsUrl=${encodeURIComponent(homeserver.baseUrl)}&caps=org.matrix.msc2762.receive.state_event:m.room.topic,org.matrix.msc2762.receive.state_event:m.room.name`,
                },
            );
            await homeserver.csApi.request(
                "PUT",
                `/v3/rooms/${encodeURIComponent(roomId)}/state/io.element.widgets.layout/`,
                bot.accessToken,
                {
                    widgets: {
                        "1": {
                            container: "top",
                        },
                    },
                },
            );
            await homeserver.csApi.request("POST", `/v3/rooms/${encodeURIComponent(roomId)}/invite`, bot.accessToken, {
                user_id: user.userId,
            });

            await page.getByText("Capabilities Widget").click();
            await page.getByRole("button", { name: "Accept" }).click();

            // A capabilities approval dialog should appear since m.room.name was not pre-approved.
            await expect(page.getByRole("button", { name: "Approve" })).toBeVisible();
        });
    });

    test.describe("untrusted widgets", () => {
        // No widget URLs are pre-approved, so all lifecycle prompts should be shown to the user.
        test.use({
            config: {
                "io.element.element-web-modules.widget-lifecycle": {
                    widget_permissions: {},
                },
            },
        });

        test("shows preload, capabilities, and OpenID dialogs for untrusted widgets", async ({
            page,
            user,
            homeserver,
            toasts,
        }, testInfo) => {
            toasts.rejectToastIfExists("Verify this device");

            const bot = await homeserver.registerUser(`bot_${testInfo.testId}`, "password", "Bot");
            const { room_id: roomId } = await homeserver.csApi.request<{ room_id: string }>(
                "POST",
                "/v3/createRoom",
                bot.accessToken,
                {
                    name: "Untrusted Widget",
                },
            );
            await homeserver.csApi.request<{ event_id: string }>(
                "PUT",
                `/v3/rooms/${encodeURIComponent(roomId)}/state/im.vector.modular.widgets/1`,
                bot.accessToken,
                {
                    id: "1",
                    creatorUserId: bot.userId,
                    type: "custom",
                    name: "Untrusted Widget",
                    url: `${WIDGET_URL}?hsUrl=${encodeURIComponent(homeserver.baseUrl)}&caps=org.matrix.msc2762.receive.state_event:m.room.topic`,
                },
            );
            await homeserver.csApi.request(
                "PUT",
                `/v3/rooms/${encodeURIComponent(roomId)}/state/io.element.widgets.layout/`,
                bot.accessToken,
                {
                    widgets: {
                        "1": {
                            container: "top",
                        },
                    },
                },
            );
            await homeserver.csApi.request("POST", `/v3/rooms/${encodeURIComponent(roomId)}/invite`, bot.accessToken, {
                user_id: user.userId,
            });

            await page.getByText("Untrusted Widget").click();
            await page.getByRole("button", { name: "Accept" }).click();

            // 1. Preload consent dialog — shown because the widget was added by another user (the bot).
            await expect(page.getByRole("button", { name: "Continue" })).toBeVisible();
            await page.getByRole("button", { name: "Continue" }).click();

            // 2. Capabilities dialog — the widget requests m.room.topic once it loads.
            await expect(page.getByRole("button", { name: "Approve" })).toBeVisible();
            await page.getByRole("button", { name: "Approve" }).click();

            // 3. OpenID identity dialog — the widget requests an identity token after capabilities are granted.
            await expect(page.getByRole("button", { name: "Continue" })).toBeVisible();
        });
    });
});

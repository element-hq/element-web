/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { rejectToastIfExists } from "@element-hq/element-web-playwright-common";

import { test, expect, type TestFixtures } from "../../element-web-test";
import type { Page } from "@playwright/test";

const ONE_MINUTE = 60 * 1000;

async function checkRetentionInRoom(
    { bot, app, page }: Pick<TestFixtures, "app" | "bot"> & { page: Page },
    roomId: string,
) {
    // When the bot joins the room
    await bot.joinRoom(roomId);
    await app.viewRoomByName("Test");
    const tiles = (
        await Promise.all(Array.from({ length: 5 }).map((_o, index) => bot.sendMessage(roomId, `Message ${index}`)))
    ).map(({ event_id: evtId }) => page.locator(`.mx_RoomView_MessageList .mx_EventTile[data-event-id='${evtId}']`));
    for (const tile of tiles) {
        await expect(tile).toBeVisible();
    }
    await page.clock.fastForward(ONE_MINUTE + 1);
    for (const tile of tiles) {
        await expect(tile).toBeHidden();
    }
}

test.describe("Retention", () => {
    test.use({
        displayName: "Tom",
        botCreateOpts: {
            displayName: "Bob",
        },
        labsFlags: ["feature_retention"],
    });

    test.beforeEach(async ({ app, homeserver, page, user }) => {
        await rejectToastIfExists(page, "Verify this device");
        await rejectToastIfExists(page, "Notifications");
        await page.clock.install();
    });

    test("should apply retention to a bunch of messages", async ({ app, homeserver, page, user, bot }) => {
        const roomId = await app.client.createRoom({
            name: "Test",
            invite: [bot.credentials.userId],
            initial_state: [
                {
                    state_key: "",
                    type: "org.matrix.msc1763.retention",
                    content: {
                        max_lifetime: ONE_MINUTE,
                    },
                },
            ],
        });
        // When the bot joins the room
        await checkRetentionInRoom({ app, bot, page }, roomId);
    });

    test("global retention rules should apply ", async ({ app, bot, page }) => {
        await page.route("**/_matrix/client/unstable/org.matrix.msc1763/retention/configuration", (route) => {
            return route.fulfill({
                json: {
                    policies: {
                        "*": {
                            max_lifetime: ONE_MINUTE,
                        },
                    },
                },
            });
        });
        const roomId = await app.client.createRoom({
            name: "Test",
            invite: [bot.credentials.userId],
        });
        await checkRetentionInRoom({ app, bot, page }, roomId);
    });

    test("retention rules should apply after restart", async ({ app, bot, page }) => {
        const roomId = await app.client.createRoom({
            name: "Test",
            invite: [bot.credentials.userId],
        });
        await bot.joinRoom(roomId);
        await app.viewRoomByName("Test");
        const tiles = (
            await Promise.all(Array.from({ length: 5 }).map((_o, index) => bot.sendMessage(roomId, `Message ${index}`)))
        ).map(({ event_id: evtId }) =>
            page.locator(`.mx_RoomView_MessageList .mx_EventTile[data-event-id='${evtId}']`),
        );
        for (const tile of tiles) {
            await expect(tile).toBeVisible();
        }
        // Reload and apply new policy
        await page.reload();
        await page.clock.fastForward(ONE_MINUTE + 1);
        await page.route("**/_matrix/client/unstable/org.matrix.msc1763/retention/configuration", (route) => {
            return route.fulfill({
                json: {
                    policies: {
                        "*": {
                            max_lifetime: ONE_MINUTE,
                        },
                    },
                },
            });
        });
        await app.viewRoomByName("Test");
        for (const tile of tiles) {
            await expect(tile).toBeHidden();
        }
    });

    test("should stop applying retention when the policy is removed", async ({ app, homeserver, page, user, bot }) => {
        const currentTime = new Date();
        const roomId = await app.client.createRoom({
            name: "Test",
            invite: [bot.credentials.userId],
            initial_state: [
                {
                    state_key: "",
                    type: "org.matrix.msc1763.retention",
                    content: {
                        max_lifetime: ONE_MINUTE,
                    },
                },
            ],
        });
        // When the bot joins the room
        await checkRetentionInRoom({ app, bot, page }, roomId);

        // Check that retention rules no longer apply.
        await page.clock.setFixedTime(currentTime);
        const { event_id: eventId } = await bot.sendMessage(roomId, `Message afterwards`);
        await app.client.sendStateEvent(roomId, "org.matrix.msc1763.retention", {});
        await page.clock.fastForward(ONE_MINUTE + 1);
        await expect(page.locator(`.mx_RoomView_MessageList .mx_EventTile[data-event-id='${eventId}']`)).toBeVisible();
    });
});

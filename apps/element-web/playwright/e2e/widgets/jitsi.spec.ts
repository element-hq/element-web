/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { test as base, expect } from "../../element-web-test";
import { Bot } from "../../pages/bot";

const ROOM_NAME = "Jitsi Room";

const test = base.extend<{
    bot1: Bot;
    bot2: Bot;
}>({
    bot2: async ({ page, homeserver }, use, testInfo) => {
        const bot = new Bot(page, homeserver, { displayName: `ByteBot_${testInfo.testId}` });
        await bot.prepareClient(); // eagerly register the bot
        await use(bot);
    },
});

test.describe("Jitsi Calls", () => {
    test.use({
        displayName: "Jimmy",
        botCreateOpts: { displayName: "Bot", autoAcceptInvites: false },
    });

    test("should be able to pop out a jitsi widget", async ({ page, app, bot, bot2, context }) => {
        const roomId = await app.client.createRoom({
            name: ROOM_NAME,
            invite: [bot.credentials.userId, bot2.credentials.userId],
        });

        await bot.joinRoom(roomId);
        await bot2.joinRoom(roomId);

        // open the room
        await app.viewRoomByName(ROOM_NAME);

        await page.getByRole("button", { name: "Video call" }).click();

        const pagePromise = context.waitForEvent("page");

        await page.getByRole("button", { name: "Popout widget" }).click();

        const newPage = await pagePromise;
        await expect(newPage.getByRole("button", { name: "Join Conference" })).toBeVisible();
    });
});

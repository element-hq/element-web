/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { type Page } from "playwright-core";
import { type StartedHomeserverContainer } from "@element-hq/element-web-playwright-common/lib/testcontainers";

import { test, expect } from "../../element-web-test";
import { Bot } from "../../pages/bot";
import { type ElementAppPage } from "../../pages/ElementAppPage";
import { type Credentials } from "../../plugins/homeserver";

test.describe("Event List Summary", () => {
    test.use({
        displayName: "Finch",
    });

    test(
        "should display a single join message on its own",
        { tag: "@screenshot" },
        async ({ app, homeserver, page, user }) => {
            const { bot, roomId } = await setupRoom(app, homeserver, page, user);

            // When the bot joins the room
            await bot.joinRoom(roomId);

            // Then we say that in a generic event list summary
            await expect(
                page.locator(".mx_RoomView_body .mx_GenericEventListSummary[data-layout='group']", {
                    hasText: "MyBot joined the room",
                }),
            ).toBeVisible();

            await replaceBotIds(page, bot);
            await expect(page.locator(".mx_MainSplit")).toMatchScreenshot("bot_joined_the_room.png", ignoreTimestamps);
        },
    );

    test(
        "should display a single ban message on its own",
        { tag: "@screenshot" },
        async ({ app, homeserver, page, user }) => {
            const { bot, roomId } = await setupRoom(app, homeserver, page, user);

            // Given the bot is in the room
            await bot.joinRoom(roomId);
            await expect(
                page.locator(".mx_RoomView_body .mx_GenericEventListSummary[data-layout='group']", {
                    hasText: "MyBot joined the room",
                }),
            ).toBeVisible();

            // And we said something to separate out the messages
            await app.client.sendMessage(roomId, "Saying something");

            // When we ban the bot
            await app.client.ban(roomId, bot.credentials.userId);

            // Then we say that
            await expect(
                page.locator(".mx_RoomView_body .mx_GenericEventListSummary[data-layout='group']", {
                    hasText: "banned",
                }),
            ).toBeVisible();

            await replaceBotIds(page, bot);
            await expect(page.locator(".mx_MainSplit")).toMatchScreenshot("bot_was_banned.png", ignoreTimestamps);
        },
    );

    test(
        "should display multiple join/leave messages as a group",
        { tag: "@screenshot" },
        async ({ app, homeserver, page, user }) => {
            const { bot, roomId } = await setupRoom(app, homeserver, page, user);

            // Given the bot is in the room
            await bot.joinRoom(roomId);
            await expect(
                page.locator(".mx_RoomView_body .mx_GenericEventListSummary[data-layout='group']", {
                    hasText: "MyBot joined the room",
                }),
            ).toBeVisible();

            // When we perform multiple actions on it
            await app.client.kick(roomId, bot.credentials.userId);
            await app.client.inviteUser(roomId, bot.credentials.userId);
            await bot.joinRoom(roomId);

            // Then those actions are gathered into a single summary
            await expect(
                page.locator(".mx_RoomView_body .mx_GenericEventListSummary[data-layout='group']", {
                    hasText: "and joined",
                }),
            ).toBeVisible();

            await replaceBotIds(page, bot);
            await expect(page.locator(".mx_MainSplit")).toMatchScreenshot(
                "multiple_join_leave_messages.png",
                ignoreTimestamps,
            );
        },
    );

    test(
        "should display multiple messages as a group",
        { tag: "@screenshot" },
        async ({ app, homeserver, page, user }) => {
            const { bot, roomId } = await setupRoom(app, homeserver, page, user);

            // Given the bot is in the room
            await bot.joinRoom(roomId);
            await expect(
                page.locator(".mx_RoomView_body .mx_GenericEventListSummary[data-layout='group']", {
                    hasText: "MyBot joined the room",
                }),
            ).toBeVisible();

            // When we perform multiple actions on it, including a ban
            await app.client.ban(roomId, bot.credentials.userId);
            await app.client.unban(roomId, bot.credentials.userId);
            await app.client.inviteUser(roomId, bot.credentials.userId);
            await bot.joinRoom(roomId);

            // Then those actions are gathered into a single summary
            await expect(
                page.locator(".mx_RoomView_body .mx_GenericEventListSummary[data-layout='group']", {
                    hasText: "and joined",
                }),
            ).toBeVisible();

            await replaceBotIds(page, bot);
            await expect(page.locator(".mx_MainSplit")).toMatchScreenshot(
                "multiple_join_ban_messages.png",
                ignoreTimestamps,
            );
        },
    );

    test(
        "should display join/leave messages for multiple people as a group",
        { tag: "@screenshot" },
        async ({ app, homeserver, page, user }) => {
            const { bot, roomId } = await setupRoom(app, homeserver, page, user);

            // Given the bot is in the room
            const bot2 = new Bot(page, homeserver, {
                displayName: "MyBot2",
                autoAcceptInvites: false,
            });
            await bot2.prepareClient();
            await app.client.inviteUser(roomId, bot2.credentials.userId);
            await app.client.sendMessage(roomId, "I invited MyBot2...");
            await bot.joinRoom(roomId);
            await bot2.joinRoom(roomId);
            await expect(
                page.locator(".mx_RoomView_body .mx_GenericEventListSummary[data-layout='group']", {
                    hasText: "MyBot2 joined the room",
                }),
            ).toBeVisible();

            // When we perform multiple actions on both bots
            await app.client.kick(roomId, bot.credentials.userId);
            await app.client.kick(roomId, bot2.credentials.userId);
            await app.client.inviteUser(roomId, bot.credentials.userId);
            await app.client.inviteUser(roomId, bot2.credentials.userId);
            await bot.joinRoom(roomId);
            await bot2.joinRoom(roomId);

            // Then those actions are gathered into a single summary
            await expect(
                page.locator(".mx_RoomView_body .mx_GenericEventListSummary[data-layout='group']", {
                    hasText: "joined, were removed, were invited, and joined",
                }),
            ).toBeVisible();

            await expect(page.locator('div[aria-label="3 members"]')).toBeVisible();

            await replaceBotIds(page, bot, bot2);
            await expect(page.locator(".mx_MainSplit")).toMatchScreenshot(
                "multiple_people_join_leave_messages.png",
                ignoreTimestampsRightColumnAndHeader,
            );

            // And when we expand the summary
            // Note: we can't include "expand" in the screenshot because it
            // moves around, but at least we know it exists because we click it
            // here.
            await page.getByRole("button", { name: "expand" }).nth(3).click();

            // Then we see all the individual actions
            await expect(
                page.locator(".mx_RoomView_body .mx_GenericEventListSummary[data-layout='group']", {
                    hasText: "removed MyBot2",
                }),
            ).toBeVisible();

            await replaceBotIds(page, bot, bot2);
            await expect(page.locator(".mx_MainSplit")).toMatchScreenshot(
                "multiple_people_join_leave_messages_expanded.png",
                ignoreTimestampsRightColumnAndHeader,
            );
        },
    );

    test(
        "should display join/ban messages for multiple people as a group",
        { tag: "@screenshot" },
        async ({ app, homeserver, page, user }) => {
            const { bot, roomId } = await setupRoom(app, homeserver, page, user);

            // Given the bot is in the room
            const bot2 = new Bot(page, homeserver, {
                displayName: "MyBot2 with very long display name causing wrapping",
                autoAcceptInvites: false,
            });
            await bot2.prepareClient();
            await app.client.inviteUser(roomId, bot2.credentials.userId);
            await app.client.sendMessage(roomId, "I invited MyBot2...");
            await bot.joinRoom(roomId);
            await bot2.joinRoom(roomId);
            await expect(
                page.locator(".mx_RoomView_body .mx_GenericEventListSummary[data-layout='group']", {
                    hasText: "MyBot2 with very long display name causing wrapping joined the room",
                }),
            ).toBeVisible();

            // When we ban bot1 but not bot2
            await app.client.ban(roomId, bot.credentials.userId);
            await app.client.unban(roomId, bot.credentials.userId);
            await app.client.kick(roomId, bot2.credentials.userId);
            await app.client.inviteUser(roomId, bot.credentials.userId);
            await app.client.inviteUser(roomId, bot2.credentials.userId);
            await bot.joinRoom(roomId);
            await bot2.joinRoom(roomId);

            // Then those actions are gathered into a single summary
            await expect(
                page.locator(".mx_RoomView_body .mx_GenericEventListSummary[data-layout='group']", {
                    hasText: "was removed, was invited, and joined",
                }),
            ).toBeVisible();

            await expect(page.locator('div[aria-label="3 members"]')).toBeVisible();

            await replaceBotIds(page, bot, bot2);
            await expect(page.locator(".mx_MainSplit")).toMatchScreenshot(
                "multiple_people_ban_messages.png",
                ignoreTimestampsRightColumnAndHeader,
            );

            // And when we expand the summary
            // Note: we can't include "expand" in the screenshot because it
            // moves around, but at least we know it exists because we click it
            // here.
            await page.getByRole("button", { name: "expand" }).nth(3).click();

            // Then we see all the individual actions
            await expect(
                page.locator(".mx_RoomView_body .mx_GenericEventListSummary[data-layout='group']", {
                    hasText: "removed MyBot2",
                }),
            ).toBeVisible();

            await replaceBotIds(page, bot, bot2);
            await expect(page.locator(".mx_MainSplit")).toMatchScreenshot(
                "multiple_people_ban_messages_expanded.png",
                ignoreTimestampsRightColumnAndHeader,
            );
        },
    );
});

const ignoreTimestamps = {
    css: ".mx_MessageTimestamp,.mx_TopUnreadMessagesBar { visibility: hidden; },",
};

const ignoreTimestampsRightColumnAndHeader = {
    css:
        ".mx_MessageTimestamp," +
        ".mx_GenericEventListSummary_toggle," +
        ".mx_ReadReceiptGroup," +
        ".mx_RoomHeader, " +
        ".mx_TopUnreadMessagesBar " +
        "{ visibility: hidden; }",
};

/**
 * Create a room, join it, create a bot and invite it to the room.
 */
async function setupRoom(app: ElementAppPage, homeserver: StartedHomeserverContainer, page: Page, user: Credentials) {
    const roomId = await app.client.createRoom({ name: "My room" });
    await page.goto(`/#/room/${roomId}`);

    await expect(
        page.locator(".mx_RoomView_body .mx_GenericEventListSummary[data-layout='group']", {
            hasText: `${user.displayName} created and configured the room.`,
        }),
    ).toBeVisible();

    const bot = new Bot(page, homeserver, {
        displayName: "MyBot",
        autoAcceptInvites: false,
    });
    await bot.prepareClient();
    await app.client.inviteUser(roomId, bot.credentials.userId);
    await app.client.sendMessage(roomId, "I invited MyBot...");

    return { bot, roomId };
}

/**
 * Find the ID of the supplied bot in the page and replace it with a known string.
 *
 * This allows us to create consistent screenshots.
 */
async function replaceBotIds(page: Page, bot: Bot, bot2?: Bot) {
    await page.evaluate(
        ([bot1UserId, bot2UserId]) => {
            for (const el of document.querySelectorAll("div.mx_TextualEvent")) {
                if ("innerText" in el) {
                    el.innerText = (el.innerText as any as string).replaceAll(bot1UserId, "<<replaced_bot1_id>>");
                    el.innerText = (el.innerText as any as string).replaceAll(bot2UserId, "<<replaced_bot2_id>>");
                }
            }
        },
        [bot.credentials.userId, bot2?.credentials?.userId ?? "no_bot_2_to_replace"],
    );
}

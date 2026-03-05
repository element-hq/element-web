/*
Copyright 2026 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/
import { test, expect } from "../../element-web-test";

test.describe("Message links", () => {
    test.use({
        displayName: "Alice",
        room: async ({ user, app, bot }, use) => {
            const roomId = await app.client.createRoom({ name: "Test room", invite: [bot.credentials.userId] });
            await use({ roomId });
        },
        botCreateOpts: {
            displayName: "Bob",
        },
    });
    for (const link of ["https://example.org", "example.org", "ftp://example.org"]) {
        test(`should linkify a regular link '${link}'`, async ({ page, user, app, bot, room }) => {
            await page.goto(`#/room/${room.roomId}`);
            // Needs to be unformatted so we test linkifing
            await bot.sendMessage(room.roomId, `Check out ${link}`);
            const linkElement = page.locator(".mx_EventTile_last").getByRole("link", { name: link });
            await app.timeline.scrollToBottom();
            await expect(linkElement).toBeVisible();
        });
    }
    test("should linkify a User ID", async ({ page, user, app, bot, room }) => {
        await page.goto(`#/room/${room.roomId}`);
        // Needs to be unformatted so we test linkifing
        await bot.sendMessage(room.roomId, `Check out ${bot.credentials.userId}`);
        const linkElement = page.locator(".mx_EventTile_last").getByRole("link", { name: bot.credentials.userId });
        await app.timeline.scrollToBottom();
        await expect(linkElement).toBeVisible();
        const waitForUrl = page.waitForURL(`https://matrix.to/#/#${bot.credentials.userId}`);
        await linkElement.click();
        await waitForUrl;
    });
    test("should linkify a Room alias", async ({ page, user, app, bot, room }) => {
        await page.goto(`#/room/${room.roomId}`);
        // Needs to be unformatted so we test linkifing
        await bot.sendMessage(room.roomId, "Check out #aroom:example.org");
        const linkElement = page.locator(".mx_EventTile_last").getByRole("link", { name: "#aroom:example.org" });
        await app.timeline.scrollToBottom();
        await expect(linkElement).toBeVisible();
        const waitForUrl = page.waitForURL(`https://matrix.to/#/##aroom:example.org`);
        await linkElement.click();
        await waitForUrl;
    });
});

/*
Copyright 2024 New Vector Ltd.
Copyright 2023 Suguru Hirahara
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { test, expect } from "../../element-web-test";

test.describe("Invite dialog", function () {
    test.use({
        displayName: "Hanako",
        botCreateOpts: {
            displayName: "BotAlice",
        },
    });

    const botName = "BotAlice";

    test("should support inviting a user to a room", { tag: "@screenshot" }, async ({ page, app, user, bot }) => {
        // Create and view a room
        await app.client.createRoom({ name: "Test Room" });
        await app.viewRoomByName("Test Room");

        // Assert that the room was configured
        await expect(page.getByText("Hanako created and configured the room.")).toBeVisible();

        // Open the room info panel
        await app.toggleRoomInfoPanel();

        await page.locator(".mx_BaseCard").getByRole("menuitem", { name: "Invite" }).click();

        const other = page.locator(".mx_InviteDialog_other");
        // Assert that the header is rendered
        await expect(
            other.locator(".mx_Dialog_header .mx_Dialog_title").getByText("Invite to Test Room"),
        ).toBeVisible();
        // Assert that the bar is rendered
        await expect(other.locator(".mx_InviteDialog_addressBar")).toBeVisible();

        await expect(page.locator(".mx_Dialog")).toMatchScreenshot("invite-dialog-room-without-user.png");

        await expect(other.locator(".mx_InviteDialog_identityServer")).not.toBeVisible();

        await other.getByTestId("invite-dialog-input").fill(bot.credentials.userId);

        // Assert that notification about identity servers appears after typing userId
        await expect(other.locator(".mx_InviteDialog_identityServer")).toBeVisible();

        // Assert that the bot id is rendered properly
        await expect(
            other.locator(".mx_InviteDialog_tile_nameStack_userId").getByText(bot.credentials.userId),
        ).toBeVisible();

        await other.locator(".mx_InviteDialog_tile_nameStack_name").getByText(botName).click();

        await expect(
            other.locator(".mx_InviteDialog_userTile_pill .mx_InviteDialog_userTile_name").getByText(botName),
        ).toBeVisible();

        // Take a snapshot of the invite dialog with a user pill
        await expect(page.locator(".mx_Dialog")).toMatchScreenshot("invite-dialog-room-with-user-pill.png");

        // Invite the bot
        await other.getByRole("button", { name: "Invite" }).click();

        // Assert that the invite dialog disappears
        await expect(page.locator(".mx_InviteDialog_other")).not.toBeVisible();

        // Assert that they were invited and joined
        await expect(page.getByText(`${botName} joined the room`)).toBeVisible();
    });

    test(
        "should support inviting a user to Direct Messages",
        { tag: "@screenshot" },
        async ({ page, app, user, bot }) => {
            await page.locator(".mx_RoomList").getByRole("button", { name: "Start chat" }).click();

            const other = page.locator(".mx_InviteDialog_other");
            // Assert that the header is rendered
            await expect(
                other.locator(".mx_Dialog_header .mx_Dialog_title").getByText("Direct Messages"),
            ).toBeVisible();

            // Assert that the bar is rendered
            await expect(other.locator(".mx_InviteDialog_addressBar")).toBeVisible();

            // Take a snapshot of the invite dialog
            await expect(page.locator(".mx_Dialog")).toMatchScreenshot("invite-dialog-dm-without-user.png");

            await other.getByTestId("invite-dialog-input").fill(bot.credentials.userId);

            await expect(
                other.locator(".mx_InviteDialog_tile_nameStack").getByText(bot.credentials.userId),
            ).toBeVisible();
            await other.locator(".mx_InviteDialog_tile_nameStack").getByText(botName).click();

            await expect(
                other.locator(".mx_InviteDialog_userTile_pill .mx_InviteDialog_userTile_name").getByText(botName),
            ).toBeVisible();

            // Take a snapshot of the invite dialog with a user pill
            await expect(page.locator(".mx_Dialog")).toMatchScreenshot("invite-dialog-dm-with-user-pill.png");

            // Open a direct message UI
            await other.getByRole("button", { name: "Go" }).click();

            // Assert that the invite dialog disappears
            await expect(page.locator(".mx_InviteDialog_other")).not.toBeVisible();

            // Assert that the hovered user name on invitation UI does not have background color
            // TODO: implement the test on room-header.spec.ts
            const roomHeader = page.locator(".mx_RoomHeader");
            await roomHeader.locator(".mx_RoomHeader_heading").hover();
            await expect(roomHeader.locator(".mx_RoomHeader_heading")).toHaveCSS(
                "background-color",
                "rgba(0, 0, 0, 0)",
            );

            // Send a message to invite the bots
            const composer = app.getComposer().locator("[contenteditable]");
            await composer.fill("Hello}");
            await composer.press("Enter");

            // Assert that they were invited and joined
            await expect(page.getByText(`${botName} joined the room`)).toBeVisible();

            // Assert that the message is displayed at the bottom
            await expect(page.locator(".mx_EventTile_last").getByText("Hello")).toBeVisible();
        },
    );
});

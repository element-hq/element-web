/*
Copyright 2023 Suguru Hirahara
Copyright 2023 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
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

    test("should support inviting a user to a room", async ({ page, app, user, bot }) => {
        // Create and view a room
        await app.client.createRoom({ name: "Test Room" });
        await app.viewRoomByName("Test Room");

        // Assert that the room was configured
        await expect(page.getByText("Hanako created and configured the room.")).toBeVisible();

        // Open the room info panel
        await page.getByRole("button", { name: "Room info" }).click();

        await page.locator(".mx_BaseCard").getByRole("menuitem", { name: "Invite" }).click();

        const other = page.locator(".mx_InviteDialog_other");
        // Assert that the header is rendered
        await expect(
            other.locator(".mx_Dialog_header .mx_Dialog_title").getByText("Invite to Test Room"),
        ).toBeVisible();
        // Assert that the bar is rendered
        await expect(other.locator(".mx_InviteDialog_addressBar")).toBeVisible();

        await expect(page.locator(".mx_Dialog")).toMatchScreenshot("invite-dialog-room-without-user.png", {
            mask: [page.locator(".mx_InviteDialog_helpText_userId")],
        });

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
        await expect(page.locator(".mx_Dialog")).toMatchScreenshot("invite-dialog-room-with-user-pill.png", {
            mask: [page.locator(".mx_InviteDialog_helpText_userId")],
        });

        // Invite the bot
        await other.getByRole("button", { name: "Invite" }).click();

        // Assert that the invite dialog disappears
        await expect(page.locator(".mx_InviteDialog_other")).not.toBeVisible();

        // Assert that they were invited and joined
        await expect(page.getByText(`${botName} joined the room`)).toBeVisible();
    });

    test("should support inviting a user to Direct Messages", async ({ page, app, user, bot }) => {
        await page.locator(".mx_RoomList").getByRole("button", { name: "Start chat" }).click();

        const other = page.locator(".mx_InviteDialog_other");
        // Assert that the header is rendered
        await expect(other.locator(".mx_Dialog_header .mx_Dialog_title").getByText("Direct Messages")).toBeVisible();

        // Assert that the bar is rendered
        await expect(other.locator(".mx_InviteDialog_addressBar")).toBeVisible();

        // Take a snapshot of the invite dialog
        await expect(page.locator(".mx_Dialog")).toMatchScreenshot("invite-dialog-dm-without-user.png", {
            mask: [page.locator(".mx_InviteDialog_footer_link, .mx_InviteDialog_helpText a")],
        });

        await other.getByTestId("invite-dialog-input").fill(bot.credentials.userId);

        await expect(other.locator(".mx_InviteDialog_tile_nameStack").getByText(bot.credentials.userId)).toBeVisible();
        await other.locator(".mx_InviteDialog_tile_nameStack").getByText(botName).click();

        await expect(
            other.locator(".mx_InviteDialog_userTile_pill .mx_InviteDialog_userTile_name").getByText(botName),
        ).toBeVisible();

        // Take a snapshot of the invite dialog with a user pill
        await expect(page.locator(".mx_Dialog")).toMatchScreenshot("invite-dialog-dm-with-user-pill.png", {
            mask: [page.locator(".mx_InviteDialog_footer_link, .mx_InviteDialog_helpText a")],
        });

        // Open a direct message UI
        await other.getByRole("button", { name: "Go" }).click();

        // Assert that the invite dialog disappears
        await expect(page.locator(".mx_InviteDialog_other")).not.toBeVisible();

        // Assert that the hovered user name on invitation UI does not have background color
        // TODO: implement the test on room-header.spec.ts
        const roomHeader = page.locator(".mx_LegacyRoomHeader");
        await roomHeader.locator(".mx_LegacyRoomHeader_name--textonly").hover();
        await expect(roomHeader.locator(".mx_LegacyRoomHeader_name--textonly")).toHaveCSS(
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
    });
});

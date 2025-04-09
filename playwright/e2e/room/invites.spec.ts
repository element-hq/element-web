/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { test, expect } from "../../element-web-test";

test.describe("Invites", () => {
    test.use({
        displayName: "Alice",
        botCreateOpts: {
            displayName: "Bob",
        },
    });

    test("should render an invite view", { tag: "@screenshot" }, async ({ page, homeserver, user, bot, app }) => {
        const roomId = await bot.createRoom({ is_direct: true });
        await bot.inviteUser(roomId, user.userId);
        await app.viewRoomByName("Bob");
        await expect(page.locator(".mx_RoomView")).toMatchScreenshot("Invites_room_view.png");
    });

    test("should be able to decline an invite", async ({ page, homeserver, user, bot, app }) => {
        const roomId = await bot.createRoom({ is_direct: true });
        await bot.inviteUser(roomId, user.userId);
        await app.viewRoomByName("Bob");
        await page.getByRole("button", { name: "Decline", exact: true }).click();
        await expect(page.getByRole("heading", { name: "Welcome Alice", exact: true })).toBeVisible();
        await expect(
            page.getByRole("tree", { name: "Rooms" }).getByRole("treeitem", { name: "Bob", exact: true }),
        ).not.toBeVisible();
    });

    test(
        "should be able to decline an invite, report the room and ignore the user",
        { tag: "@screenshot" },
        async ({ page, homeserver, user, bot, app }) => {
            const roomId = await bot.createRoom({ is_direct: true });
            await bot.inviteUser(roomId, user.userId);
            await app.viewRoomByName("Bob");
            await page.getByRole("button", { name: "Decline and block" }).click();
            await page.getByLabel("Ignore user").click();
            await page.getByLabel("Report room").click();
            await page.getByLabel("Reason").fill("Do not want the room");
            const roomReported = page.waitForRequest(
                (req) =>
                    req.url().endsWith(`/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/report`) &&
                    req.method() === "POST",
            );
            await expect(page.getByRole("dialog", { name: "Decline invitation" })).toMatchScreenshot(
                "Invites_reject_dialog.png",
            );
            await page.getByRole("button", { name: "Decline invite" }).click();

            // Check room was reported.
            await roomReported;

            // Check user is ignored.
            await app.settings.openUserSettings("Security & Privacy");
            const ignoredUsersList = page.getByRole("list", { name: "Ignored users" });
            await ignoredUsersList.scrollIntoViewIfNeeded();
            await expect(ignoredUsersList.getByRole("listitem", { name: bot.credentials.userId })).toBeVisible();
        },
    );
});

/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { type Page } from "@playwright/test";

import { test, expect } from "../../../element-web-test";

test.describe("Room list", () => {
    test.use({
        displayName: "Alice",
        labsFlags: ["feature_new_room_list"],
    });

    /**
     * Get the room list
     * @param page
     */
    function getRoomList(page: Page) {
        return page.getByTestId("room-list");
    }

    test.beforeEach(async ({ page, app, user }) => {
        // The notification toast is displayed above the search section
        await app.closeNotificationToast();
        for (let i = 0; i < 30; i++) {
            await app.client.createRoom({ name: `room${i}` });
        }
    });

    test("should render the room list", { tag: "@screenshot" }, async ({ page, app, user }) => {
        const roomListView = getRoomList(page);
        await expect(roomListView.getByRole("gridcell", { name: "Open room room29" })).toBeVisible();
        await expect(roomListView).toMatchScreenshot("room-list.png");

        await roomListView.hover();
        // Scroll to the end of the room list
        await page.mouse.wheel(0, 1000);
        await expect(roomListView.getByRole("gridcell", { name: "Open room room0" })).toBeVisible();
        await expect(roomListView).toMatchScreenshot("room-list-scrolled.png");
    });

    test("should open the room when it is clicked", async ({ page, app, user }) => {
        const roomListView = getRoomList(page);
        await roomListView.getByRole("gridcell", { name: "Open room room29" }).click();
        await expect(page.getByRole("heading", { name: "room29", level: 1 })).toBeVisible();
    });

    test("should open the more options menu", { tag: "@screenshot" }, async ({ page, app, user }) => {
        const roomListView = getRoomList(page);
        const roomItem = roomListView.getByRole("gridcell", { name: "Open room room29" });
        await roomItem.hover();

        await expect(roomItem).toMatchScreenshot("room-list-item-hover.png");
        const roomItemMenu = roomItem.getByRole("button", { name: "More Options" });
        await roomItemMenu.click();
        await expect(page).toMatchScreenshot("room-list-item-open-more-options.png");

        // It should make the room favourited
        await page.getByRole("menuitemcheckbox", { name: "Favourited" }).click();

        // Check that the room is favourited
        await roomItem.hover();
        await roomItemMenu.click();
        await expect(page.getByRole("menuitemcheckbox", { name: "Favourited" })).toBeChecked();
        // It should show the invite dialog
        await page.getByRole("menuitem", { name: "invite" }).click();
        await expect(page.getByRole("heading", { name: "Invite to room29" })).toBeVisible();
        await app.closeDialog();

        // It should leave the room
        await roomItem.hover();
        await roomItemMenu.click();
        await page.getByRole("menuitem", { name: "leave room" }).click();
        await expect(roomItem).not.toBeVisible();
    });

    test("should scroll to the current room", async ({ page, app, user }) => {
        const roomListView = getRoomList(page);
        await roomListView.hover();
        // Scroll to the end of the room list
        await page.mouse.wheel(0, 1000);

        await roomListView.getByRole("gridcell", { name: "Open room room0" }).click();

        const filters = page.getByRole("listbox", { name: "Room list filters" });
        await filters.getByRole("option", { name: "People" }).click();
        await expect(roomListView.getByRole("gridcell", { name: "Open room room0" })).not.toBeVisible();

        await filters.getByRole("option", { name: "People" }).click();
        await expect(roomListView.getByRole("gridcell", { name: "Open room room0" })).toBeVisible();
    });

    test("unread filter should only match unread rooms that have a count", async ({ page, app, bot }) => {
        const roomListView = getRoomList(page);
        // Let's create a new room and invite the bot
        const room1Id = await app.client.createRoom({
            name: "Unread Room 1",
            invite: [bot.credentials?.userId],
        });
        await bot.awaitRoomMembership(room1Id);

        // Let's create another room as well
        const room2Id = await app.client.createRoom({
            name: "Unread Room 2",
            invite: [bot.credentials?.userId],
        });
        await bot.awaitRoomMembership(room2Id);

        // Let's configure unread room 1 so that we only get notification for mentions and keywords
        await app.viewRoomById(room1Id);
        await app.settings.openRoomSettings("Notifications");
        await page.getByText("@mentions & keywords").click();
        await app.settings.closeDialog();

        // Let's open a room other than room 1 or room 2
        await roomListView.getByRole("gridcell", { name: "Open room room29" }).click();

        // Let's make the bot send a new message in both room 1 and room 2
        await bot.sendMessage(room1Id, "Hello!");
        await bot.sendMessage(room2Id, "Hello!");

        // Let's activate the unread filter now
        await page.getByRole("option", { name: "Unread" }).click();

        // Unread filter should only show room 2!!
        await expect(roomListView.getByRole("gridcell", { name: "Open room Unread Room 2" })).toBeVisible();
        await expect(roomListView.getByRole("gridcell", { name: "Open room Unread Room 1" })).not.toBeVisible();
    });
});

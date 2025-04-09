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
        botCreateOpts: {
            displayName: "BotBob",
        },
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
    });

    test.describe("Room list", () => {
        test.beforeEach(async ({ page, app, user }) => {
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

        test("should open the notification options menu", { tag: "@screenshot" }, async ({ page, app, user }) => {
            const roomListView = getRoomList(page);

            const roomItem = roomListView.getByRole("gridcell", { name: "Open room room29" });
            await roomItem.hover();

            await expect(roomItem).toMatchScreenshot("room-list-item-hover.png");
            let roomItemMenu = roomItem.getByRole("button", { name: "Notification options" });
            await roomItemMenu.click();

            // Default settings should be selected
            await expect(page.getByRole("menuitem", { name: "Match default settings" })).toHaveAttribute(
                "aria-selected",
                "true",
            );
            await expect(page).toMatchScreenshot("room-list-item-open-notification-options.png");

            // It should make the room muted
            await page.getByRole("menuitem", { name: "Mute room" }).click();

            // Remove hover on the room list item
            await roomListView.hover();

            // Scroll to the bottom of the list
            await page.getByRole("grid", { name: "Room list" }).evaluate((e) => {
                e.scrollTop = e.scrollHeight;
            });

            // The room decoration should have the muted icon
            await expect(roomItem.getByTestId("notification-decoration")).toBeVisible();

            await roomItem.hover();
            // On hover, the room should show the muted icon
            await expect(roomItem).toMatchScreenshot("room-list-item-hover-silent.png");

            roomItemMenu = roomItem.getByRole("button", { name: "Notification options" });
            await roomItemMenu.click();
            // The Mute room option should be selected
            await expect(page.getByRole("menuitem", { name: "Mute room" })).toHaveAttribute("aria-selected", "true");
            await expect(page).toMatchScreenshot("room-list-item-open-notification-options-selection.png");
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
    });

    test.describe("Notification decoration", () => {
        test("should render the invitation decoration", { tag: "@screenshot" }, async ({ page, app, user, bot }) => {
            const roomListView = getRoomList(page);

            await bot.createRoom({
                name: "invited room",
                invite: [user.userId],
                is_direct: true,
            });
            const invitedRoom = roomListView.getByRole("gridcell", { name: "invited room" });
            await expect(invitedRoom).toBeVisible();
            await expect(invitedRoom).toMatchScreenshot("room-list-item-invited.png");
        });

        test("should render the regular decoration", { tag: "@screenshot" }, async ({ page, app, user, bot }) => {
            const roomListView = getRoomList(page);

            const roomId = await app.client.createRoom({ name: "2 notifications" });
            await app.client.inviteUser(roomId, bot.credentials.userId);
            await bot.joinRoom(roomId);

            await bot.sendMessage(roomId, "I am a robot. Beep.");
            await bot.sendMessage(roomId, "I am a robot. Beep.");

            const room = roomListView.getByRole("gridcell", { name: "2 notifications" });
            await expect(room).toBeVisible();
            await expect(room.getByTestId("notification-decoration")).toHaveText("2");
            await expect(room).toMatchScreenshot("room-list-item-notification.png");
        });

        test("should render the mention decoration", { tag: "@screenshot" }, async ({ page, app, user, bot }) => {
            const roomListView = getRoomList(page);

            const roomId = await app.client.createRoom({ name: "mention" });
            await app.client.inviteUser(roomId, bot.credentials.userId);
            await bot.joinRoom(roomId);

            const clientBot = await bot.prepareClient();
            await clientBot.evaluate(
                async (client, { roomId, userId }) => {
                    await client.sendMessage(roomId, {
                        // @ts-ignore ignore usage of MsgType.text
                        "msgtype": "m.text",
                        "body": "User",
                        "format": "org.matrix.custom.html",
                        "formatted_body": `<a href="https://matrix.to/#/${userId}">User</a>`,
                        "m.mentions": {
                            user_ids: [userId],
                        },
                    });
                },
                { roomId, userId: user.userId },
            );
            await bot.sendMessage(roomId, "I am a robot. Beep.");

            const room = roomListView.getByRole("gridcell", { name: "mention" });
            await expect(room).toBeVisible();
            await expect(room).toMatchScreenshot("room-list-item-mention.png");
        });

        test("should render an activity decoration", { tag: "@screenshot" }, async ({ page, app, user, bot }) => {
            const roomListView = getRoomList(page);

            const otherRoomId = await app.client.createRoom({ name: "other room" });

            const roomId = await app.client.createRoom({ name: "activity" });
            await app.client.inviteUser(roomId, bot.credentials.userId);
            await bot.joinRoom(roomId);

            await app.viewRoomById(roomId);
            await app.settings.openRoomSettings("Notifications");
            await page.getByText("@mentions & keywords").click();
            await app.settings.closeDialog();

            await app.settings.openUserSettings("Notifications");
            await page.getByText("Show all activity in the room list (dots or number of unread messages)").click();
            await app.settings.closeDialog();

            // Switch to the other room to avoid the notification to be cleared
            await app.viewRoomById(otherRoomId);
            await bot.sendMessage(roomId, "I am a robot. Beep.");

            const room = roomListView.getByRole("gridcell", { name: "activity" });
            await expect(room.getByTestId("notification-decoration")).toBeVisible();
            await expect(room).toMatchScreenshot("room-list-item-activity.png");
        });

        test("should render a mark as unread decoration", { tag: "@screenshot" }, async ({ page, app, user, bot }) => {
            const roomListView = getRoomList(page);

            const roomId = await app.client.createRoom({ name: "mark as unread" });
            await app.client.inviteUser(roomId, bot.credentials.userId);
            await bot.joinRoom(roomId);

            const room = roomListView.getByRole("gridcell", { name: "mark as unread" });
            await room.hover();
            await room.getByRole("button", { name: "More Options" }).click();
            await page.getByRole("menuitem", { name: "mark as unread" }).click();

            // Remove hover on the room list item
            await roomListView.hover();

            await expect(room).toMatchScreenshot("room-list-item-mark-as-unread.png");
        });

        test("should render silent decoration", { tag: "@screenshot" }, async ({ page, app, user, bot }) => {
            const roomListView = getRoomList(page);

            const roomId = await app.client.createRoom({ name: "silent" });
            await app.client.inviteUser(roomId, bot.credentials.userId);
            await bot.joinRoom(roomId);

            await app.viewRoomById(roomId);
            await app.settings.openRoomSettings("Notifications");
            await page.getByText("Off").click();
            await app.settings.closeDialog();

            const room = roomListView.getByRole("gridcell", { name: "silent" });
            await expect(room.getByTestId("notification-decoration")).toBeVisible();
            await expect(room).toMatchScreenshot("room-list-item-silent.png");
        });
    });
});

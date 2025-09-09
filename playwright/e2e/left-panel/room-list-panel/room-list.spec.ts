/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { type Page } from "@playwright/test";

import { expect, test } from "../../../element-web-test";

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

        // focus the user menu to avoid to have hover decoration
        await page.getByRole("button", { name: "User menu" }).focus();
    });

    test.describe("Room list", () => {
        test.beforeEach(async ({ page, app, user }) => {
            for (let i = 0; i < 30; i++) {
                await app.client.createRoom({ name: `room${i}` });
            }
        });

        test("should render the room list", { tag: "@screenshot" }, async ({ page, app, user, axe }) => {
            const roomListView = getRoomList(page);
            await expect(roomListView.getByRole("option", { name: "Open room room29" })).toBeVisible();
            await expect(roomListView).toMatchScreenshot("room-list.png");

            // Put focus on the room list
            await roomListView.getByRole("option", { name: "Open room room29" }).click();
            // Scroll to the end of the room list
            await app.scrollListToBottom(roomListView);

            // scrollListToBottom seems to leave the mouse hovered over the list, move it away.
            await page.getByRole("button", { name: "User menu" }).hover();

            await expect(axe).toHaveNoViolations();
            await expect(roomListView).toMatchScreenshot("room-list-scrolled.png");
        });

        test("should open the room when it is clicked", async ({ page, app, user }) => {
            const roomListView = getRoomList(page);
            await roomListView.getByRole("option", { name: "Open room room29" }).click();
            await expect(page.getByRole("heading", { name: "room29", level: 1 })).toBeVisible();
        });

        test("should open the context menu", { tag: "@screenshot" }, async ({ page, app, user }) => {
            const roomListView = getRoomList(page);
            await roomListView.getByRole("option", { name: "Open room room29" }).click({ button: "right" });
            await expect(page.getByRole("menu", { name: "More Options" })).toBeVisible();
        });

        test("should open the more options menu", { tag: "@screenshot" }, async ({ page, app, user }) => {
            const roomListView = getRoomList(page);
            const roomItem = roomListView.getByRole("option", { name: "Open room room29" });
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

            const roomItem = roomListView.getByRole("option", { name: "Open room room29" });
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

            await expect(roomItem.getByTestId("notification-decoration")).not.toBeVisible();

            // Put focus on the room list
            await roomListView.getByRole("option", { name: "Open room room28" }).click();

            // Scroll to the end of the room list
            await app.scrollListToBottom(roomListView);

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
            // Put focus on the room list
            await roomListView.getByRole("option", { name: "Open room room29" }).click();
            // Scroll to the end of the room list
            await app.scrollListToBottom(roomListView);

            await expect(roomListView.getByRole("option", { name: "Open room room0" })).toBeVisible();
            await roomListView.getByRole("option", { name: "Open room room0" }).click();

            const filters = page.getByRole("listbox", { name: "Room list filters" });
            await filters.getByRole("option", { name: "People" }).click();
            await expect(roomListView.getByRole("option", { name: "Open room room0" })).not.toBeVisible();

            await filters.getByRole("option", { name: "People" }).click();
            await expect(roomListView.getByRole("option", { name: "Open room room0" })).toBeVisible();
        });

        test.describe("Shortcuts", () => {
            test("should select the next room", async ({ page, app, user }) => {
                const roomListView = getRoomList(page);
                await roomListView.getByRole("option", { name: "Open room room29" }).click();
                await page.keyboard.press("Alt+ArrowDown");

                await expect(page.getByRole("heading", { name: "room28", level: 1 })).toBeVisible();
            });

            test("should select the previous room", async ({ page, app, user }) => {
                const roomListView = getRoomList(page);
                await roomListView.getByRole("option", { name: "Open room room28" }).click();
                await page.keyboard.press("Alt+ArrowUp");

                await expect(page.getByRole("heading", { name: "room29", level: 1 })).toBeVisible();
            });

            test("should select the last room", async ({ page, app, user }) => {
                const roomListView = getRoomList(page);
                await roomListView.getByRole("option", { name: "Open room room29" }).click();
                await page.keyboard.press("Alt+ArrowUp");

                await expect(page.getByRole("heading", { name: "room0", level: 1 })).toBeVisible();
            });

            test("should select the next unread room", async ({ page, app, user, bot }) => {
                const roomListView = getRoomList(page);

                const roomId = await app.client.createRoom({ name: "1 notification" });
                await app.client.inviteUser(roomId, bot.credentials.userId);
                await bot.joinRoom(roomId);
                await bot.sendMessage(roomId, "I am a robot. Beep.");

                await roomListView.getByRole("option", { name: "Open room room20" }).click();

                // Make sure the room with the unread is visible before we press the keyboard action to select it
                await expect(roomListView.getByRole("option", { name: "1 notification" })).toBeVisible();

                await page.keyboard.press("Alt+Shift+ArrowDown");

                await expect(page.getByRole("heading", { name: "1 notification", level: 1 })).toBeVisible();
            });
        });

        test.describe("Keyboard navigation", () => {
            test("should navigate to the room list", async ({ page, app, user }) => {
                const roomListView = getRoomList(page);

                const room29 = roomListView.getByRole("option", { name: "Open room room29" });
                const room28 = roomListView.getByRole("option", { name: "Open room room28" });

                // open the room
                await room29.click();
                // put focus back on the room list item
                await room29.click();
                await expect(room29).toBeFocused();

                await page.keyboard.press("ArrowDown");
                await expect(room28).toBeFocused();
                await expect(room29).not.toBeFocused();

                await page.keyboard.press("ArrowUp");
                await expect(room29).toBeFocused();
                await expect(room28).not.toBeFocused();
            });

            test("should navigate to the notification menu", async ({ page, app, user }) => {
                const roomListView = getRoomList(page);
                const room29 = roomListView.getByRole("option", { name: "Open room room29" });
                const moreButton = room29.getByRole("button", { name: "More options" });
                const notificationButton = room29.getByRole("button", { name: "Notification options" });

                await room29.click();
                // put focus back on the room list item
                await room29.click();
                await page.keyboard.press("Tab");
                await expect(moreButton).toBeFocused();
                await page.keyboard.press("Tab");
                await expect(notificationButton).toBeFocused();

                // Open the menu
                await page.keyboard.press("Enter");
                // Wait for the menu to be open
                await expect(page.getByRole("menuitem", { name: "Match default settings" })).toHaveAttribute(
                    "aria-selected",
                    "true",
                );

                await page.keyboard.press("ArrowDown");
                await page.keyboard.press("Escape");
                // Focus should be back on the notification button
                await expect(notificationButton).toBeFocused();
            });
        });
    });

    test.describe("Avatar decoration", () => {
        test.use({ labsFlags: ["feature_video_rooms", "feature_new_room_list"] });

        test("should be a public room", { tag: "@screenshot" }, async ({ page, app, user }) => {
            // @ts-ignore Visibility enum is not accessible
            await app.client.createRoom({ name: "public room", visibility: "public" });

            // focus the user menu to avoid to have hover decoration
            await page.getByRole("button", { name: "User menu" }).focus();

            const roomListView = getRoomList(page);
            const publicRoom = roomListView.getByRole("option", { name: "public room" });

            await expect(publicRoom).toBeVisible();
            await expect(publicRoom).toMatchScreenshot("room-list-item-public.png");
        });

        test("should be a low priority room", { tag: "@screenshot" }, async ({ page, app, user }) => {
            // @ts-ignore Visibility enum is not accessible
            await app.client.createRoom({ name: "low priority room", visibility: "public" });
            const roomListView = getRoomList(page);
            const publicRoom = roomListView.getByRole("option", { name: "low priority room" });

            // Make room low priority
            await publicRoom.hover();
            const roomItemMenu = publicRoom.getByRole("button", { name: "More Options" });
            await roomItemMenu.click();
            await page.getByRole("menuitemcheckbox", { name: "Low priority" }).click();

            // Should have low priority decoration
            await expect(publicRoom.locator(".mx_RoomAvatarView_icon")).toHaveAccessibleName(
                "This is a low priority room",
            );

            // focus the user menu to avoid to have hover decoration
            await page.getByRole("button", { name: "User menu" }).focus();
            await expect(publicRoom).toMatchScreenshot("room-list-item-low-priority.png");
        });

        test("should be a video room", { tag: "@screenshot" }, async ({ page, app, user }) => {
            await page.getByRole("navigation", { name: "Room list" }).getByRole("button", { name: "Add" }).click();
            await page.getByRole("menuitem", { name: "New video room" }).click();
            await page.getByRole("textbox", { name: "Name" }).fill("video room");
            await page.getByRole("button", { name: "Create video room" }).click();

            const roomListView = getRoomList(page);
            const videoRoom = roomListView.getByRole("option", { name: "video room" });

            // focus the user menu to avoid to have hover decoration
            await page.getByRole("button", { name: "User menu" }).focus();

            await expect(videoRoom).toBeVisible();
            await expect(videoRoom).toMatchScreenshot("room-list-item-video.png");
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
            const invitedRoom = roomListView.getByRole("option", { name: "invited room" });
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

            const room = roomListView.getByRole("option", { name: "2 notifications" });
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

            const room = roomListView.getByRole("option", { name: "mention" });
            await expect(room).toBeVisible();
            await expect(room).toMatchScreenshot("room-list-item-mention.png");
        });

        test("should render a message preview", { tag: "@screenshot" }, async ({ page, app, user, bot }) => {
            await app.settings.openUserSettings("Preferences");
            await page.getByRole("switch", { name: "Show message previews" }).click();
            await app.closeDialog();

            const roomListView = getRoomList(page);

            const roomId = await app.client.createRoom({ name: "activity" });

            // focus the user menu to avoid to have hover decoration
            await page.getByRole("button", { name: "User menu" }).focus();

            await app.client.inviteUser(roomId, bot.credentials.userId);
            await bot.joinRoom(roomId);
            await bot.sendMessage(roomId, "I am a robot. Beep.");

            const room = roomListView.getByRole("option", { name: "activity" });
            await expect(room.getByText("I am a robot. Beep.")).toBeVisible();
            await expect(room).toMatchScreenshot("room-list-item-message-preview.png");
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

            const room = roomListView.getByRole("option", { name: "activity" });
            await expect(room.getByTestId("notification-decoration")).toBeVisible();
            await expect(room).toMatchScreenshot("room-list-item-activity.png");
        });

        test("should render a mark as unread decoration", { tag: "@screenshot" }, async ({ page, app, user, bot }) => {
            const roomListView = getRoomList(page);

            const roomId = await app.client.createRoom({ name: "mark as unread" });
            await app.client.inviteUser(roomId, bot.credentials.userId);
            await bot.joinRoom(roomId);

            const room = roomListView.getByRole("option", { name: "mark as unread" });
            await room.hover();
            await room.getByRole("button", { name: "More Options" }).click();
            await page.getByRole("menuitem", { name: "mark as unread" }).click();

            // focus the user menu to avoid to have hover decoration
            await page.getByRole("button", { name: "User menu" }).focus();

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

            const room = roomListView.getByRole("option", { name: "silent" });
            await expect(room.getByTestId("notification-decoration")).toBeVisible();
            await expect(room).toMatchScreenshot("room-list-item-silent.png");
        });
    });
});

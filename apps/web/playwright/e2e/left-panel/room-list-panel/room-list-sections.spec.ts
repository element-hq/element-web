/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { rejectToast } from "@element-hq/element-web-playwright-common";

import { expect, test } from "../../../element-web-test";
import { assertRoomInSection, dragRoomToSection, getPrimaryFilters, getRoomList, getSectionHeader } from "./utils";

test.describe("Room list sections", () => {
    test.use({
        displayName: "Alice",
        labsFlags: ["feature_new_room_list", "feature_room_list_sections"],
        botCreateOpts: {
            displayName: "BotBob",
            autoAcceptInvites: true,
        },
    });

    test.beforeEach(async ({ page, app, user }) => {
        // The toasts are displayed above the search section
        await rejectToast(page, "Verify this device");
        await rejectToast(page, "Notifications");

        // focus the user menu to avoid to have hover decoration
        await page.getByRole("button", { name: "User menu" }).focus();
    });

    test.describe("Section rendering", () => {
        test.beforeEach(async ({ app, user }) => {
            // Create regular rooms
            for (let i = 0; i < 3; i++) {
                await app.client.createRoom({ name: `room${i}` });
            }
        });

        test("should render sections with correct rooms in each", { tag: "@screenshot" }, async ({ page, app }) => {
            // Create a favourite room
            const favouriteId = await app.client.createRoom({ name: "favourite room" });
            await app.client.evaluate(async (client, roomId) => {
                await client.setRoomTag(roomId, "m.favourite");
            }, favouriteId);

            // Create a low priority room
            const lowPrioId = await app.client.createRoom({ name: "low prio room" });
            await app.client.evaluate(async (client, roomId) => {
                await client.setRoomTag(roomId, "m.lowpriority");
            }, lowPrioId);

            const roomList = getRoomList(page);

            // All three section headers should be visible
            await expect(getSectionHeader(page, "Favourites")).toBeVisible();
            await expect(getSectionHeader(page, "Chats")).toBeVisible();
            await expect(getSectionHeader(page, "Low Priority")).toBeVisible();

            // Ensure all rooms are visible
            await expect(roomList.getByRole("row", { name: "Open room favourite room" })).toBeVisible();
            await expect(roomList.getByRole("row", { name: "Open room low prio room" })).toBeVisible();
            await expect(roomList.getByRole("row", { name: "Open room room0" })).toBeVisible();

            await expect(roomList).toMatchScreenshot("room-list-sections.png");
        });

        test("should only show non-empty sections", async ({ page, app }) => {
            // No low priority rooms created, only regular and favourite rooms
            const favouriteId = await app.client.createRoom({ name: "favourite room" });
            await app.client.evaluate(async (client, roomId) => {
                await client.setRoomTag(roomId, "m.favourite");
            }, favouriteId);

            // Chats and Favourites sections should still be visible
            await expect(getSectionHeader(page, "Chats")).toBeVisible();
            await expect(getSectionHeader(page, "Favourites")).toBeVisible();
            // Low Priority sections should not be visible
            await expect(getSectionHeader(page, "Low Priority")).not.toBeVisible();
        });

        test("should render a flat list when there is only rooms in Chats section", async ({ page, app }) => {
            // All sections should not be visible
            await expect(getSectionHeader(page, "Chats")).not.toBeVisible();
            await expect(getSectionHeader(page, "Favourites")).not.toBeVisible();
            await expect(getSectionHeader(page, "Low Priority")).not.toBeVisible();
            // It should be a flat list (using listbox a11y role)
            await expect(page.getByRole("listbox", { name: "Room list", exact: true })).toBeVisible();
            await expect(getRoomList(page).getByRole("option", { name: "Open room room0" })).toBeVisible();
        });
    });

    test.describe("Section collapse and expand", () => {
        [
            { section: "Favourites", roomName: "favourite room", tag: "m.favourite" },
            { section: "Low Priority", roomName: "low prio room", tag: "m.lowpriority" },
        ].forEach(({ section, roomName, tag }) => {
            test(`should collapse and expand the ${section} section`, async ({ page, app }) => {
                const roomId = await app.client.createRoom({ name: roomName });
                if (tag) {
                    await app.client.evaluate(
                        async (client, { roomId, tag }) => {
                            await client.setRoomTag(roomId, tag);
                        },
                        { roomId, tag },
                    );
                }

                const roomList = getRoomList(page);
                const sectionHeader = getSectionHeader(page, section);

                // The room should be visible
                await expect(roomList.getByRole("row", { name: `Open room ${roomName}` })).toBeVisible();

                // Collapse the section
                await sectionHeader.click();

                // The room should no longer be visible
                await expect(roomList.getByRole("row", { name: `Open room ${roomName}` })).not.toBeVisible();

                // The section header should still be visible
                await expect(sectionHeader).toBeVisible();

                // Expand the section again
                await sectionHeader.click();

                // The room should be visible again
                await expect(roomList.getByRole("row", { name: `Open room ${roomName}` })).toBeVisible();
            });
        });

        test("should render collapsed section", { tag: "@screenshot" }, async ({ page, app }) => {
            const favouriteId = await app.client.createRoom({ name: "favourite room" });
            await app.client.evaluate(async (client, roomId) => {
                await client.setRoomTag(roomId, "m.favourite");
            }, favouriteId);

            await app.client.createRoom({ name: "regular room" });

            const roomList = getRoomList(page);

            // Collapse the Favourites section
            await getSectionHeader(page, "Favourites").click();

            // Verify favourite room is hidden but regular room is still visible
            await expect(roomList.getByRole("row", { name: "Open room favourite room" })).not.toBeVisible();
            await expect(roomList.getByRole("row", { name: "Open room regular room" })).toBeVisible();

            await expect(roomList).toMatchScreenshot("room-list-sections-collapsed.png");
        });
    });

    test.describe("Rooms placement in sections", () => {
        test("should move a room between sections when tags change", async ({ page, app }) => {
            await app.client.createRoom({ name: "my room" });

            const roomList = getRoomList(page);

            // Flat list because there is only rooms in the Chats section
            let roomItem = roomList.getByRole("option", { name: "Open room my room" });
            await expect(roomItem).toBeVisible();

            // Favourite the room via context menu
            await roomItem.click({ button: "right" });
            await page.getByRole("menuitemcheckbox", { name: "Favourited" }).click();

            // The Favourites section header should now be visible and the room should be under it
            await expect(getSectionHeader(page, "Favourites")).toBeVisible();
            roomItem = roomList.getByRole("row", { name: "Open room my room" });
            await expect(roomItem).toBeVisible();

            // Unfavourite the room
            await roomItem.hover();
            await roomItem.getByRole("button", { name: "More Options" }).click();
            await page.getByRole("menuitemcheckbox", { name: "Favourited" }).click();

            // Mark the room as low priority via context menu
            roomItem = roomList.getByRole("option", { name: "Open room my room" });
            await roomItem.click({ button: "right" });
            await page.getByRole("menuitemcheckbox", { name: "Low priority" }).click();

            // The Low Priority section header should now be visible and the room should be under it
            await expect(getSectionHeader(page, "Low Priority")).toBeVisible();
            roomItem = roomList.getByRole("row", { name: "Open room my room" });
            await expect(roomItem).toBeVisible();
        });

        test("should move a room from Chats to Favourites when using dnd", async ({ page, app }) => {
            await app.client.createRoom({ name: "my room" });

            const favouriteId = await app.client.createRoom({ name: "favourite room" });
            await app.client.evaluate(async (client, roomId) => {
                await client.setRoomTag(roomId, "m.favourite");
            }, favouriteId);

            await dragRoomToSection(page, "my room", "Favourites");
            await assertRoomInSection(page, "Favourites", "my room");
        });

        test("should move a room from Favourites to Chats when using dnd", async ({ page, app }) => {
            const favouriteId = await app.client.createRoom({ name: "my room" });
            await app.client.evaluate(async (client, roomId) => {
                await client.setRoomTag(roomId, "m.favourite");
            }, favouriteId);

            // Create a second favourite room to ensure we stay in section mode (not flat list)
            const favouriteId2 = await app.client.createRoom({ name: "favourite room" });
            await app.client.evaluate(async (client, roomId) => {
                await client.setRoomTag(roomId, "m.favourite");
            }, favouriteId2);

            // Ensure the Chats section is visible by creating a room in it
            await app.client.createRoom({ name: "room in chats" });

            await dragRoomToSection(page, "my room", "Chats");
            await assertRoomInSection(page, "Chats", "my room");
        });
    });

    test.describe("Section header notification", () => {
        test("should show unread indicator on section header", async ({ page, app, bot }) => {
            // Create a favourite room
            const favouriteId = await app.client.createRoom({ name: "favourite room" });
            await app.client.evaluate(async (client, roomId) => {
                await client.setRoomTag(roomId, "m.favourite");
            }, favouriteId);

            const roomList = getRoomList(page);

            // Invite the bot and have it send a message to generate an unread
            await app.client.inviteUser(favouriteId, bot.credentials.userId);
            await bot.joinRoom(favouriteId);
            await bot.sendMessage(favouriteId, "Hello from bot!");

            let sectionHeader = getSectionHeader(page, "Favourites", true);
            await expect(sectionHeader).toBeVisible();

            // Open the room to mark it as read
            await roomList.getByRole("row", { name: "Open room favourite room" }).click();

            // The section should no longer be unread
            sectionHeader = getSectionHeader(page, "Favourites", false);
            await expect(sectionHeader).toBeVisible();
        });

        test(
            "should aggregate notification decorations on the collapsed section header",
            { tag: "@screenshot" },
            async ({ page, app, user, bot }) => {
                // A favourite room to keep the room list in section mode (otherwise it renders as a flat list)
                const favouriteId = await app.client.createRoom({ name: "favourite room" });
                await app.client.evaluate(async (client, roomId) => {
                    await client.setRoomTag(roomId, "m.favourite");
                }, favouriteId);

                // A room with a mention, landing in the Chats section
                const mentionId = await app.client.createRoom({ name: "mention room" });
                await app.client.inviteUser(mentionId, bot.credentials.userId);
                await bot.joinRoom(mentionId);
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
                    { roomId: mentionId, userId: user.userId },
                );

                // A room we are invited to, landing in the Chats section
                await bot.createRoom({
                    name: "invited room",
                    invite: [user.userId],
                    is_direct: true,
                });

                const roomList = getRoomList(page);

                // Wait for the mention decoration to sync onto the mention room before collapsing, so the
                // section header aggregation has the room states available.
                await expect(
                    roomList.getByRole("row", { name: /mention room/ }).getByTestId("notification-decoration"),
                ).toBeVisible();

                // Collapse the Chats section so the aggregated decoration is displayed on its header
                const chatsHeader = getSectionHeader(page, "Chats", true);
                await expect(chatsHeader).toBeVisible();
                await chatsHeader.click();

                // The header hides its decoration while hovered/focused, so move the pointer away
                await page.mouse.move(0, 0);

                // The collapsed header aggregates the mention and the invitation
                await expect(chatsHeader.getByTestId("notification-decoration")).toBeVisible();

                await expect(chatsHeader).toMatchScreenshot("room-list-section-header-notification.png");
            },
        );
    });

    test.describe("Sections and filters interaction", () => {
        test("should not show Favourite and Low Priority filters when sections are enabled", async ({ page, app }) => {
            const primaryFilters = getPrimaryFilters(page);

            // Expand the filter list to see all filters
            const expandButton = primaryFilters.getByRole("button", { name: "Expand filter list" });
            await expandButton.click();

            // Favourite and Low Priority filters should NOT be visible since sections handle them
            await expect(primaryFilters.getByRole("option", { name: "Favourite" })).not.toBeVisible();

            // Other filters should still be present
            await expect(primaryFilters.getByRole("option", { name: "People" })).toBeVisible();
            await expect(primaryFilters.getByRole("option", { name: "Rooms" })).toBeVisible();
            await expect(primaryFilters.getByRole("option", { name: "Unread" })).toBeVisible();
        });

        test("should maintain sections when a filter is applied", async ({ page, app, bot }) => {
            // Create a favourite room with unread messages
            const favouriteId = await app.client.createRoom({ name: "fav with unread" });
            await app.client.evaluate(async (client, roomId) => {
                await client.setRoomTag(roomId, "m.favourite");
            }, favouriteId);
            await app.client.inviteUser(favouriteId, bot.credentials.userId);
            await bot.joinRoom(favouriteId);
            await bot.sendMessage(favouriteId, "Hello from favourite!");

            // Create a regular room with unread messages
            const regularId = await app.client.createRoom({ name: "regular with unread" });
            await app.client.inviteUser(regularId, bot.credentials.userId);
            await bot.joinRoom(regularId);
            await bot.sendMessage(regularId, "Hello from regular!");

            // Create a room without unread
            await app.client.createRoom({ name: "no unread room" });

            const roomList = getRoomList(page);
            const primaryFilters = getPrimaryFilters(page);

            // Apply the Unread filter
            await primaryFilters.getByRole("option", { name: "Unread" }).click();

            // Only rooms with unreads should be visible
            await expect(roomList.getByRole("row", { name: "fav with unread" })).toBeVisible();
            await expect(roomList.getByRole("row", { name: "regular with unread" })).toBeVisible();
            await expect(roomList.getByRole("row", { name: "no unread room" })).not.toBeVisible();
        });
    });

    test.describe("Section keyboard navigation", () => {
        test.beforeEach(async ({ app }) => {
            // A favourite room forces section mode and gives us a non-trivial first section.
            const favouriteId = await app.client.createRoom({ name: "favourite room" });
            await app.client.evaluate(async (client, roomId) => {
                await client.setRoomTag(roomId, "m.favourite");
            }, favouriteId);

            // A chats-section room so we have a second section to navigate to.
            await app.client.createRoom({ name: "chat room" });
        });

        test("Arrow Down/Up move focus through sections and rooms", async ({ page }) => {
            const roomList = getRoomList(page);
            const favouritesHeader = getSectionHeader(page, "Favourites");
            // In treegrid mode, a room renders as <div role="row"><div role="gridcell"><button …></button></div></div>.
            // Only the inner <button> is focusable, so target it by role for focus assertions.
            const favRoomButton = roomList.getByRole("button", { name: "Open room favourite room" });
            const chatsHeader = getSectionHeader(page, "Chats");

            await expect(favouritesHeader).toBeVisible();
            await expect(favRoomButton).toBeVisible();
            await expect(chatsHeader).toBeVisible();

            await favouritesHeader.focus();
            await expect(favouritesHeader).toBeFocused();

            // Down moves into the favourite section's room.
            await page.keyboard.press("ArrowDown");
            await expect(favRoomButton).toBeFocused();

            // Down again jumps to the next section header.
            await page.keyboard.press("ArrowDown");
            await expect(chatsHeader).toBeFocused();

            // Up reverses the traversal.
            await page.keyboard.press("ArrowUp");
            await expect(favRoomButton).toBeFocused();

            await page.keyboard.press("ArrowUp");
            await expect(favouritesHeader).toBeFocused();
        });

        test("Arrow Right expands a collapsed section", async ({ page }) => {
            const favouritesHeader = getSectionHeader(page, "Favourites");
            const favRoom = getRoomList(page).getByRole("row", { name: "Open room favourite room" });

            // Collapse the section via click so we know we start expanded=false.
            await favouritesHeader.click();
            await expect(favouritesHeader).toHaveAttribute("aria-expanded", "false");
            await expect(favRoom).not.toBeVisible();

            await favouritesHeader.focus();
            await page.keyboard.press("ArrowRight");

            await expect(favouritesHeader).toHaveAttribute("aria-expanded", "true");
            await expect(favRoom).toBeVisible();
        });

        test("Arrow Right is a no-op on an already-expanded section", async ({ page }) => {
            const favouritesHeader = getSectionHeader(page, "Favourites");
            await expect(favouritesHeader).toHaveAttribute("aria-expanded", "true");

            await favouritesHeader.focus();
            await page.keyboard.press("ArrowRight");

            await expect(favouritesHeader).toHaveAttribute("aria-expanded", "true");
        });

        test("Arrow Left collapses an expanded section", async ({ page }) => {
            const favouritesHeader = getSectionHeader(page, "Favourites");
            const favRoom = getRoomList(page).getByRole("row", { name: "Open room favourite room" });

            await expect(favouritesHeader).toHaveAttribute("aria-expanded", "true");
            await expect(favRoom).toBeVisible();

            await favouritesHeader.focus();
            await page.keyboard.press("ArrowLeft");

            await expect(favouritesHeader).toHaveAttribute("aria-expanded", "false");
            await expect(favRoom).not.toBeVisible();
        });

        test("Arrow Left is a no-op on an already-collapsed section", async ({ page }) => {
            const favouritesHeader = getSectionHeader(page, "Favourites");

            await favouritesHeader.click();
            await expect(favouritesHeader).toHaveAttribute("aria-expanded", "false");

            await favouritesHeader.focus();
            await page.keyboard.press("ArrowLeft");

            await expect(favouritesHeader).toHaveAttribute("aria-expanded", "false");
        });

        test("Arrow Right on an expanded section with rooms moves focus to its first room", async ({ page }) => {
            const favouritesHeader = getSectionHeader(page, "Favourites");
            const favRoomButton = getRoomList(page).getByRole("button", { name: "Open room favourite room" });

            await expect(favouritesHeader).toHaveAttribute("aria-expanded", "true");

            await favouritesHeader.focus();
            await expect(favouritesHeader).toBeFocused();

            await page.keyboard.press("ArrowRight");

            // Focus must move to the first room in the section, not the next section header.
            await expect(favRoomButton).toBeFocused();
            // The section should remain expanded.
            await expect(favouritesHeader).toHaveAttribute("aria-expanded", "true");
        });

        test("Arrow Left on the first room of a section moves focus back to the section header", async ({ page }) => {
            const favouritesHeader = getSectionHeader(page, "Favourites");
            const favRoomButton = getRoomList(page).getByRole("button", { name: "Open room favourite room" });

            await expect(favouritesHeader).toHaveAttribute("aria-expanded", "true");

            await favRoomButton.focus();
            await expect(favRoomButton).toBeFocused();

            await page.keyboard.press("ArrowLeft");

            await expect(favouritesHeader).toBeFocused();
        });
    });
});

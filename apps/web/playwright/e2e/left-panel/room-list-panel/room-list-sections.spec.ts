/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { rejectToast, rejectToastIfExists } from "@element-hq/element-web-playwright-common";

import { expect, test } from "../../../element-web-test";
import { SettingLevel } from "../../../../src/settings/SettingLevel";
import {
    assertRoomInSection,
    assertSectionsOrder,
    dragRoomToSection,
    dragSectionToSection,
    getPrimaryFilters,
    getRoomList,
    getSectionHeader,
} from "./utils";

test.describe("Room list sections", () => {
    test.use({
        displayName: "Alice",
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
            await expect(getSectionHeader(page, "Rooms")).toBeVisible();
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

            // Rooms and Favourites sections should still be visible
            await expect(getSectionHeader(page, "Rooms")).toBeVisible();
            await expect(getSectionHeader(page, "Favourites")).toBeVisible();
            // Low Priority sections should not be visible
            await expect(getSectionHeader(page, "Low Priority")).not.toBeVisible();
            // No direct message was created, so the People section stays empty and hidden
            await expect(getSectionHeader(page, "People")).not.toBeVisible();
        });

        test("should render a flat list when there is only rooms in Rooms section", async ({ page, app }) => {
            // All sections should not be visible
            await expect(getSectionHeader(page, "Rooms")).not.toBeVisible();
            await expect(getSectionHeader(page, "Favourites")).not.toBeVisible();
            await expect(getSectionHeader(page, "Low Priority")).not.toBeVisible();
            // It should be a flat list (using listbox a11y role)
            await expect(page.getByRole("listbox", { name: "Room list", exact: true })).toBeVisible();
            await expect(getRoomList(page).getByRole("option", { name: "Open room room0" })).toBeVisible();
        });
    });

    test.describe("Show sections setting", () => {
        test.beforeEach(async ({ app }) => {
            // A favourite room and a regular room so that, when sections are enabled, we get
            // two meaningful sections (Favourites + Rooms).
            const favouriteId = await app.client.createRoom({ name: "favourite room" });
            await app.client.evaluate(async (client, roomId) => {
                await client.setRoomTag(roomId, "m.favourite");
            }, favouriteId);
            await app.client.createRoom({ name: "regular room" });
        });

        test("toggling RoomList.showSections switches between a sectioned and a flat list", async ({ page, app }) => {
            const roomList = getRoomList(page);

            // Sections are enabled by default: section headers are visible and rooms render as treegrid rows.
            await expect(getSectionHeader(page, "Favourites")).toBeVisible();
            await expect(getSectionHeader(page, "Rooms")).toBeVisible();
            await expect(roomList.getByRole("row", { name: "Open room favourite room" })).toBeVisible();

            // Disable sections
            await app.settings.setValue("RoomList.showSections", null, SettingLevel.ACCOUNT, false);

            // The list becomes flat: no section headers, rooms render as listbox options.
            await expect(getSectionHeader(page, "Favourites")).not.toBeVisible();
            await expect(getSectionHeader(page, "Rooms")).not.toBeVisible();
            await expect(page.getByRole("listbox", { name: "Room list", exact: true })).toBeVisible();
            await expect(roomList.getByRole("option", { name: "Open room favourite room" })).toBeVisible();
            await expect(roomList.getByRole("option", { name: "Open room regular room" })).toBeVisible();

            // Re-enable sections
            await app.settings.setValue("RoomList.showSections", null, SettingLevel.ACCOUNT, true);

            // The sections reappear.
            await expect(getSectionHeader(page, "Favourites")).toBeVisible();
            await expect(getSectionHeader(page, "Rooms")).toBeVisible();
            await expect(roomList.getByRole("row", { name: "Open room favourite room" })).toBeVisible();
        });
    });

    test.describe("Show people section setting", () => {
        test.beforeEach(async ({ app, bot, user }) => {
            const dmId = await bot.createRoom({ name: "my dm", invite: [user.userId], is_direct: true });
            await app.client.joinRoom(dmId);
            await app.client.createRoom({ name: "regular room" });
            // A favourite room so there is always more than one section and the list never goes flat,
            // which is what makes the section headers render.
            const favouriteId = await app.client.createRoom({ name: "favourite room" });
            await app.client.evaluate(async (client, roomId) => {
                await client.setRoomTag(roomId, "m.favourite");
            }, favouriteId);
        });

        test("puts the direct messages in their own section by default", async ({ page }) => {
            // The direct messages have their own section, so the catch-all section is named after
            // the rooms it is left with
            await expect(getSectionHeader(page, "Chats")).not.toBeVisible();
            await assertRoomInSection(page, "People", "my dm");
            await assertRoomInSection(page, "Rooms", "regular room");
            // People sits above the other sections by default
            await assertSectionsOrder(page, ["People", "Rooms"]);
        });

        test("merges the direct messages back into the Chats section when disabled", async ({ page, app }) => {
            await app.settings.setValue("RoomList.showPeopleSection", null, SettingLevel.ACCOUNT, false);

            // Without a People section, the catch-all section takes its broader name and holds the
            // direct messages too
            await expect(getSectionHeader(page, "People")).not.toBeVisible();
            await expect(getSectionHeader(page, "Rooms")).not.toBeVisible();
            await assertRoomInSection(page, "Chats", "my dm");
            await assertRoomInSection(page, "Chats", "regular room");

            // Enabling the setting again moves the direct messages back out
            await app.settings.setValue("RoomList.showPeopleSection", null, SettingLevel.ACCOUNT, true);

            await expect(getSectionHeader(page, "Chats")).not.toBeVisible();
            await assertRoomInSection(page, "People", "my dm");
            await assertRoomInSection(page, "Rooms", "regular room");
        });

        test("only accepts direct messages in the People section", async ({ page, app }) => {
            await app.settings.setValue("RoomList.showPeopleSection", null, SettingLevel.ACCOUNT, true);
            await assertRoomInSection(page, "People", "my dm");
            await assertRoomInSection(page, "Rooms", "regular room");

            // A room is in the People section because it is a direct message, not because it carries
            // a tag, so neither section accepts the other's rooms.
            await dragRoomToSection(page, "regular room", "People");
            await assertRoomInSection(page, "Rooms", "regular room");

            await dragRoomToSection(page, "my dm", "Rooms");
            await assertRoomInSection(page, "People", "my dm");

            // A section that takes any room still accepts the direct message
            await dragRoomToSection(page, "my dm", "Favourites");
            await assertRoomInSection(page, "Favourites", "my dm");
        });

        test("can move the People section below the Rooms section", async ({ page }) => {
            await assertSectionsOrder(page, ["People", "Rooms"]);

            await dragSectionToSection(page, "People", "Rooms");
            await assertSectionsOrder(page, ["Rooms", "People"]);
        });
    });

    test.describe("Filters when sections are disabled", () => {
        test.beforeEach(async ({ app }) => {
            await app.settings.setValue("RoomList.showSections", null, SettingLevel.ACCOUNT, false);

            // A favourite room, a low priority room, and a regular room.
            const favouriteId = await app.client.createRoom({ name: "favourite room" });
            await app.client.evaluate(async (client, roomId) => {
                await client.setRoomTag(roomId, "m.favourite");
            }, favouriteId);
            const lowPrioId = await app.client.createRoom({ name: "low prio room" });
            await app.client.evaluate(async (client, roomId) => {
                await client.setRoomTag(roomId, "m.lowpriority");
            }, lowPrioId);
            await app.client.createRoom({ name: "regular room" });
        });

        test("shows the Favourites and Low Priority filters and filters the flat list", async ({ page }) => {
            const roomList = getRoomList(page);
            const primaryFilters = getPrimaryFilters(page);

            // Expand the filter list to reveal all filters
            await primaryFilters.getByRole("button", { name: "Expand filter list" }).click();

            // The Favourites and Low Priority filters are available again when sections are disabled
            await expect(primaryFilters.getByRole("option", { name: "Favourites" })).toBeVisible();
            await expect(primaryFilters.getByRole("option", { name: "Low priority" })).toBeVisible();

            // Filtering by Favourites shows only the favourite room
            await primaryFilters.getByRole("option", { name: "Favourites" }).click();
            await expect(roomList.getByRole("option", { name: "Open room favourite room" })).toBeVisible();
            await expect(roomList.getByRole("option", { name: "Open room regular room" })).not.toBeVisible();
            await expect(roomList.getByRole("option", { name: "Open room low prio room" })).not.toBeVisible();

            // Switching to the Low Priority filter shows only the low priority room
            await primaryFilters.getByRole("option", { name: "Low priority" }).click();
            await expect(roomList.getByRole("option", { name: "Open room low prio room" })).toBeVisible();
            await expect(roomList.getByRole("option", { name: "Open room favourite room" })).not.toBeVisible();
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

    test.describe("Section collapse state persistence", () => {
        test.beforeEach(async ({ app }) => {
            // A favourite room (so we get a Favourites section) and a regular room in Rooms,
            // giving us two independent sections whose expansion state we can assert.
            const favouriteId = await app.client.createRoom({ name: "favourite room" });
            await app.client.evaluate(async (client, roomId) => {
                await client.setRoomTag(roomId, "m.favourite");
            }, favouriteId);
            await app.client.createRoom({ name: "regular room" });
        });

        test("persists the collapsed/expanded state across reloads", async ({ page }) => {
            const roomList = getRoomList(page);
            const favouritesHeader = getSectionHeader(page, "Favourites");
            const roomsHeader = getSectionHeader(page, "Rooms");
            const favRoom = roomList.getByRole("row", { name: "Open room favourite room" });
            const regularRoom = roomList.getByRole("row", { name: "Open room regular room" });

            // Collapse both the Favourites and Rooms sections
            await expect(favouritesHeader).toHaveAttribute("aria-expanded", "true");
            await favouritesHeader.click();
            await expect(favouritesHeader).toHaveAttribute("aria-expanded", "false");
            await expect(favRoom).not.toBeVisible();

            await expect(roomsHeader).toHaveAttribute("aria-expanded", "true");
            await roomsHeader.click();
            await expect(roomsHeader).toHaveAttribute("aria-expanded", "false");
            await expect(regularRoom).not.toBeVisible();

            // Reload the page: the collapsed state is persisted at the device level and should survive
            await page.reload();
            await rejectToastIfExists(page, "Verify this device");
            await rejectToastIfExists(page, "Notifications");

            // Both sections are still collapsed and their rooms stay hidden
            await expect(getSectionHeader(page, "Favourites")).toHaveAttribute("aria-expanded", "false");
            await expect(getRoomList(page).getByRole("row", { name: "Open room favourite room" })).not.toBeVisible();
            await expect(getSectionHeader(page, "Rooms")).toHaveAttribute("aria-expanded", "false");
            await expect(getRoomList(page).getByRole("row", { name: "Open room regular room" })).not.toBeVisible();

            // Expand them again and reload: the expanded state is likewise persisted
            await getSectionHeader(page, "Favourites").click();
            await expect(getSectionHeader(page, "Favourites")).toHaveAttribute("aria-expanded", "true");
            await getSectionHeader(page, "Rooms").click();
            await expect(getSectionHeader(page, "Rooms")).toHaveAttribute("aria-expanded", "true");

            await page.reload();
            await rejectToastIfExists(page, "Verify this device");
            await rejectToastIfExists(page, "Notifications");

            await expect(getSectionHeader(page, "Favourites")).toHaveAttribute("aria-expanded", "true");
            await expect(getRoomList(page).getByRole("row", { name: "Open room favourite room" })).toBeVisible();
            await expect(getSectionHeader(page, "Rooms")).toHaveAttribute("aria-expanded", "true");
            await expect(getRoomList(page).getByRole("row", { name: "Open room regular room" })).toBeVisible();
        });
    });

    test.describe("Rooms placement in sections", () => {
        test("should move a room between sections when tags change", async ({ page, app }) => {
            await app.client.createRoom({ name: "my room" });

            const roomList = getRoomList(page);

            // Flat list because there is only rooms in the Rooms section
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

        test("should move a room from Rooms to Favourites when using dnd", async ({ page, app }) => {
            await app.client.createRoom({ name: "my room" });

            const favouriteId = await app.client.createRoom({ name: "favourite room" });
            await app.client.evaluate(async (client, roomId) => {
                await client.setRoomTag(roomId, "m.favourite");
            }, favouriteId);

            await dragRoomToSection(page, "my room", "Favourites");
            await assertRoomInSection(page, "Favourites", "my room");
        });

        test("should move a room from Favourites to Rooms when using dnd", async ({ page, app }) => {
            const favouriteId = await app.client.createRoom({ name: "my room" });
            await app.client.evaluate(async (client, roomId) => {
                await client.setRoomTag(roomId, "m.favourite");
            }, favouriteId);

            // Create a second favourite room to ensure we stay in section mode (not flat list)
            const favouriteId2 = await app.client.createRoom({ name: "favourite room" });
            await app.client.evaluate(async (client, roomId) => {
                await client.setRoomTag(roomId, "m.favourite");
            }, favouriteId2);

            // Ensure the Rooms section is visible by creating a room in it
            await app.client.createRoom({ name: "room in rooms" });

            await dragRoomToSection(page, "my room", "Rooms");
            await assertRoomInSection(page, "Rooms", "my room");
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
            await app.client.inviteUser(favouriteId, bot.credentials!.userId);
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

                // A room with a mention, landing in the Rooms section
                const mentionId = await app.client.createRoom({ name: "mention room" });
                await app.client.inviteUser(mentionId, bot.credentials!.userId);
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

                // A room we are invited to. The invite is direct, so it lands in the People section.
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

                // Collapse the Rooms section so the aggregated decoration is displayed on its header
                const roomsHeader = getSectionHeader(page, "Rooms", true);
                await expect(roomsHeader).toBeVisible();
                await roomsHeader.click();

                // The header hides its decoration while hovered/focused, so move the pointer away
                await page.mouse.move(0, 0);

                // The collapsed header carries the decoration of the mention it hides
                await expect(roomsHeader.getByTestId("notification-decoration")).toBeVisible();

                await expect(roomsHeader).toMatchScreenshot("room-list-section-header-notification.png");
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
            await app.client.inviteUser(favouriteId, bot.credentials!.userId);
            await bot.joinRoom(favouriteId);
            await bot.sendMessage(favouriteId, "Hello from favourite!");

            // Create a regular room with unread messages
            const regularId = await app.client.createRoom({ name: "regular with unread" });
            await app.client.inviteUser(regularId, bot.credentials!.userId);
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

            // A rooms-section room so we have a second section to navigate to.
            await app.client.createRoom({ name: "chat room" });
        });

        test("Arrow Down/Up move focus through sections and rooms", async ({ page }) => {
            const roomList = getRoomList(page);
            const favouritesHeader = getSectionHeader(page, "Favourites");
            // In treegrid mode, a room renders as <div role="row"><div role="gridcell"><button …></button></div></div>.
            // Only the inner <button> is focusable, so target it by role for focus assertions.
            const favRoomButton = roomList.getByRole("button", { name: "Open room favourite room" });
            const roomsHeader = getSectionHeader(page, "Rooms");

            await expect(favouritesHeader).toBeVisible();
            await expect(favRoomButton).toBeVisible();
            await expect(roomsHeader).toBeVisible();

            await favouritesHeader.focus();
            await expect(favouritesHeader).toBeFocused();

            // Down moves into the favourite section's room.
            await page.keyboard.press("ArrowDown");
            await expect(favRoomButton).toBeFocused();

            // Down again jumps to the next section header.
            await page.keyboard.press("ArrowDown");
            await expect(roomsHeader).toBeFocused();

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

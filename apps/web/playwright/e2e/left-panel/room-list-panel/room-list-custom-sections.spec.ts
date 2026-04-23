/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { type Page } from "@playwright/test";

import { expect, test } from "../../../element-web-test";
import { getRoomList, getRoomListHeader, getSectionHeader } from "./utils";

test.describe("Room list custom sections", () => {
    test.use({
        displayName: "Alice",
        labsFlags: ["feature_new_room_list", "feature_room_list_sections"],
        botCreateOpts: {
            displayName: "BotBob",
            autoAcceptInvites: true,
        },
    });

    /**
     * Create a custom section via the header compose menu and dialog.
     * @param page
     * @param sectionName The name of the section to create
     */
    async function createCustomSection(page: Page, sectionName: string): Promise<void> {
        const composeMenu = getRoomListHeader(page).getByRole("button", { name: "New conversation" });
        await composeMenu.click();
        await page.getByRole("menuitem", { name: "New section" }).click();

        // Fill in the section name in the dialog
        const dialog = page.getByRole("dialog", { name: "Create a section" });
        await expect(dialog).toBeVisible();
        await dialog.getByRole("textbox", { name: "Section name" }).fill(sectionName);
        await dialog.getByRole("button", { name: "Create section" }).click();

        // Wait for the dialog to close
        await expect(dialog).not.toBeVisible();
    }

    /**
     * Asserts a room is nested under a specific section using the treegrid aria-level hierarchy.
     * Section header rows sit at aria-level=1; room rows nested within a section sit at aria-level=2.
     * Verifies that the closest preceding aria-level=1 row is the expected section header.
     */
    async function assertRoomInSection(page: Page, sectionName: string, roomName: string): Promise<void> {
        const roomList = getRoomList(page);
        const roomRow = roomList.getByRole("row", { name: `Open room ${roomName}` });
        // Room row must be at aria-level=2 (i.e. inside a section)
        await expect(roomRow).toHaveAttribute("aria-level", "2");
        // The closest preceding aria-level=1 row must be the expected section header.
        // XPath preceding:: axis returns nodes before the context in document order; [1] picks the nearest one.
        const closestSectionHeader = roomRow.locator(`xpath=preceding::*[@role="row" and @aria-level="1"][1]`);
        await expect(closestSectionHeader).toContainText(sectionName);
    }

    test.beforeEach(async ({ page, app, user }) => {
        // The notification toast is displayed above the search section
        await app.closeNotificationToast();

        // Focus the user menu to avoid hover decoration
        await page.getByRole("button", { name: "User menu" }).focus();
    });

    test.describe("Section creation", () => {
        test("should create a custom section via the header compose menu", async ({ page, app }) => {
            await app.client.createRoom({ name: "my room" });

            await createCustomSection(page, "Work");

            // The custom section header should be visible (even though it is empty)
            await expect(getSectionHeader(page, "Work")).toBeVisible();
            // The Chats section should also be visible
            await expect(getSectionHeader(page, "Chats")).toBeVisible();
        });

        test("should show 'Section created' toast after creating a section", async ({ page, app }) => {
            await app.client.createRoom({ name: "my room" });

            await createCustomSection(page, "Personal");

            // The "Section created" toast should appear
            await expect(page.getByText("Section created")).toBeVisible();
        });

        test("should create a custom section via the room option menu", async ({ page, app }) => {
            await app.client.createRoom({ name: "my room" });

            const roomList = getRoomList(page);
            const roomItem = roomList.getByRole("option", { name: "Open room my room" });
            await expect(roomItem).toBeVisible();

            // Open the More Options menu
            await roomItem.hover();
            await roomItem.getByRole("button", { name: "More Options" }).click();

            // Open the "Move to" submenu
            await page.getByRole("menuitem", { name: "Move to" }).hover();

            // Click on "New section"
            await page.getByRole("menuitem", { name: "New section" }).click();

            // Fill in the section name in the dialog
            const dialog = page.getByRole("dialog", { name: "Create a section" });
            await expect(dialog).toBeVisible();
            await dialog.getByRole("textbox", { name: "Section name" }).fill("Projects");
            await dialog.getByRole("button", { name: "Create section" }).click();

            // Wait for the dialog to close
            await expect(dialog).not.toBeVisible();

            // The custom section should be created
            await expect(getSectionHeader(page, "Projects")).toBeVisible();

            // Room should be moved to the new section
            await assertRoomInSection(page, "Projects", "my room");
        });

        test("should cancel section creation when dialog is dismissed", async ({ page, app }) => {
            await app.client.createRoom({ name: "my room" });

            const composeMenu = getRoomListHeader(page).getByRole("button", { name: "New conversation" });
            await composeMenu.click();
            await page.getByRole("menuitem", { name: "New section" }).click();

            // The dialog should appear
            const dialog = page.getByRole("dialog", { name: "Create a section" });
            await expect(dialog).toBeVisible();

            // Cancel the dialog
            await dialog.getByRole("button", { name: "Cancel" }).click();

            // The dialog should close
            await expect(dialog).not.toBeVisible();

            // No custom section should be created - should remain a flat list
            await expect(getSectionHeader(page, "Chats")).not.toBeVisible();
        });

        test("should create multiple custom sections", async ({ page, app }) => {
            await app.client.createRoom({ name: "my room" });

            await createCustomSection(page, "Work");
            await createCustomSection(page, "Personal");

            // Both custom sections should be visible
            await expect(getSectionHeader(page, "Work")).toBeVisible();
            await expect(getSectionHeader(page, "Personal")).toBeVisible();
            await expect(getSectionHeader(page, "Chats")).toBeVisible();
        });
    });

    test.describe("Custom section display", () => {
        test("should show empty custom sections", async ({ page, app }) => {
            // Create a room so the Chats section has something
            await app.client.createRoom({ name: "my room" });

            await createCustomSection(page, "Empty Section");

            // The custom section should be visible even with no rooms
            await expect(getSectionHeader(page, "Empty Section")).toBeVisible();
            // The room should still be in the Chats section
            const roomList = getRoomList(page);
            await expect(roomList.getByRole("row", { name: "Open room my room" })).toBeVisible();
        });

        test("should display custom sections between Favourites and Chats", async ({ page, app }) => {
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

            // Create a regular room
            await app.client.createRoom({ name: "regular room" });

            // Create a custom section
            await createCustomSection(page, "Work");

            // All section headers should be visible
            await expect(getSectionHeader(page, "Favourites")).toBeVisible();
            await expect(getSectionHeader(page, "Work")).toBeVisible();
            // Should be expanded by default
            await expect(getSectionHeader(page, "Work")).toHaveAttribute("aria-expanded", "true");
            await expect(getSectionHeader(page, "Chats")).toBeVisible();
            await expect(getSectionHeader(page, "Low Priority")).toBeVisible();
        });
    });

    test.describe("Section editing", () => {
        test("should edit a custom section name via the section header menu", async ({ page, app }) => {
            await app.client.createRoom({ name: "my room" });
            await createCustomSection(page, "Work");

            // Open the section header menu
            const sectionHeader = getSectionHeader(page, "Work");
            await sectionHeader.hover();
            await sectionHeader.getByRole("button", { name: "More options" }).click();

            // Click "Edit section"
            await page.getByRole("menuitem", { name: "Edit section" }).click();

            // The edit dialog should appear pre-filled with the current name
            const dialog = page.getByRole("dialog", { name: "Edit a section" });
            await expect(dialog).toBeVisible();
            await expect(dialog.getByRole("textbox", { name: "Section name" })).toHaveValue("Work");

            // Change the name and confirm
            await dialog.getByRole("textbox", { name: "Section name" }).fill("Personal");
            await dialog.getByRole("button", { name: "Edit section" }).click();

            // Dialog should close
            await expect(dialog).not.toBeVisible();

            // Section should have the new name
            await expect(getSectionHeader(page, "Personal")).toBeVisible();
            await expect(getSectionHeader(page, "Work")).not.toBeVisible();
        });
    });

    test.describe("Section removal", () => {
        test("should move rooms back to Chats when their section is removed", async ({ page, app }) => {
            await app.client.createRoom({ name: "my room" });
            await createCustomSection(page, "Work");
            await createCustomSection(page, "Personal");

            const roomList = getRoomList(page);

            // Move room to Work section
            const roomItem = roomList.getByRole("row", { name: "Open room my room" });
            await roomItem.hover();
            await roomItem.getByRole("button", { name: "More Options" }).click();
            await page.getByRole("menuitem", { name: "Move to" }).hover();
            await page.getByRole("menuitem", { name: "Work" }).click();
            await assertRoomInSection(page, "Work", "my room");

            // Remove the Work section
            const sectionHeader = getSectionHeader(page, "Work");
            await sectionHeader.hover();
            await sectionHeader.getByRole("button", { name: "More options" }).click();
            await page.getByRole("menuitem", { name: "Remove section" }).click();
            const dialog = page.getByRole("dialog", { name: "Remove section?" });
            await dialog.getByRole("button", { name: "Remove section" }).click();

            // Section should be gone
            await expect(getSectionHeader(page, "Work")).not.toBeVisible();
            // Room should now be in the Chats section
            await assertRoomInSection(page, "Chats", "my room");
        });
    });

    test.describe("Adding a room to a custom section", () => {
        test("should add a room to a custom section via the More Options menu", async ({ page, app }) => {
            await app.client.createRoom({ name: "my room" });
            await createCustomSection(page, "Work");

            const roomList = getRoomList(page);

            // Room starts in Chats section (aria-level=2)
            const roomItem = roomList.getByRole("row", { name: "Open room my room" });
            await expect(roomItem).toBeVisible();

            // Open More Options and move to the Work section
            await roomItem.hover();
            await roomItem.getByRole("button", { name: "More Options" }).click();
            await page.getByRole("menuitem", { name: "Move to" }).hover();
            await page.getByRole("menuitem", { name: "Work" }).click();

            // Room should now be nested under the Work section header (aria-level=1 → aria-level=2)
            await assertRoomInSection(page, "Work", "my room");
        });

        test(
            "should show 'Chat moved' toast when adding a room to a custom section",
            { tag: "@screenshot" },
            async ({ page, app }) => {
                await app.client.createRoom({ name: "my room" });
                await createCustomSection(page, "Work");

                const roomList = getRoomList(page);
                const roomItem = roomList.getByRole("row", { name: "Open room my room" });

                await roomItem.hover();
                await roomItem.getByRole("button", { name: "More Options" }).click();
                await page.getByRole("menuitem", { name: "Move to" }).hover();
                await page.getByRole("menuitem", { name: "Work" }).click();

                // The "Chat moved" toast should appear
                await expect(page.getByText("Chat moved")).toBeVisible();

                // Remove focus outline from the room item before taking the screenshot
                await page.getByRole("button", { name: "User menu" }).focus();

                await expect(roomList).toMatchScreenshot("room-list-sections-chat-moved-toast.png");
            },
        );

        test("should remove a room from a custom section when toggling the same section", async ({ page, app }) => {
            await app.client.createRoom({ name: "my room" });
            await createCustomSection(page, "Work");

            const roomList = getRoomList(page);

            // Move to Work section and verify placement via aria-level
            let roomItem = roomList.getByRole("row", { name: "Open room my room" });
            await roomItem.hover();
            await roomItem.getByRole("button", { name: "More Options" }).click();
            await page.getByRole("menuitem", { name: "Move to" }).hover();
            await page.getByRole("menuitem", { name: "Work" }).click();

            await assertRoomInSection(page, "Work", "my room");

            // Toggle off by selecting the same section again
            roomItem = roomList.getByRole("row", { name: "Open room my room" });
            await roomItem.hover();
            await roomItem.getByRole("button", { name: "More Options" }).click();
            await page.getByRole("menuitem", { name: "Move to" }).hover();
            await page.getByRole("menuitem", { name: "Work" }).click();

            // Room is back in the Chats section
            await assertRoomInSection(page, "Chats", "my room");
        });
    });
});

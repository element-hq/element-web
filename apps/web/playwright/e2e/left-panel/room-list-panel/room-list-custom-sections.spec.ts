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
});

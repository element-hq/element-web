/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { type Locator, type Page } from "@playwright/test";
import { closeReleaseAnnouncementIfExists, rejectToast } from "@element-hq/element-web-playwright-common";

import { expect, test } from "../../../element-web-test";
import { type ElementAppPage } from "../../../pages/ElementAppPage";
import {
    assertRoomInSection,
    assertSectionsOrder,
    dragRoomToSection,
    dragSectionToSection,
    getRoomList,
    getRoomListHeader,
    getSectionHeader,
} from "./utils";

test.describe("Room list custom sections", () => {
    test.use({
        displayName: "Alice",
        botCreateOpts: {
            displayName: "BotBob",
            autoAcceptInvites: true,
        },
    });

    /**
     * Create the rooms a test needs and wait for them to reach the room list.
     * The room picker reads the room list store once, when the room selection step opens, so the
     * rooms have to be there before the dialog is opened.
     * @param app
     * @param page
     * @param names The names of the rooms to create
     */
    async function createRooms(app: ElementAppPage, page: Page, names: string[]): Promise<void> {
        for (const name of names) await app.client.createRoom({ name });

        const roomList = getRoomList(page);
        for (const name of names) {
            await expect(roomList.getByRole("option", { name: `Open room ${name}` })).toBeVisible();
        }
    }

    /**
     * Get the room selection step of the section dialog.
     * The dialog is the same modal as the naming step, only its title changes.
     * @param page
     * @param sectionName The name of the section being created or edited
     */
    function getAddRoomsDialog(page: Page, sectionName: string): Locator {
        return page.getByRole("dialog", { name: `Add chats to ${sectionName}` });
    }

    /**
     * Create a custom section via the header compose menu and dialog.
     * @param page
     * @param sectionName The name of the section to create
     * @param roomNames The names of the rooms to put in the section. The room selection step is
     * skipped when none is given.
     */
    async function createCustomSection(page: Page, sectionName: string, roomNames: string[] = []): Promise<void> {
        const composeMenu = getRoomListHeader(page).getByRole("button", { name: "New conversation" });
        await composeMenu.click();
        await page.getByRole("menuitem", { name: "New section" }).click();

        // Fill in the section name in the dialog
        const dialog = page.getByRole("dialog", { name: "Create a section" });
        await expect(dialog).toBeVisible();
        await dialog.getByRole("textbox", { name: "Section name" }).fill(sectionName);
        await dialog.getByRole("button", { name: "Create section" }).click();

        const addRoomsDialog = getAddRoomsDialog(page, sectionName);
        for (const roomName of roomNames) {
            await addRoomsDialog.getByRole("option", { name: roomName }).click();
        }
        await addRoomsDialog.getByRole("button", { name: roomNames.length ? "Add chats" : "Skip" }).click();

        // Wait for the dialog to close
        await expect(addRoomsDialog).not.toBeVisible();
    }

    /**
     * Open the edit dialog of a custom section from its header menu and move to the room selection step.
     * @param page
     * @param sectionName The name of the section to edit
     * @param newName The new name to give the section. The current name is kept when not given.
     */
    async function openRoomSelectionOfSection(page: Page, sectionName: string): Promise<Locator> {
        const sectionHeader = getSectionHeader(page, sectionName);
        await sectionHeader.hover();
        // The section header button is "More options", the room row one is "More Options"
        await sectionHeader.getByRole("button", { name: "More options" }).click();
        await page.getByRole("menuitem", { name: "Edit section" }).click();

        const dialog = page.getByRole("dialog", { name: "Edit a section" });
        await expect(dialog).toBeVisible();
        await dialog.getByRole("button", { name: "Save" }).click();

        const addRoomsDialog = getAddRoomsDialog(page, sectionName);
        await expect(addRoomsDialog).toBeVisible();
        return addRoomsDialog;
    }

    test.beforeEach(async ({ page, app, user }) => {
        // The toasts are displayed above the search section
        await rejectToast(page, "Verify this device");
        await rejectToast(page, "Notifications");

        // Close the release announcement about the new room list sections
        await closeReleaseAnnouncementIfExists(page, "Introducing Sections");

        // Focus the user menu to avoid hover decoration
        await page.getByRole("button", { name: "User menu" }).focus();
    });

    test.describe("Section creation", () => {
        test("should create a custom section via the header compose menu", async ({ page, app }) => {
            await app.client.createRoom({ name: "my room" });

            await createCustomSection(page, "Work");

            // The custom section header should be visible (even though it is empty)
            await expect(getSectionHeader(page, "Work")).toBeVisible();
            // The Rooms section should also be visible
            await expect(getSectionHeader(page, "Rooms")).toBeVisible();
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
            let dialog = page.getByRole("dialog", { name: "Create a section" });
            await expect(dialog).toBeVisible();
            await dialog.getByRole("textbox", { name: "Section name" }).fill("Projects");
            await dialog.getByRole("button", { name: "Create section" }).click();
            dialog = page.getByRole("dialog", { name: "Add chats to Projects" });
            await dialog.getByRole("button", { name: "Skip" }).click();

            // Wait for the dialog to close
            await expect(dialog).not.toBeVisible();

            // The custom section should be created
            await expect(getSectionHeader(page, "Projects")).toBeVisible();

            // Skipping the room selection drops it, so the room stays where it was
            await assertRoomInSection(page, "Rooms", "my room");
        });

        test("should preselect the room when creating a section from its options menu", async ({ page, app }) => {
            await app.client.createRoom({ name: "alpha room" });
            await app.client.createRoom({ name: "beta room" });

            const roomList = getRoomList(page);
            const roomItem = roomList.getByRole("option", { name: "Open room alpha room" });
            await expect(roomItem).toBeVisible();
            await expect(roomList.getByRole("option", { name: "Open room beta room" })).toBeVisible();

            await roomItem.hover();
            await roomItem.getByRole("button", { name: "More Options" }).click();
            await page.getByRole("menuitem", { name: "Move to" }).hover();
            await page.getByRole("menuitem", { name: "New section" }).click();

            const dialog = page.getByRole("dialog", { name: "Create a section" });
            await dialog.getByRole("textbox", { name: "Section name" }).fill("Projects");
            await dialog.getByRole("button", { name: "Create section" }).click();

            // The room the menu was opened on is already selected on the room selection step
            const addRoomsDialog = getAddRoomsDialog(page, "Projects");
            await expect(addRoomsDialog.getByRole("option", { name: "alpha room" })).toHaveAttribute(
                "aria-selected",
                "true",
            );

            // Picking another room alongside it keeps both
            await addRoomsDialog.getByRole("option", { name: "beta room" }).click();
            await addRoomsDialog.getByRole("button", { name: "Add chats" }).click();
            await expect(addRoomsDialog).not.toBeVisible();

            await assertRoomInSection(page, "Projects", "alpha room");
            await assertRoomInSection(page, "Projects", "beta room");
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
            await expect(getSectionHeader(page, "Rooms")).not.toBeVisible();
        });

        test("should create multiple custom sections", async ({ page, app }) => {
            await app.client.createRoom({ name: "my room" });

            await createCustomSection(page, "Work");
            await createCustomSection(page, "Personal");

            // Both custom sections should be visible
            await expect(getSectionHeader(page, "Work")).toBeVisible();
            await expect(getSectionHeader(page, "Personal")).toBeVisible();
            await expect(getSectionHeader(page, "Rooms")).toBeVisible();
        });
    });

    test.describe("Selecting rooms in the section dialog", () => {
        test("should add the selected rooms to the new section", async ({ page, app }) => {
            await createRooms(app, page, ["alpha room", "beta room", "gamma room"]);

            const composeMenu = getRoomListHeader(page).getByRole("button", { name: "New conversation" });
            await composeMenu.click();
            await page.getByRole("menuitem", { name: "New section" }).click();
            const dialog = page.getByRole("dialog", { name: "Create a section" });
            await dialog.getByRole("textbox", { name: "Section name" }).fill("Work");
            await dialog.getByRole("button", { name: "Create section" }).click();

            const addRoomsDialog = getAddRoomsDialog(page, "Work");
            const addChatsButton = addRoomsDialog.getByRole("button", { name: "Add chats" });
            const alphaOption = addRoomsDialog.getByRole("option", { name: "alpha room" });

            // Nothing is selected yet, so there is nothing to apply
            await expect(addChatsButton).toBeDisabled();

            await alphaOption.click();
            await expect(alphaOption).toHaveAttribute("aria-selected", "true");
            await expect(addChatsButton).toBeEnabled();

            await addRoomsDialog.getByRole("option", { name: "beta room" }).click();
            await addChatsButton.click();
            await expect(addRoomsDialog).not.toBeVisible();

            await assertRoomInSection(page, "Work", "alpha room");
            await assertRoomInSection(page, "Work", "beta room");
            // The room that was not picked stays where it was
            await assertRoomInSection(page, "Rooms", "gamma room");
        });

        test("should add and remove rooms when editing a section", async ({ page, app }) => {
            await createRooms(app, page, ["alpha room", "beta room"]);
            await createCustomSection(page, "Work", ["alpha room"]);
            await assertRoomInSection(page, "Work", "alpha room");

            const addRoomsDialog = await openRoomSelectionOfSection(page, "Work");
            const alphaOption = addRoomsDialog.getByRole("option", { name: "alpha room" });
            const addChatsButton = addRoomsDialog.getByRole("button", { name: "Add chats" });

            // The rooms already in the section come back selected, so there is nothing to apply yet
            await expect(alphaOption).toHaveAttribute("aria-selected", "true");
            await expect(addChatsButton).toBeDisabled();

            // Swap the room in the section for another one
            await alphaOption.click();
            await addRoomsDialog.getByRole("option", { name: "beta room" }).click();
            await expect(addChatsButton).toBeEnabled();
            await addChatsButton.click();
            await expect(addRoomsDialog).not.toBeVisible();

            // The name did not change, but the rooms did
            await expect(getSectionHeader(page, "Work")).toBeVisible();
            await assertRoomInSection(page, "Work", "beta room");
            await assertRoomInSection(page, "Rooms", "alpha room");
        });
    });

    test.describe("Custom section display", () => {
        test("should show empty custom sections", async ({ page, app }) => {
            // Create a room so the Rooms section has something
            await app.client.createRoom({ name: "my room" });

            await createCustomSection(page, "Empty Section");

            // The custom section should be visible even with no rooms
            await expect(getSectionHeader(page, "Empty Section")).toBeVisible();
            // The room should still be in the Rooms section
            const roomList = getRoomList(page);
            await expect(roomList.getByRole("row", { name: "Open room my room" })).toBeVisible();
        });

        test("should display custom sections between Favourites and Rooms", async ({ page, app }) => {
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
            await expect(getSectionHeader(page, "Rooms")).toBeVisible();
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
            let dialog = page.getByRole("dialog", { name: "Edit a section" });
            await expect(dialog).toBeVisible();
            await expect(dialog.getByRole("textbox", { name: "Section name" })).toHaveValue("Work");

            // Change the name and confirm
            await dialog.getByRole("textbox", { name: "Section name" }).fill("Personal");
            await dialog.getByRole("button", { name: "Save" }).click();
            dialog = page.getByRole("dialog", { name: "Add chats to Personal" });
            await dialog.getByRole("button", { name: "Skip" }).click();

            // Dialog should close
            await expect(dialog).not.toBeVisible();

            // Section should have the new name
            await expect(getSectionHeader(page, "Personal")).toBeVisible();
            await expect(getSectionHeader(page, "Work")).not.toBeVisible();
        });
    });

    test.describe("Section removal", () => {
        test("should move rooms back to Rooms when their section is removed", async ({ page, app }) => {
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
            // Room should now be in the Rooms section
            await assertRoomInSection(page, "Rooms", "my room");
        });
    });

    test.describe("Collapse and expand all sections", () => {
        test("should collapse all sections when 'Collapse all sections' button is clicked", async ({ page, app }) => {
            await app.client.createRoom({ name: "my room" });
            await createCustomSection(page, "Work");

            const roomList = getRoomList(page);
            const header = getRoomListHeader(page);

            await expect(getSectionHeader(page, "Rooms")).toBeVisible();
            await expect(getSectionHeader(page, "Work")).toBeVisible();

            const collapseButton = header.getByRole("button", { name: "Collapse all sections" });
            await expect(collapseButton).toBeVisible();

            await expect(roomList.getByRole("row", { name: "Open room my room" })).toBeVisible();

            await collapseButton.click();

            await expect(getSectionHeader(page, "Rooms")).toHaveAttribute("aria-expanded", "false");
            await expect(getSectionHeader(page, "Work")).toHaveAttribute("aria-expanded", "false");
        });

        test("should expand all sections when 'Expand all sections' button is clicked", async ({ page, app }) => {
            await app.client.createRoom({ name: "my room" });
            await createCustomSection(page, "Work");

            const roomList = getRoomList(page);
            const header = getRoomListHeader(page);

            await expect(getSectionHeader(page, "Rooms")).toBeVisible();

            await header.getByRole("button", { name: "Collapse all sections" }).click();
            await expect(roomList.getByRole("row", { name: "Open room my room" })).not.toBeVisible();

            await header.getByRole("button", { name: "Expand all sections" }).click();

            await expect(getSectionHeader(page, "Rooms")).toHaveAttribute("aria-expanded", "true");
            await expect(getSectionHeader(page, "Work")).toHaveAttribute("aria-expanded", "true");
        });
    });

    test.describe("Section reordering via dnd", () => {
        test("should reorder custom sections via dnd", async ({ page, app }) => {
            await app.client.createRoom({ name: "my room" });
            await createCustomSection(page, "Work");
            await createCustomSection(page, "Personal");

            // Default placement: custom sections sit at the top of Rooms
            await assertSectionsOrder(page, ["Work", "Personal", "Rooms"]);

            // Moves Work after Rooms
            await dragSectionToSection(page, "Work", "Rooms");
            await assertSectionsOrder(page, ["Personal", "Rooms", "Work"]);
        });

        test("should insert a section before the target when dragging up", async ({ page, app }) => {
            await app.client.createRoom({ name: "my room" });
            await createCustomSection(page, "Work");
            await createCustomSection(page, "Personal");

            await assertSectionsOrder(page, ["Work", "Personal", "Rooms"]);

            // Personal sits below Work, so dragging it onto Work inserts it before Work.
            await dragSectionToSection(page, "Personal", "Work");
            await assertSectionsOrder(page, ["Personal", "Work", "Rooms"]);
        });
    });

    test.describe("Adding a room to a custom section", () => {
        test("should add a room to a custom section via the More Options menu", async ({ page, app }) => {
            await app.client.createRoom({ name: "my room" });
            await createCustomSection(page, "Work");

            const roomList = getRoomList(page);

            // Room starts in Rooms section (aria-level=2)
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

        test("should accept drag and drop into a section created after another section exists", async ({
            page,
            app,
        }) => {
            await app.client.createRoom({ name: "room A" });
            await app.client.createRoom({ name: "room B" });
            await createCustomSection(page, "Work");
            await createCustomSection(page, "Personal");

            await dragRoomToSection(page, "room A", "Personal");
            await assertRoomInSection(page, "Personal", "room A");

            await dragRoomToSection(page, "room B", "Work");
            await assertRoomInSection(page, "Work", "room B");
        });

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

            // Room is back in the Rooms section
            await assertRoomInSection(page, "Rooms", "my room");
        });

        test("should remove a room from a custom section via the 'Remove from section' menu entry", async ({
            page,
            app,
        }) => {
            await app.client.createRoom({ name: "my room" });
            await createCustomSection(page, "Work");

            const roomList = getRoomList(page);

            // Move the room to the Work section
            let roomItem = roomList.getByRole("row", { name: "Open room my room" });
            await roomItem.hover();
            await roomItem.getByRole("button", { name: "More Options" }).click();
            await page.getByRole("menuitem", { name: "Move to" }).hover();
            await page.getByRole("menuitem", { name: "Work" }).click();

            await assertRoomInSection(page, "Work", "my room");

            // Open the More Options menu and click "Remove from section"
            roomItem = roomList.getByRole("row", { name: "Open room my room" });
            await roomItem.hover();
            await roomItem.getByRole("button", { name: "More Options" }).click();
            await page.getByRole("menuitem", { name: "Remove from section" }).click();

            // Room is back in the Rooms section
            await assertRoomInSection(page, "Rooms", "my room");
        });
    });
});

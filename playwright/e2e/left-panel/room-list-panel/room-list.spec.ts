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
});

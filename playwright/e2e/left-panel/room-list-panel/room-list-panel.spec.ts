/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { type Page } from "@playwright/test";

import { test, expect } from "../../../element-web-test";

test.describe("Room list panel", () => {
    test.use({
        labsFlags: ["feature_new_room_list"],
    });

    /**
     * Get the room list view
     * @param page
     */
    function getRoomListView(page: Page) {
        return page.getByRole("navigation", { name: "Room list" });
    }

    test.beforeEach(async ({ page, app, user }) => {
        // The notification toast is displayed above the search section
        await app.closeNotificationToast();

        // Populate the room list
        for (let i = 0; i < 20; i++) {
            await app.client.createRoom({ name: `room${i}` });
        }

        // focus the user menu to avoid to have hover decoration
        await page.getByRole("button", { name: "User menu" }).focus();
    });

    test("should render the room list panel", { tag: "@screenshot" }, async ({ page, app, user }) => {
        const roomListView = getRoomListView(page);
        // Wait for the last room to be visible
        await expect(roomListView.getByRole("gridcell", { name: "Open room room19" })).toBeVisible();
        await expect(roomListView).toMatchScreenshot("room-list-panel.png");
    });

    test("should respond to small screen sizes", { tag: "@screenshot" }, async ({ page }) => {
        await page.setViewportSize({ width: 575, height: 600 });
        const roomListPanel = getRoomListView(page);
        await expect(roomListPanel).toMatchScreenshot("room-list-panel-smallscreen.png");
    });
});

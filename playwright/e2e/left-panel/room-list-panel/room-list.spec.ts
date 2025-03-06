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
        await expect(roomListView.getByRole("option", { name: "Open room room29" })).toBeVisible();
        await expect(roomListView).toMatchScreenshot("room-list.png");

        await roomListView.hover();
        // Scroll to the end of the room list
        await page.mouse.wheel(0, 1000);
        await expect(roomListView.getByRole("option", { name: "Open room room0" })).toBeVisible();
        await expect(roomListView).toMatchScreenshot("room-list-scrolled.png");
    });

    test("should open the room when it is clicked", async ({ page, app, user }) => {
        const roomListView = getRoomList(page);
        await roomListView.getByRole("option", { name: "Open room room29" }).click();
        await expect(page.getByRole("heading", { name: "room29", level: 1 })).toBeVisible();
    });
});

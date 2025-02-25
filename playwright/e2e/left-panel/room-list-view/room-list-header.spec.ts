/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { test, expect } from "../../../element-web-test";
import type { Page } from "@playwright/test";

test.describe("Header section of the room list", () => {
    test.use({
        labsFlags: ["feature_new_room_list"],
    });

    /**
     * Get the header section of the room list
     * @param page
     */
    function getHeaderSection(page: Page) {
        return page.getByTestId("room-list-header");
    }

    test.beforeEach(async ({ page, app, user }) => {
        // The notification toast is displayed above the search section
        await app.closeNotificationToast();
    });

    test("should render the header section", { tag: "@screenshot" }, async ({ page, app, user }) => {
        const roomListHeader = getHeaderSection(page);
        await expect(roomListHeader).toMatchScreenshot("room-list-header.png");

        const composeMenu = roomListHeader.getByRole("button", { name: "Add" });
        await composeMenu.click();

        await expect(page.getByRole("menu")).toMatchScreenshot("room-list-header-compose-menu.png");

        // New message should open the direct messages dialog
        await page.getByRole("menuitem", { name: "New message" }).click();
        await expect(page.getByRole("heading", { name: "Direct Messages" })).toBeVisible();
        await app.closeDialog();

        // New room should open the room creation dialog
        await composeMenu.click();
        await page.getByRole("menuitem", { name: "New room" }).click();
        await expect(page.getByRole("heading", { name: "Create a private room" })).toBeVisible();
        await app.closeDialog();
    });

    test("should render the header section for a space", { tag: "@screenshot" }, async ({ page, app, user }) => {
        await app.client.createSpace({ name: "MySpace" });
        await page.getByRole("button", { name: "MySpace" }).click();

        const roomListHeader = getHeaderSection(page);
        await expect(roomListHeader).toMatchScreenshot("room-list-space-header.png");

        await expect(roomListHeader.getByRole("heading", { name: "MySpace" })).toBeVisible();
        await expect(roomListHeader.getByRole("button", { name: "Add" })).toBeVisible();

        const spaceMenu = roomListHeader.getByRole("button", { name: "Open space menu" });
        await spaceMenu.click();

        await expect(page.getByRole("menu")).toMatchScreenshot("room-list-header-space-menu.png");

        // It should open the space home
        await page.getByRole("menuitem", { name: "Space home" }).click();
        await expect(page.getByRole("main").getByRole("heading", { name: "MySpace" })).toBeVisible();

        // It should open the invite dialog
        await spaceMenu.click();
        await page.getByRole("menuitem", { name: "Invite" }).click();
        await expect(page.getByRole("heading", { name: "Invite to MySpace" })).toBeVisible();
        await app.closeDialog();

        // It should open the space preferences
        await spaceMenu.click();
        await page.getByRole("menuitem", { name: "Preferences" }).click();
        await expect(page.getByRole("heading", { name: "Preferences" })).toBeVisible();
        await app.closeDialog();

        // It should open the space settings
        await spaceMenu.click();
        await page.getByRole("menuitem", { name: "Space Settings" }).click();
        await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
        await app.closeDialog();
    });
});

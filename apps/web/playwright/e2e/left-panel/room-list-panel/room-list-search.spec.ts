/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { type Page } from "@playwright/test";

import { test, expect } from "../../../element-web-test";

test.describe("Search section of the room list", () => {
    test.use({
        labsFlags: ["feature_new_room_list"],
    });

    /**
     * Get the search section of the room list
     * @param page
     */
    function getSearchSection(page: Page) {
        return page.getByRole("search");
    }

    test.beforeEach(async ({ page, app, user }) => {
        // The notification toast is displayed above the search section
        await app.closeNotificationToast();
    });

    test("should render the search section", { tag: "@screenshot" }, async ({ page, app, user }) => {
        const searchSection = getSearchSection(page);
        // exact=false to ignore the shortcut which is related to the OS
        await expect(searchSection.getByRole("button", { name: "Search", exact: false })).toBeVisible();
        await expect(searchSection).toMatchScreenshot("search-section.png");
    });

    test("should open the spotlight when the search button is clicked", async ({ page, app, user }) => {
        const searchSection = getSearchSection(page);
        await searchSection.getByRole("button", { name: "Search", exact: false }).click();
        // The spotlight should be displayed
        await expect(page.getByRole("dialog", { name: "Search Dialog" })).toBeVisible();
    });

    test("should open the room directory when the search button is clicked", async ({ page, app, user }) => {
        const searchSection = getSearchSection(page);
        await searchSection.getByRole("button", { name: "Explore rooms" }).click();
        const dialog = page.getByRole("dialog", { name: "Search Dialog" });
        // The room directory should be displayed
        await expect(dialog).toBeVisible();
        // The public room filter should be displayed
        await expect(dialog.getByText("Public rooms")).toBeVisible();
    });
});

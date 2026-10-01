/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { type Page } from "@playwright/test";
import { rejectToast } from "@element-hq/element-web-playwright-common";

import { test, expect } from "../../../element-web-test";
import { createFillerRooms, getRoomList, getSearchSection, getSectionHeader, sortAlphabetically } from "./utils";

test.describe("Search section of the room list", () => {
    test.beforeEach(async ({ page, app, user }) => {
        // The toasts are displayed above the search section
        await rejectToast(page, "Verify this device");
        await rejectToast(page, "Notifications");
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

    /** Open the spotlight, search for `name` and pick the first result. */
    async function pickRoomFromSpotlight(page: Page, name: string): Promise<void> {
        await getSearchSection(page).getByRole("button", { name: "Search", exact: false }).click();
        const dialog = page.getByRole("dialog", { name: "Search Dialog" });
        await dialog.getByRole("textbox", { name: "Search" }).fill(name);
        await dialog.getByRole("option", { name }).first().click();
        await expect(dialog).not.toBeVisible();
    }

    test("should scroll a room picked from the spotlight into view", async ({ page, app, user }) => {
        // A room named so it sorts to the very bottom under A-Z, pushed below the fold by fillers.
        await app.client.createRoom({ name: "zzz search target" });
        await createFillerRooms(app, 20);
        await sortAlphabetically(page);

        const targetRow = getRoomList(page).getByRole("option", { name: "Open room zzz search target" });
        await expect(targetRow).not.toBeInViewport();

        await pickRoomFromSpotlight(page, "zzz search target");

        await expect(targetRow).toBeInViewport();
    });

    test("should expand a collapsed section to show a room picked from the spotlight", async ({ page, app, user }) => {
        const targetId = await app.client.createRoom({ name: "zzz search target" });
        await app.client.evaluate(async (client, roomId) => {
            await client.setRoomTag(roomId, "m.favourite");
        }, targetId);
        await createFillerRooms(app, 5);

        const favouritesHeader = getSectionHeader(page, "Favourites");
        await expect(favouritesHeader).toBeVisible();
        await favouritesHeader.click();
        await expect(favouritesHeader).toHaveAttribute("aria-expanded", "false");

        await pickRoomFromSpotlight(page, "zzz search target");

        await expect(favouritesHeader).toHaveAttribute("aria-expanded", "true");
        // A sectioned list is a treegrid, so rooms are rows rather than options.
        const targetRow = getRoomList(page).getByRole("row", { name: "Open room zzz search target" });
        await expect(targetRow).toBeInViewport();
    });
});

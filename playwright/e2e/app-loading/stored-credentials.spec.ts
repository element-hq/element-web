/*
Copyright 2024 New Vector Ltd.
Copyright 2024 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { expect, test } from "../../element-web-test";
import { ElementAppPage } from "../../pages/ElementAppPage";

/*
 * Tests for application startup with credentials stored in localstorage.
 */

test.use({ displayName: "Boris" });

test("Shows the homepage by default", async ({ pageWithCredentials: page }) => {
    await page.goto("/");
    await page.waitForSelector(".mx_MatrixChat", { timeout: 30000 });

    await expect(page).toHaveURL(/\/#\/home/);
    await expect(page.getByRole("heading", { name: "Welcome Boris", exact: true })).toBeVisible();
});

test("Shows the last known page on reload", async ({ pageWithCredentials: page }) => {
    await page.goto("/");
    await page.waitForSelector(".mx_MatrixChat", { timeout: 30000 });

    const app = new ElementAppPage(page);
    await app.client.createRoom({ name: "Test Room" });
    await app.viewRoomByName("Test Room");

    // Navigate away
    await page.goto("about:blank");

    // And back again
    await page.goto("/");
    await page.waitForSelector(".mx_MatrixChat", { timeout: 30000 });

    // Check that the room reloaded
    await expect(page).toHaveURL(/\/#\/room\//);
    await expect(page.locator(".mx_RoomHeader")).toContainText("Test Room");
});

test("Room link correctly loads a room view", async ({ pageWithCredentials: page }) => {
    await page.goto("/#/room/!room:id");
    await page.waitForSelector(".mx_MatrixChat", { timeout: 30000 });

    await expect(page).toHaveURL(/\/#\/room\/!room:id$/);
    await expect(page.getByRole("button", { name: "Join the discussion" })).toBeVisible();
});

test("Login link redirects to home page", async ({ pageWithCredentials: page }) => {
    await page.goto("/#/login");
    await page.waitForSelector(".mx_MatrixChat", { timeout: 30000 });

    await expect(page).toHaveURL(/\/#\/home/);
    await expect(page.getByRole("heading", { name: "Welcome Boris", exact: true })).toBeVisible();
});

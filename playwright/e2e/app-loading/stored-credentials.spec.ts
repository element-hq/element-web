/*
Copyright 2024 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
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

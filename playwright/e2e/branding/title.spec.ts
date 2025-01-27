/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { expect, test } from "../../element-web-test";

/*
 * Tests for branding configuration
 **/

test.describe("Test without branding config", () => {
    test("Shows standard branding when showing the home page", async ({ pageWithCredentials: page }) => {
        await page.goto("/");
        await page.waitForSelector(".mx_MatrixChat", { timeout: 30000 });
        expect(page.title()).toEqual("Element *");
    });
    test("Shows standard branding when showing a room", async ({ app, pageWithCredentials: page }) => {
        await app.client.createRoom({ name: "Test Room" });
        await app.viewRoomByName("Test Room");
        expect(page.title()).toEqual("Element * | Test Room");
    });
});

test.describe("Test with custom branding", () => {
    test.use({
        config: {
            brand: "TestBrand",
        },
    });
    test("Shows custom branding when showing the home page", async ({ pageWithCredentials: page }) => {
        await page.goto("/");
        await page.waitForSelector(".mx_MatrixChat", { timeout: 30000 });
        expect(page.title()).toEqual("TestingApp TestBrand * $ignoredParameter");
    });
    test("Shows custom branding when showing a room", async ({ app, pageWithCredentials: page }) => {
        await app.client.createRoom({ name: "Test Room" });
        await app.viewRoomByName("Test Room");
        expect(page.title()).toEqual("TestingApp TestBrand * Test Room $ignoredParameter");
    });
});

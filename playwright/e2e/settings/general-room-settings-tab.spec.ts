/*
Copyright 2024 New Vector Ltd.
Copyright 2023 Suguru Hirahara

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { test, expect } from "../../element-web-test";

test.describe("General room settings tab", () => {
    const roomName = "Test Room";

    test.use({
        displayName: "Hanako",
    });

    test.beforeEach(async ({ user, app }) => {
        await app.client.createRoom({ name: roomName });
        await app.viewRoomByName(roomName);
    });

    test("should be rendered properly", { tag: "@screenshot" }, async ({ page, app }) => {
        const settings = await app.settings.openRoomSettings("General");

        // Assert that "Show less" details element is rendered
        await expect(settings.getByText("Show less")).toBeVisible();

        await expect(settings).toMatchScreenshot("General-room-settings-tab-should-be-rendered-properly-1.png");

        // Click the "Show less" details element
        await settings.getByText("Show less").click();

        // Assert that "Show more" details element is rendered instead of "Show more"
        await expect(settings.getByText("Show less")).not.toBeVisible();
        await expect(settings.getByText("Show more")).toBeVisible();
    });

    test("long address should not cause dialog to overflow", { tag: "@no-webkit" }, async ({ page, app, user }) => {
        const settings = await app.settings.openRoomSettings("General");
        // 1. Set the room-address to be a really long string
        const longString = "abcasdhjasjhdaj1jh1asdhasjdhajsdhjavhjksd".repeat(4);
        await settings.locator("#roomAliases input[label='Room address']").fill(longString);
        await expect(page.getByText("This address is available to use")).toBeVisible();
        await settings.locator("#roomAliases").getByText("Add", { exact: true }).click();

        // 2. wait for the new setting to apply ...
        await expect(settings.locator("#canonicalAlias")).toHaveValue(`#${longString}:${user.homeServer}`);

        // 3. Check if the dialog overflows
        const dialogBoundingBox = await page.locator(".mx_Dialog").boundingBox();
        const inputBoundingBox = await settings.locator("#canonicalAlias").boundingBox();
        // Assert that the width of the select element is less than that of .mx_Dialog div.
        expect(inputBoundingBox.width).toBeLessThan(dialogBoundingBox.width);
    });
});

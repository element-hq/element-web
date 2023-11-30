/*
Copyright 2023 Suguru Hirahara

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

    test("should be rendered properly", async ({ page, app }) => {
        const settings = await app.settings.openRoomSettings("General");

        // Assert that "Show less" details element is rendered
        await expect(settings.getByText("Show less")).toBeVisible();

        await expect(settings).toHaveScreenshot();

        // Click the "Show less" details element
        await settings.getByText("Show less").click();

        // Assert that "Show more" details element is rendered instead of "Show more"
        await expect(settings.getByText("Show less")).not.toBeVisible();
        await expect(settings.getByText("Show more")).toBeVisible();
    });

    test("long address should not cause dialog to overflow", async ({ page, app }) => {
        const settings = await app.settings.openRoomSettings("General");
        // 1. Set the room-address to be a really long string
        const longString = "abcasdhjasjhdaj1jh1asdhasjdhajsdhjavhjksd".repeat(4);
        await settings.locator("#roomAliases input[label='Room address']").fill(longString);
        await settings.locator("#roomAliases").getByText("Add", { exact: true }).click();

        // 2. wait for the new setting to apply ...
        await expect(settings.locator("#canonicalAlias")).toHaveValue(`#${longString}:localhost`);

        // 3. Check if the dialog overflows
        const dialogBoundingBox = await page.locator(".mx_Dialog").boundingBox();
        const inputBoundingBox = await settings.locator("#canonicalAlias").boundingBox();
        // Assert that the width of the select element is less than that of .mx_Dialog div.
        expect(inputBoundingBox.width).toBeLessThan(dialogBoundingBox.width);
    });
});

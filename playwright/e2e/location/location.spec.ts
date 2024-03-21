/*
Copyright 2022 The Matrix.org Foundation C.I.C.

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

import { Locator, Page } from "@playwright/test";

import { test, expect } from "../../element-web-test";

test.describe("Location sharing", () => {
    const selectLocationShareTypeOption = (page: Page, shareType: string): Locator => {
        return page.getByTestId(`share-location-option-${shareType}`);
    };

    const submitShareLocation = (page: Page): Promise<void> => {
        return page.getByRole("button", { name: "Share location" }).click();
    };

    test.use({
        displayName: "Tom",
    });

    test.beforeEach(async ({ page }) => {
        await page.addInitScript(() => {
            window.localStorage.setItem("mx_lhs_size", "0");
        });
    });

    test("sends and displays pin drop location message successfully", async ({ page, user, app }) => {
        const roomId = await app.client.createRoom({});
        await page.goto(`/#/room/${roomId}`);

        const composerOptions = await app.openMessageComposerOptions();
        await composerOptions.getByRole("menuitem", { name: "Location", exact: true }).click();

        await selectLocationShareTypeOption(page, "Pin").click();

        await page.locator("#mx_LocationPicker_map").click();

        await submitShareLocation(page);

        await page.locator(".mx_RoomView_body .mx_EventTile .mx_MLocationBody").click({
            position: {
                x: 225,
                y: 150,
            },
        });

        // clicking location tile opens maximised map
        await expect(page.getByRole("dialog")).toBeVisible();

        await app.closeDialog();

        await expect(page.locator(".mx_Marker")).toBeVisible();
    });
});

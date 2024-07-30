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

import { test, expect } from "../../element-web-test";

test.describe("Image Upload", () => {
    test.use({
        displayName: "Alice",
    });

    test.beforeEach(async ({ page, app, user }) => {
        await app.client.createRoom({ name: "My Pictures" });
        await app.viewRoomByName("My Pictures");

        // Wait until configuration is finished
        await expect(
            page
                .locator(".mx_GenericEventListSummary[data-layout='group'] .mx_GenericEventListSummary_summary")
                .getByText(`${user.displayName} created and configured the room.`),
        ).toBeVisible();
    });

    test("should show image preview when uploading an image", async ({ page, app }) => {
        await page
            .locator(".mx_MessageComposer_actions input[type='file']")
            .setInputFiles("playwright/sample-files/riot.png");

        await expect(page.getByRole("button", { name: "Upload" })).toBeEnabled();
        await expect(page.getByRole("button", { name: "Close dialog" })).toBeEnabled();
        await expect(page.locator(".mx_Dialog")).toMatchScreenshot("image-upload-preview.png");
    });
});

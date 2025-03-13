/*
Copyright 2024 New Vector Ltd.
Copyright 2024 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
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

    test("should show image preview when uploading an image", { tag: "@screenshot" }, async ({ page, app }) => {
        await page
            .locator(".mx_MessageComposer_actions input[type='file']")
            .setInputFiles("playwright/sample-files/riot.png");

        await expect(page.getByRole("button", { name: "Upload" })).toBeEnabled();
        await expect(page.getByRole("button", { name: "Close dialog" })).toBeEnabled();
        await expect(page.locator(".mx_Dialog")).toMatchScreenshot("image-upload-preview.png");
    });
});

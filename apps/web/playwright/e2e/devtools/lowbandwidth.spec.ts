/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { test, expect } from "../../element-web-test";
import { getSampleFilePath } from "../../sample-files";

test.describe("Devtools", () => {
    test.use({
        displayName: "Alice",
    });

    test("should allow enabling low bandwidth mode", async ({ page, homeserver, user, app }) => {
        // Upload a picture
        const userSettings = await app.settings.openUserSettings("Account");
        const profileSettings = userSettings.locator(".mx_UserProfileSettings");
        await profileSettings.getByAltText("Upload").setInputFiles(getSampleFilePath("riot.png"));
        await app.closeDialog();

        // Create an initial room.
        const createRoomDialog = await app.openCreateRoomDialog();
        await createRoomDialog.getByRole("textbox", { name: "Name" }).fill("Test Room");
        await createRoomDialog.getByRole("button", { name: "Create room" }).click();

        const composer = app.getComposer().locator("[contenteditable]");
        await composer.fill("/devtools");
        await composer.press("Enter");
        const dialog = page.locator(".mx_Dialog");
        await dialog.getByLabel("Developer mode").check();
        await dialog.getByLabel("Disable bandwidth-heavy features").click();
        // Wait for refresh.
        await page.waitForEvent("domcontentloaded");
        await app.viewRoomByName("Test Room");

        // This only appears when encryption has been disabled in the client.
        await expect(page.getByText("The encryption used by this room isn't supported.")).toBeVisible();

        // None of these should be requested.
        let hasSentTyping = false;
        let hasRequestedThumbnail = false;
        await page.route("**/_matrix/client/v3/rooms/*/typing/*", async (route) => {
            hasSentTyping = true;
            await route.fulfill({ json: {} });
        });
        await page.route("**/_matrix/media/v3/thumbnail/**", async (route) => {
            hasRequestedThumbnail = true;
            await route.fulfill({ json: {} });
        });
        await page.route("**/_matrix/client/v1/media/thumbnail/**", async (route) => {
            hasRequestedThumbnail = true;
            await route.fulfill({ json: {} });
        });

        await composer.pressSequentially("Provoke typing request", { delay: 5 });
        expect(hasSentTyping).toEqual(false);
        expect(hasRequestedThumbnail).toEqual(false);
    });
});

/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { test, expect } from "../../element-web-test";

test.describe("Devtools", () => {
    test.use({
        displayName: "Alice",
    });

    test("should allow enabling low bandwidth mode", async ({ page, homeserver, user, app }) => {
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
        await expect(page.getByText("The encryption used by this room isn't supported.")).toBeVisible();
    });
});

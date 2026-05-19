/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { test, expect } from "../../element-web-test";
import { getSampleFilePath } from "../../sample-files";

test.describe("Composer API", () => {
    test.use({
        displayName: "Manny",
        config: {
            modules: ["/modules/upload-module.js"],
        },
        page: async ({ page }, use) => {
            await page.route("/modules/upload-module.js", async (route) => {
                await route.fulfill({ path: getSampleFilePath("upload-module.js") });
            });
            await use(page);
        },
        room: async ({ page, app, user, bot }, use) => {
            const roomId = await app.client.createRoom({ name: "TestRoom" });
            await use({ roomId });
        },
    });
    test("should be able to select custom uploader", async ({ page, room, app }) => {
        page.on("dialog", (dialog) => console.log("Dialog discovered", dialog));
        await app.viewRoomById(room.roomId);
        await app.getComposer().getByRole("button", { name: "Attachment" }).click();
        await page.getByRole("menuitem", { name: "Example uploader" }).click({ noWaitAfter: true });
        await page.locator(".mx_Dialog").getByRole("button", { name: "Upload" }).click();
        const fileTile = page.locator(".mx_MFileBody").first();
        await expect(fileTile).toBeVisible();
    });
});

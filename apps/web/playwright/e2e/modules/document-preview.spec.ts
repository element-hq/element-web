/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type Page } from "@playwright/test";

import { test, expect } from "../../element-web-test";
import { getSampleFilePath } from "../../sample-files";
import { type ElementAppPage } from "../../pages/ElementAppPage";

/**
 * Pick one of the module's upload options. The module previews the file if the client gives it an
 * opener, and otherwise opens the upload dialog for it instead.
 */
async function selectModuleOption(page: Page, app: ElementAppPage, name: string): Promise<void> {
    await app.getComposer().getByRole("button", { name: "Attachment" }).click();
    await page.getByRole("menuitem", { name }).click({ noWaitAfter: true });
}

test.describe("Document Preview API", () => {
    test.use({
        displayName: "Manny",
        labsFlags: ["feature_pdf_viewer"],
        config: {
            modules: ["/modules/document-preview-module.js"],
        },
        page: async ({ page }, use) => {
            await page.route("/modules/document-preview-module.js", async (route) => {
                await route.fulfill({ path: getSampleFilePath("document-preview-module.js") });
            });
            await use(page);
        },
        room: async ({ page, app, user }, use) => {
            const roomId = await app.client.createRoom({ name: "TestRoom" });
            await use({ roomId });
        },
    });

    test("should open a file from a module in the right panel", async ({ page, room, app }) => {
        await app.viewRoomById(room.roomId);
        await selectModuleOption(page, app, "Preview Markdown");

        const rightPanel = page.locator(".mx_RightPanel");
        await expect(rightPanel.getByRole("heading", { name: "notes.md" })).toBeVisible();
        await expect(rightPanel.getByRole("heading", { name: "Module heading" })).toBeVisible();
        await expect(rightPanel.getByText("Module body text")).toBeVisible();
        await expect(page.locator(".mx_Dialog")).not.toBeVisible();
    });

    test("should title the preview generically when the file has no name", async ({ page, room, app }) => {
        await app.viewRoomById(room.roomId);
        await selectModuleOption(page, app, "Preview unnamed Markdown");

        const rightPanel = page.locator(".mx_RightPanel");
        await expect(rightPanel.getByRole("heading", { name: "Document" })).toBeVisible();
        await expect(rightPanel.getByRole("heading", { name: "Module heading" })).toBeVisible();
    });

    test("should show an error when the file cannot be loaded", async ({ page, room, app }) => {
        await app.viewRoomById(room.roomId);
        await selectModuleOption(page, app, "Preview broken Markdown");

        const rightPanel = page.locator(".mx_RightPanel");
        await expect(rightPanel.getByRole("heading", { name: "broken.md" })).toBeVisible();
        await expect(rightPanel.getByRole("alert")).toHaveText("Unable to load this file.");
    });
});

/*
Copyright 2024 New Vector Ltd.
Copyright 2024 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type Page } from "@playwright/test";

import { test, expect } from "../../element-web-test";
import { getSampleFilePath, readSampleFile } from "../../sample-files";

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
        await app.setComposerInputFiles("room", getSampleFilePath("riot.png"));

        await expect(page.getByRole("button", { name: "Upload" })).toBeEnabled();
        await expect(page.getByRole("button", { name: "Close dialog" })).toBeEnabled();
        await expect(page.locator(".mx_Dialog")).toMatchScreenshot("image-upload-preview.png");
    });

    test.describe("metadata", () => {
        test.use({ labsFlags: ["feature_strip_upload_metadata"] });

        /** Starts waiting for the upload of the file's content, returning its body. */
        function waitForUpload(page: Page): Promise<Buffer> {
            return page
                .waitForRequest((request) => request.method() === "POST" && /\/media\/v3\/upload/.test(request.url()))
                .then((request) => request.postDataBuffer()!);
        }

        test("removes location and other metadata from photos", async ({ page, app }) => {
            const original = await readSampleFile("photo-with-metadata.jpg", null);
            expect(original.includes("LeakyMake")).toBe(true);

            await app.setComposerInputFiles("room", getSampleFilePath("photo-with-metadata.jpg"));
            const dialog = page.locator(".mx_Dialog");
            const checkbox = dialog.getByRole("checkbox", { name: "Remove location and other metadata" });
            await expect(checkbox).toBeEnabled();
            await expect(checkbox).toBeChecked();

            const upload = waitForUpload(page);
            await dialog.getByRole("button", { name: "Upload" }).click();

            const uploaded = await upload;
            expect(uploaded.length).toBeLessThan(original.length);
            expect(uploaded.includes("Leaky")).toBe(false);
        });

        test("sends the photo unchanged when the option is unticked", async ({ page, app }) => {
            const original = await readSampleFile("photo-with-metadata.jpg", null);

            await app.setComposerInputFiles("room", getSampleFilePath("photo-with-metadata.jpg"));
            const dialog = page.locator(".mx_Dialog");
            const checkbox = dialog.getByRole("checkbox", { name: "Remove location and other metadata" });
            await expect(checkbox).toBeEnabled();
            await checkbox.uncheck();

            const upload = waitForUpload(page);
            await dialog.getByRole("button", { name: "Upload" }).click();

            expect((await upload).equals(original)).toBe(true);
        });
    });

    test("should allow upload via drag and drop", { tag: "@screenshot" }, async ({ page, app }) => {
        await app.composerDragAndUploadFiles("room", getSampleFilePath("riot.png"), "image/png");
        await app.timeline.scrollToBottom();
        const imgTile = page.locator(".mx_ImageBody").first();
        await expect(imgTile).toBeVisible();
    });
});

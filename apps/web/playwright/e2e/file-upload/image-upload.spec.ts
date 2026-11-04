/*
Copyright 2024 New Vector Ltd.
Copyright 2024 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type APIRequestContext, type Page } from "@playwright/test";

import { test, expect } from "../../element-web-test";
import { type Credentials } from "../../plugins/homeserver";
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

        /**
         * Starts waiting for the file to be sent, returning the content the homeserver stored for it.
         * The upload itself can't be inspected: when the browser sends the picked file, it does not expose the request body.
         */
        async function waitForUpload(page: Page, request: APIRequestContext, user: Credentials): Promise<Buffer> {
            const send = await page.waitForRequest(
                (sendRequest) => sendRequest.method() === "PUT" && /\/send\/m\.room\.message\//.test(sendRequest.url()),
            );
            const contentUri: string = send.postDataJSON().url;
            const [, serverName, mediaId] = /^mxc:\/\/([^/]+)\/(.+)$/.exec(contentUri)!;
            const download = await request.get(
                `${user.homeserverBaseUrl}/_matrix/client/v1/media/download/${serverName}/${mediaId}`,
                { headers: { Authorization: `Bearer ${user.accessToken}` } },
            );
            expect(download.ok()).toBe(true);
            return download.body();
        }

        test("removes location and other metadata from photos", async ({ page, app, request, user }) => {
            const original = await readSampleFile("photo-with-metadata.jpg", null);
            expect(original.includes("LeakyMake")).toBe(true);

            await app.setComposerInputFiles("room", getSampleFilePath("photo-with-metadata.jpg"));
            const dialog = page.locator(".mx_Dialog");
            const checkbox = dialog.getByRole("checkbox", { name: "Remove location and other metadata" });
            await expect(checkbox).toBeEnabled();
            await expect(checkbox).toBeChecked();

            const upload = waitForUpload(page, request, user);
            await dialog.getByRole("button", { name: "Upload" }).click();

            const uploaded = await upload;
            expect(uploaded.length).toBeLessThan(original.length);
            expect(uploaded.includes("Leaky")).toBe(false);
        });

        test("sends the photo unchanged when the option is unticked", async ({ page, app, request, user }) => {
            const original = await readSampleFile("photo-with-metadata.jpg", null);

            await app.setComposerInputFiles("room", getSampleFilePath("photo-with-metadata.jpg"));
            const dialog = page.locator(".mx_Dialog");
            const checkbox = dialog.getByRole("checkbox", { name: "Remove location and other metadata" });
            await expect(checkbox).toBeEnabled();
            await checkbox.uncheck();

            const upload = waitForUpload(page, request, user);
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

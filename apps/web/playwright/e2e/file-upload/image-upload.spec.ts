/*
Copyright 2024 New Vector Ltd.
Copyright 2024 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { test, expect } from "../../element-web-test";
import { getSampleFilePath } from "../../sample-files";

// An 8x6 image encoded at the default tier, which decodes to 32x24
const CHROMAHASH = "CI3MoG9AmAnNGYkQqiba5W6aHRHekEwBslZsOUoyR04";

test.describe("Image Upload", () => {
    test.use({
        displayName: "Alice",
    });

    let roomId: string;

    test.beforeEach(async ({ page, app, user }) => {
        roomId = await app.client.createRoom({ name: "My Pictures" });
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

    test("should allow upload via drag and drop", { tag: "@screenshot" }, async ({ page, app }) => {
        await app.composerDragAndUploadFiles("room", getSampleFilePath("riot.png"), "image/png");
        await app.timeline.scrollToBottom();
        const imgTile = page.locator(".mx_ImageBody").first();
        await expect(imgTile).toBeVisible();
    });

    test("should send blurhash and chromahash placeholders with an image", async ({ page, app }) => {
        const sendRequest = page.waitForRequest(
            (request) => request.method() === "PUT" && request.url().includes("/send/m.room.message/"),
        );
        await app.composerUploadFiles("room", getSampleFilePath("riot.png"));

        const { info } = (await sendRequest).postDataJSON();
        expect(info["xyz.amorgan.blurhash"]).toEqual(expect.any(String));
        // Unpadded base64 of the ChromaHash bytes
        expect(info["xyz.amorgan.chromahash"]).toMatch(/^[A-Za-z0-9+/]+$/);
    });

    test("should show the chromahash placeholder while an image loads", async ({ page, context, app }) => {
        // Never answer media requests, so the image stays loading and the placeholder stays up.
        // Routed on the context so that media fetched by the service worker is caught too.
        await context.route(/\/media\/(.*\/)?(download|thumbnail)\//, () => {});

        await app.client.sendMessage(roomId, {
            msgtype: "m.image",
            body: "placeholder.png",
            url: "mxc://localhost/never-loads",
            info: { "w": 640, "h": 480, "mimetype": "image/png", "xyz.amorgan.chromahash": CHROMAHASH },
        });

        // The chromahash is drawn at its natural 32x24 resolution and scaled up with CSS
        const tile = page.locator(".mx_EventTile").last();
        await expect(tile.locator("canvas[width='32'][height='24']")).toBeVisible();
    });
});

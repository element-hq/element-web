/*
Copyright 2026 Alar Mäerand

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { readFile } from "node:fs/promises";

import { type Locator, type Page } from "@playwright/test";
import { test, expect } from "../../element-web-test";
import { getSampleFilePath } from "../../sample-files";
import { type ElementAppPage } from "../../pages/ElementAppPage";

const SAMPLE_IMAGES = [getSampleFilePath("riot.png"), getSampleFilePath("element.png")];
const SAMPLE_VIDEO = getSampleFilePath("5secvid.webm");

test.describe("Gallery messages", () => {
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

    /** The images and videos waiting in the composer, with the tile to add more. */
    function attachments(page: Page): Locator {
        return page.getByRole("region", { name: "Message composer" }).getByRole("list");
    }

    /** Send the sample files as a gallery from the composer and wait for it to appear. */
    async function sendGallery(page: Page, app: ElementAppPage, caption?: string): Promise<Locator> {
        await app.setComposerInputFiles("room", [...SAMPLE_IMAGES, SAMPLE_VIDEO]);
        await expect(attachments(page).getByRole("listitem")).toHaveCount(4); // three items and the add tile

        // The composer is ready to type into, and its text is sent with the attachments.
        const composer = app.getComposerField();
        await expect(composer).toBeFocused();
        if (caption) await composer.pressSequentially(caption);
        await composer.press("Enter");

        const gallery = page.getByRole("group", { name: "Gallery with 3 items" });
        await expect(gallery).toBeVisible();
        return gallery;
    }

    test.describe("sending", () => {
        test.use({ labsFlags: ["feature_gallery_messages"] });

        test("should send several images and videos as one gallery with a caption", async ({ page, app }) => {
            const tilesBefore = await page.locator(".mx_EventTile_line").count();
            const gallery = await sendGallery(page, app, "Our **holiday** photos");

            await expect(gallery.getByRole("button")).toHaveCount(3);
            await expect(gallery.getByRole("button", { name: "Video 3 of 3" })).toBeVisible();

            // The caption belongs to the same message as the items, and is formatted like any other message.
            const tile = page.locator(".mx_EventTile").filter({ has: gallery });
            await expect(tile.getByText("Our holiday photos")).toBeVisible();
            await expect(tile.locator("strong").getByText("holiday")).toBeVisible();
            // It was sent as one message, and nothing is left behind in the composer
            await expect(page.locator(".mx_EventTile_line")).toHaveCount(tilesBefore + 1);
            await expect(attachments(page)).not.toBeVisible();
            await expect(app.getComposerField()).toHaveText("");
        });

        test("should send the attachments with a message that was already being written", async ({ page, app }) => {
            const tilesBefore = await page.locator(".mx_EventTile_line").count();
            const composer = app.getComposerField();
            await composer.pressSequentially("Look at these");

            await app.setComposerInputFiles("room", SAMPLE_IMAGES);
            await expect(attachments(page).getByRole("listitem")).toHaveCount(3);
            // Nothing is sent until the user sends the message
            await expect(page.locator(".mx_EventTile_line")).toHaveCount(tilesBefore);

            await composer.pressSequentially(" two");
            await page.getByRole("button", { name: "Send message" }).click();

            const gallery = page.getByRole("group", { name: "Gallery with 2 items" });
            await expect(
                page.locator(".mx_EventTile").filter({ has: gallery }).getByText("Look at these two"),
            ).toBeVisible();
            await expect(page.locator(".mx_EventTile_line")).toHaveCount(tilesBefore + 1);
        });

        test("should let the user remove items and add more before sending", async ({ page, app }) => {
            await app.setComposerInputFiles("room", SAMPLE_IMAGES);
            const tray = attachments(page);
            await expect(tray.getByRole("listitem")).toHaveCount(3);

            await tray.getByRole("button", { name: "Remove riot.png" }).click();
            await expect(tray.getByRole("listitem")).toHaveCount(2);

            await page
                .getByRole("region", { name: "Message composer" })
                .getByTestId("gallery-composer-file-input")
                .setInputFiles([SAMPLE_VIDEO, SAMPLE_IMAGES[0]]);
            await expect(tray.getByRole("listitem")).toHaveCount(4);
            await expect(tray.getByRole("img", { name: "element.png" })).toBeVisible();
            await expect(tray.getByRole("img", { name: "riot.png" })).toBeVisible();

            // Attachments can be sent without any text
            await page.getByRole("button", { name: "Send message" }).click();
            await expect(page.getByRole("group", { name: "Gallery with 3 items" })).toBeVisible();
        });

        test("should send nothing when every attachment is removed", async ({ page, app }) => {
            await app.setComposerInputFiles("room", SAMPLE_IMAGES[0]);
            const tray = attachments(page);
            await tray.getByRole("button", { name: "Remove riot.png" }).click();

            await expect(tray).not.toBeVisible();
            await expect(page.getByRole("button", { name: "Send message" })).not.toBeVisible();
        });

        test("should send a single image as an ordinary image message with its caption", async ({ page, app }) => {
            const tilesBefore = await page.locator(".mx_EventTile_line").count();
            await app.setComposerInputFiles("room", SAMPLE_IMAGES[0]);
            await expect(attachments(page).getByRole("listitem")).toHaveCount(2);

            const composer = app.getComposerField();
            await composer.pressSequentially("Just the one");
            await composer.press("Enter");

            const tile = page.locator(".mx_EventTile").filter({ has: page.locator(".mx_ImageBody") });
            await expect(tile.getByText("Just the one")).toBeVisible();
            await expect(page.getByRole("group", { name: /Gallery/ })).not.toBeVisible();
            await expect(page.locator(".mx_EventTile_line")).toHaveCount(tilesBefore + 1);
        });

        test("should open the items in the viewer and move between them", async ({ page, app }) => {
            const gallery = await sendGallery(page, app);

            await gallery.getByRole("button", { name: "Image 1 of 3" }).click();
            const viewer = page.getByRole("dialog", { name: "Image view" });
            await expect(viewer.getByText("riot.png (1 of 3)")).toBeVisible();
            await expect(viewer.getByRole("img", { name: "riot.png" })).toBeVisible();
            await expect(viewer.getByRole("button", { name: "Previous" })).not.toBeVisible();

            await viewer.getByRole("button", { name: "Next" }).click();
            await expect(viewer.getByText("element.png (2 of 3)")).toBeVisible();

            await page.keyboard.press("ArrowRight");
            await expect(viewer.getByText("5secvid.webm (3 of 3)")).toBeVisible();
            await expect(viewer.locator("video")).toBeVisible();
            await expect(viewer.getByRole("button", { name: "Next" })).not.toBeVisible();

            await viewer.getByRole("button", { name: "Previous" }).click();
            await expect(viewer.getByText("element.png (2 of 3)")).toBeVisible();

            await viewer.getByRole("button", { name: "Close" }).click();
            await expect(viewer).not.toBeVisible();
        });

        test("should send and show a gallery in an encrypted room", async ({ page, app }) => {
            await app.client.createRoom({
                name: "My Secret Pictures",
                initial_state: [
                    { type: "m.room.encryption", state_key: "", content: { algorithm: "m.megolm.v1.aes-sha2" } },
                ],
            });
            await app.viewRoomByName("My Secret Pictures");
            await expect(page.getByText("Encryption enabled")).toBeVisible();

            await sendGallery(page, app, "For your eyes only");

            // After a reload the items are no longer held in memory, so they are downloaded and decrypted.
            await page.reload();
            await app.viewRoomByName("My Secret Pictures");
            const gallery = page.getByRole("group", { name: "Gallery with 3 items" });
            await expect(gallery.locator("img")).toHaveCount(3);
            await expect(
                page.locator(".mx_EventTile").filter({ has: gallery }).getByText("For your eyes only"),
            ).toBeVisible();

            await gallery.getByRole("button", { name: "Image 2 of 3" }).click();
            const viewer = page.getByRole("dialog", { name: "Image view" });
            await expect(viewer.getByRole("img", { name: "element.png" })).toBeVisible();
            await viewer.getByRole("button", { name: "Next" }).click();
            await expect(viewer.locator("video")).toBeVisible();
        });

        test("should edit the items and the caption of a gallery in the message editor", async ({ page, app }) => {
            const gallery = await sendGallery(page, app, "Before");
            const tile = page.locator(".mx_EventTile").filter({ has: page.getByRole("list") });

            const sent = page.locator(".mx_EventTile").filter({ has: gallery });
            await sent.hover();
            await sent.getByRole("button", { name: "Edit", exact: true }).click();

            // The message is edited in place: its text in the editor, its items beside it.
            const editor = page.getByRole("textbox", { name: "Edit message" });
            await expect(editor).toHaveText("Before");
            await expect(tile.getByRole("listitem")).toHaveCount(4); // three items and the add tile

            await tile.getByRole("button", { name: "Remove 5secvid.webm" }).click();
            await tile.getByRole("button", { name: "Remove riot.png" }).click();
            await tile.getByTestId("gallery-composer-file-input").setInputFiles(SAMPLE_IMAGES[0]);
            await expect(tile.getByRole("listitem")).toHaveCount(3);
            await editor.fill("After **all**");
            await page.getByRole("button", { name: "Save" }).click();

            const edited = page.getByRole("group", { name: "Gallery with 2 items" });
            await expect(edited).toBeVisible();
            await expect(gallery).not.toBeVisible();
            const editedTile = page.locator(".mx_EventTile").filter({ has: edited });
            await expect(editedTile.getByText("After all")).toBeVisible();
            await expect(editedTile.locator("strong").getByText("all")).toBeVisible();
            await expect(editedTile.getByText("Before")).not.toBeVisible();
            // Still one message
            await expect(page.locator(".mx_EventTile").filter({ has: page.getByRole("group") })).toHaveCount(1);
        });

        test("should change what kind of message it is as items are added and removed", async ({ page, app }) => {
            await app.setComposerInputFiles("room", SAMPLE_IMAGES[0]);
            const composer = app.getComposerField();
            await composer.pressSequentially("Just the one");
            await composer.press("Enter");

            const image = page.locator(".mx_EventTile").filter({ hasText: "Just the one" });
            await expect(image.locator(".mx_ImageBody")).toBeVisible();
            await image.hover();
            await image.getByRole("button", { name: "Edit", exact: true }).click();

            // Changing the text alone keeps it an ordinary image message
            const editor = page.getByRole("textbox", { name: "Edit message" });
            await expect(editor).toHaveText("Just the one");
            await editor.fill("Still one");
            await page.getByRole("button", { name: "Save" }).click();

            const stillImage = page.locator(".mx_EventTile").filter({ hasText: "Still one" });
            await expect(stillImage.locator(".mx_ImageBody")).toBeVisible();
            await expect(page.getByRole("group", { name: /Gallery/ })).not.toBeVisible();

            // Adding an item turns it into a gallery
            await stillImage.hover();
            await stillImage.getByRole("button", { name: "Edit", exact: true }).click();
            const editing = page.locator(".mx_EventTile").filter({ has: editor });
            await editing.getByTestId("gallery-composer-file-input").setInputFiles(SAMPLE_IMAGES[1]);
            await expect(editing.getByRole("listitem")).toHaveCount(3);
            await page.getByRole("button", { name: "Save" }).click();

            const gallery = page.getByRole("group", { name: "Gallery with 2 items" });
            const galleryTile = page.locator(".mx_EventTile").filter({ has: gallery });
            await expect(galleryTile.getByText("Still one")).toBeVisible();

            // Removing every item leaves a text message
            await galleryTile.hover();
            await galleryTile.getByRole("button", { name: "Edit", exact: true }).click();
            await editing.getByRole("button", { name: "Remove riot.png" }).click();
            await editing.getByRole("button", { name: "Remove element.png" }).click();
            await editor.fill("Only words now");
            await page.getByRole("button", { name: "Save" }).click();

            const text = page.locator(".mx_EventTile").filter({ hasText: "Only words now" });
            await expect(text).toBeVisible();
            await expect(gallery).not.toBeVisible();
            await expect(text.locator(".mx_ImageBody")).not.toBeVisible();
        });
    });

    test.describe("with the rich text editor", () => {
        test.use({ labsFlags: ["feature_gallery_messages", "feature_wysiwyg_composer"] });

        test("should send and edit a gallery", async ({ page, app }) => {
            // Wait for the editor to start up: it drops keys typed before then
            await expect(page.locator("div[contenteditable=true]")).toBeVisible();
            await app.setComposerInputFiles("room", SAMPLE_IMAGES);
            await expect(attachments(page).getByRole("listitem")).toHaveCount(3);

            const composer = page.getByRole("region", { name: "Message composer" }).getByRole("textbox");
            await composer.pressSequentially("Rich text");
            await expect(composer).toHaveText("Rich text");
            await page.getByRole("button", { name: "Send message" }).click();

            const gallery = page.getByRole("group", { name: "Gallery with 2 items" });
            const tile = page.locator(".mx_EventTile").filter({ has: gallery });
            await expect(tile.getByText("Rich text")).toBeVisible();
            await expect(attachments(page)).not.toBeVisible();

            // Editing uses the rich text editor too, with the items beside it
            await tile.hover();
            await tile.getByRole("button", { name: "Edit", exact: true }).click();
            const editing = page.locator(".mx_EventTile").filter({ has: page.locator(".mx_EditWysiwygComposer") });
            await expect(editing.getByRole("textbox")).toHaveText("Rich text");
            await expect(editing.getByRole("listitem")).toHaveCount(3);

            await editing.getByRole("button", { name: "Remove riot.png" }).click();
            await expect(editing.locator("div[contenteditable=true]")).toBeVisible();
            await editing.getByRole("textbox").pressSequentially(" edited");
            await expect(editing.getByRole("textbox")).toHaveText("Rich text edited");
            await editing.getByRole("button", { name: "Save" }).click();

            // One item is left, so it is an ordinary image message now
            const edited = page.locator(".mx_EventTile").filter({ hasText: "Rich text edited" });
            await expect(edited.locator(".mx_ImageBody")).toBeVisible();
            await expect(gallery).not.toBeVisible();
        });
    });

    test("should show a gallery sent by another client without the labs flag", async ({ page, app }) => {
        const itemtypes = [];
        for (const path of SAMPLE_IMAGES) {
            const upload = await app.client.uploadContent(await readFile(path), { type: "image/png" });
            itemtypes.push({
                itemtype: "m.image",
                body: path.split("/").pop(),
                url: upload.content_uri,
                info: { mimetype: "image/png" },
            });
        }
        await app.client.sendMessage(roomId, { msgtype: "dm.filament.gallery", body: "From Element X", itemtypes });

        const gallery = page.getByRole("group", { name: "Gallery with 2 items" });
        await expect(gallery.getByRole("button")).toHaveCount(2);
        await expect(page.locator(".mx_EventTile").filter({ has: gallery }).getByText("From Element X")).toBeVisible();

        // Sending is opt-in: without the labs flag, files are still confirmed one by one.
        await app.setComposerInputFiles("room", SAMPLE_IMAGES);
        await expect(page.getByRole("dialog", { name: "Upload files (1 of 2)" })).toBeVisible();
    });
});

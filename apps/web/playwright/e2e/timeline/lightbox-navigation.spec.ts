/*
Copyright 2026

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type EventType, type MsgType } from "matrix-js-sdk/src/types";

import { test, expect } from "../../element-web-test";
import { readSampleFileSync } from "../../sample-files";

const IMAGE_FILE = readSampleFileSync("element.png", null);
const IMAGE_NAMES = ["first.png", "second.png", "third.png"];

test.describe("Lightbox navigation", () => {
    test.use({
        displayName: "Alan",
        room: async ({ app, user }, use) => {
            const roomId = await app.client.createRoom({ name: "Gallery" });
            const upload = await app.client.uploadContent(IMAGE_FILE, { name: "image.png", type: "image/png" });
            for (const name of IMAGE_NAMES) {
                await app.client.sendEvent(roomId, null, "m.room.message" as EventType, {
                    msgtype: "m.image" as MsgType,
                    body: name,
                    url: upload.content_uri,
                });
                await app.client.sendMessage(roomId, `Some text after ${name}`);
            }
            await use({ roomId });
        },
    });

    test("navigates between the images of the room", async ({ page, app, room }) => {
        await app.viewRoomById(room.roomId);
        await app.timeline.scrollToBottom();
        await page.locator(".mx_ImageBody").getByRole("img", { name: "second.png" }).click();

        const lightbox = page.getByRole("dialog", { name: "Image view" });
        const previous = lightbox.getByRole("button", { name: "Previous" });
        const next = lightbox.getByRole("button", { name: "Next" });
        await expect(lightbox.getByRole("img", { name: "second.png" })).toBeVisible();
        await expect(previous).toBeVisible();

        // Button to the newest image, after which there is nothing newer
        await next.click();
        await expect(lightbox.getByRole("img", { name: "third.png" })).toBeVisible();
        await expect(next).not.toBeVisible();

        // Arrow keys back to the oldest image
        await page.keyboard.press("ArrowLeft");
        await expect(lightbox.getByRole("img", { name: "second.png" })).toBeVisible();
        await page.keyboard.press("ArrowLeft");
        await expect(lightbox.getByRole("img", { name: "first.png" })).toBeVisible();
        await expect(next).toBeVisible();

        // Going further back paginates the (short) room history and finds no more images
        await page.keyboard.press("ArrowLeft");
        await expect(previous).not.toBeVisible();
        await expect(lightbox.getByRole("img", { name: "first.png" })).toBeVisible();

        // Focus is on a toolbar button whose tooltip is open: the first Escape dismisses the tooltip,
        // the second closes the lightbox (as for any other lightbox button).
        await page.keyboard.press("Escape");
        await page.keyboard.press("Escape");
        await expect(lightbox).not.toBeVisible();
    });
});

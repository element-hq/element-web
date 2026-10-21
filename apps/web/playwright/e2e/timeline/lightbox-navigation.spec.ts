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
const SVG_FILE = Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="48"><rect width="64" height="48" fill="#0dbd8b"/></svg>',
);

test.describe("Lightbox navigation", () => {
    test.use({
        displayName: "Alan",
        botCreateOpts: { displayName: "Bob", autoAcceptInvites: true },
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

    test("renders an SVG reached by navigating", async ({ page, app, room }) => {
        const upload = await app.client.uploadContent(SVG_FILE, { name: "drawing.svg", type: "image/svg+xml" });
        await app.client.sendEvent(room.roomId, null, "m.room.message" as EventType, {
            msgtype: "m.image" as MsgType,
            body: "drawing.svg",
            url: upload.content_uri,
            info: { mimetype: "image/svg+xml", w: 64, h: 48 },
        });

        await app.viewRoomById(room.roomId);
        await app.timeline.scrollToBottom();
        await page.locator(".mx_ImageBody").getByRole("img", { name: "third.png" }).click();

        const lightbox = page.getByRole("dialog", { name: "Image view" });
        await expect(lightbox.getByRole("img", { name: "third.png" })).toBeVisible();

        await page.keyboard.press("ArrowRight");
        const svg = lightbox.getByRole("img", { name: "drawing.svg" });
        await expect(svg).toBeVisible();
        // The image must actually decode: a blob URL with the wrong mimetype would show a broken image
        await expect.poll(() => svg.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(64);
        await expect(svg).toHaveAttribute("src", /^http/);
        await expect(lightbox.getByRole("button", { name: "Next" })).not.toBeVisible();
    });

    test("navigates between the images of a thread", async ({ page, app, room, bot }) => {
        // Another user starts the thread, as a client only adds its own thread replies to a thread it already knows
        await app.client.inviteUser(room.roomId, bot.credentials!.userId);
        await bot.joinRoom(room.roomId);
        const { event_id: rootId } = await bot.sendMessage(room.roomId, "Thread about pictures");
        const upload = await bot.uploadContent(IMAGE_FILE, { name: "image.png", type: "image/png" });
        for (const name of ["reply-one.png", "reply-two.png"]) {
            await bot.sendEvent(room.roomId, rootId, "m.room.message" as EventType, {
                msgtype: "m.image" as MsgType,
                body: name,
                url: upload.content_uri,
            });
        }

        await app.viewRoomById(room.roomId);
        await app.timeline.scrollToBottom();
        await page.locator(".mx_RoomView_body").getByTestId("thread-summary").click();

        const threadView = page.locator(".mx_ThreadView");
        await threadView.locator(".mx_ImageBody").getByRole("img", { name: "reply-one.png" }).click();

        const lightbox = page.getByRole("dialog", { name: "Image view" });
        const previous = lightbox.getByRole("button", { name: "Previous" });
        const next = lightbox.getByRole("button", { name: "Next" });
        await expect(lightbox.getByRole("img", { name: "reply-one.png" })).toBeVisible();

        // Navigation stays within the thread: the room's images are not part of the collection
        await next.click();
        await expect(lightbox.getByRole("img", { name: "reply-two.png" })).toBeVisible();
        await expect(next).not.toBeVisible();

        await page.keyboard.press("ArrowLeft");
        await expect(lightbox.getByRole("img", { name: "reply-one.png" })).toBeVisible();
        await page.keyboard.press("ArrowLeft");
        await expect(lightbox.getByRole("img", { name: "reply-one.png" })).toBeVisible();
        await expect(previous).not.toBeVisible();
    });
});

/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { rejectToastIfExists } from "@element-hq/element-web-playwright-common";
import { type Locator } from "@playwright/test";

import { test, expect } from "../../element-web-test";

const ROOM_NAME = "Multi-screenshot composer test";
const SHARED_CONTEXT = "These screenshots share one composer message";
const ASSET_DIR = "playwright/e2e/media/fixtures";
const MEDIA_BATCH_CONTENT_KEY = "io.element.media_batch";

type ImageFile = {
    path: string;
    type: string;
};

async function pasteImageFiles(composer: Locator, files: ImageFile[]): Promise<void> {
    const payload = await Promise.all(
        files.map(async (file) => ({
            name: basename(file.path),
            type: file.type,
            base64: (await readFile(file.path)).toString("base64"),
        })),
    );

    await composer.evaluate(async (element, payload) => {
        const clipboardData = new DataTransfer();
        for (const file of payload) {
            clipboardData.items.add(
                new File([Uint8Array.fromBase64(file.base64)], file.name, {
                    type: file.type,
                }),
            );
        }
        element.dispatchEvent(
            new ClipboardEvent("paste", {
                clipboardData,
                bubbles: true,
                cancelable: true,
            }),
        );
    }, payload);
}

test.describe("multi-screenshot composer", () => {
    test.use({
        displayName: "Multi-screenshot Composer Test",
        room: async ({ app, user: _user }, use) => {
            const roomId = await app.client.createRoom({ name: ROOM_NAME });
            await app.viewRoomByName(ROOM_NAME);
            await use({ roomId });
        },
    });

    test.beforeEach(async ({ app, room }) => {
        await rejectToastIfExists(app.page, "Notifications");
        await rejectToastIfExists(app.page, "Verify this device");
        await app.viewRoomByName(ROOM_NAME);
        await app.client.sendMessage(room!.roomId, "multi-screenshot composer room ready");
    });

    test("uses main composer text as shared context for pasted screenshots", async ({ page, app, room }) => {
        const composer = page.getByRole("textbox", { name: "Send an unencrypted message…" });
        const tray = page.getByTestId("pending-attachment-tray");

        await pasteImageFiles(composer, [
            { path: `${ASSET_DIR}/screenshot-flow-step-1.png`, type: "image/png" },
            { path: `${ASSET_DIR}/screenshot-flow-step-2.png`, type: "image/png" },
        ]);

        await expect(tray).toBeVisible();
        await expect(tray.getByRole("img")).toHaveCount(2);
        await expect(tray.locator("textarea, input")).toHaveCount(0);
        await expect(page.locator(".mx_PendingAttachmentTray_caption")).toHaveCount(0);
        await expect(page.locator(".mx_Dialog")).toHaveCount(0);

        const firstTrayItem = tray.locator(".mx_PendingAttachmentTray_item").first();
        const firstRemoveButton = firstTrayItem.getByRole("button", { name: "Remove screenshot-flow-step-1.png" });
        await expect(firstRemoveButton).toHaveCSS("opacity", "0");
        await expect(firstRemoveButton).toHaveCSS("pointer-events", "none");

        await firstTrayItem.hover();
        await expect(firstRemoveButton).toHaveCSS("opacity", "1");
        await expect(firstRemoveButton).toHaveCSS("pointer-events", "auto");

        await page.mouse.move(0, 0);
        await firstRemoveButton.focus();
        await expect(firstRemoveButton).toBeFocused();
        await expect(firstRemoveButton).toHaveCSS("opacity", "1");

        await composer.focus();
        await page.mouse.move(0, 0);
        await expect(firstRemoveButton).toHaveCSS("opacity", "0");

        const trayBox = await tray.boundingBox();
        expect(trayBox?.height).toBeLessThanOrEqual(180);
        for (const image of await tray.locator(".mx_PendingAttachmentTray_thumbnailImage").all()) {
            const imageBox = await image.boundingBox();
            expect(imageBox?.width).toBeLessThanOrEqual(160);
            expect(imageBox?.height).toBeLessThanOrEqual(120);
        }

        await composer.pressSequentially(SHARED_CONTEXT);
        await expect(composer).toContainText(SHARED_CONTEXT);
        await expect(page.locator(".mx_EventTile_body", { hasText: SHARED_CONTEXT })).toHaveCount(0);

        await composer.press("Enter");

        await expect(tray).toHaveCount(0);
        await expect(page.getByTestId("media-batch-body").first()).toBeVisible({ timeout: 30000 });
        await expect(page.getByTestId("media-batch-body")).toHaveCount(1);
        await expect(page.getByTestId("media-batch-body").locator(".mx_MediaBatchBody_item")).toHaveCount(2);
        await expect(page.locator(".mx_EventTile_body", { hasText: SHARED_CONTEXT }).first()).toBeVisible({
            timeout: 30000,
        });

        await expect
            .poll(
                async () =>
                    app.client.evaluate(
                        (client, { roomId }) => {
                            const room = client.getRoom(roomId);
                            return (
                                room
                                    ?.getLiveTimeline()
                                    .getEvents()
                                    .filter(
                                        (event) =>
                                            event.getType() === "m.room.message" &&
                                            event.getContent().msgtype === "m.image",
                                    ).length ?? 0
                            );
                        },
                        { roomId: room!.roomId },
                    ),
                { timeout: 30000 },
            )
            .toBe(2);

        const finalEvents = await app.client.evaluate(
            (client, { roomId }) => {
                const room = client.getRoom(roomId);
                return (
                    room
                        ?.getLiveTimeline()
                        .getEvents()
                        .filter((event) => event.getType() === "m.room.message")
                        .map((event) => event.getContent()) ?? []
                );
            },
            { roomId: room!.roomId },
        );
        const imageEvents = finalEvents.filter((content: any) => content.msgtype === "m.image");
        const duplicateTextEvents = finalEvents.filter(
            (content: any) => content.msgtype === "m.text" && content.body === SHARED_CONTEXT,
        );

        expect(imageEvents).toHaveLength(2);
        expect(duplicateTextEvents).toHaveLength(0);
        expect(imageEvents[0]).toMatchObject({
            msgtype: "m.image",
            body: SHARED_CONTEXT,
            filename: "screenshot-flow-step-1.png",
            [MEDIA_BATCH_CONTENT_KEY]: {
                index: 0,
                count: 2,
            },
        });
        expect(imageEvents[1]).toMatchObject({
            msgtype: "m.image",
            body: "screenshot-flow-step-2.png",
            [MEDIA_BATCH_CONTENT_KEY]: {
                index: 1,
                count: 2,
            },
        });
        expect(imageEvents[0][MEDIA_BATCH_CONTENT_KEY].id).toBe(imageEvents[1][MEDIA_BATCH_CONTENT_KEY].id);
    });
});

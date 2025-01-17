/*
 * Copyright 2024 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { test, expect } from "../../element-web-test";

test.describe("Share dialog", () => {
    test.use({
        displayName: "Alice",
        room: async ({ app, user, bot }, use) => {
            const roomId = await app.client.createRoom({ name: "Alice room" });
            await use({ roomId });
        },
    });

    test("should share a room", { tag: "@screenshot" }, async ({ page, app, room }) => {
        await app.viewRoomById(room.roomId);
        await app.toggleRoomInfoPanel();
        await page.getByRole("menuitem", { name: "Copy link" }).click();

        const dialog = page.getByRole("dialog", { name: "Share room" });
        await expect(dialog.getByText(`https://matrix.to/#/${room.roomId}`)).toBeVisible();
        await expect(dialog).toMatchScreenshot("share-dialog-room.png", {
            // QRCode and url changes at every run
            mask: [page.locator(".mx_QRCode"), page.locator(".mx_ShareDialog_top > span")],
        });
    });

    test("should share a room member", { tag: "@screenshot" }, async ({ page, app, room, user }) => {
        await app.viewRoomById(room.roomId);
        await app.client.sendMessage(room.roomId, { body: "hello", msgtype: "m.text" });

        const rightPanel = await app.toggleRoomInfoPanel();
        await rightPanel.getByRole("menuitem", { name: "People" }).click();
        await rightPanel.getByRole("button", { name: `${user.userId} (power 100)` }).click();
        await rightPanel.getByRole("button", { name: "Share profile" }).click();

        const dialog = page.getByRole("dialog", { name: "Share User" });
        await expect(dialog.getByText(`https://matrix.to/#/${user.userId}`)).toBeVisible();
        await expect(dialog).toMatchScreenshot("share-dialog-user.png", {
            // QRCode changes at every run
            mask: [page.locator(".mx_QRCode")],
        });
    });

    test("should share an event", { tag: "@screenshot" }, async ({ page, app, room }) => {
        await app.viewRoomById(room.roomId);
        await app.client.sendMessage(room.roomId, { body: "hello", msgtype: "m.text" });

        const timelineMessage = page.locator(".mx_MTextBody", { hasText: "hello" });
        await timelineMessage.hover();
        await page.getByRole("button", { name: "Options", exact: true }).click();
        await page.getByRole("menuitem", { name: "Share" }).click();

        const dialog = page.getByRole("dialog", { name: "Share Room Message" });
        await expect(dialog.getByRole("checkbox", { name: "Link to selected message" })).toBeChecked();
        await expect(dialog).toMatchScreenshot("share-dialog-event.png", {
            // QRCode and url changes at every run
            mask: [page.locator(".mx_QRCode"), page.locator(".mx_ShareDialog_top > span")],
        });
        await dialog.getByRole("checkbox", { name: "Link to selected message" }).click();
        await expect(dialog.getByRole("checkbox", { name: "Link to selected message" })).not.toBeChecked();
    });
});

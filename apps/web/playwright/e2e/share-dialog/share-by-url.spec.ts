/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { test, expect } from "../../element-web-test";

test.describe("share from URL", () => {
    test.use({
        displayName: "Alice",
        room: async ({ app }, use) => {
            const roomId = await app.client.createRoom({ name: "A test room" });
            await use({ roomId });
        },
    });

    test("should share message when users navigates to share URL", async ({ page, user, room, app }) => {
        await page.goto("/#/share?msg=Hello+world");
        const dialog = page.getByRole("dialog", { name: "Forward message" });
        // The forward message dialog doesn't update as new infomation arrives via sync, which means sometimes
        // this is just says, "Empty room". For the same reason, we can't reliably write a test for loading the
        // app straight away with a /#/share url as the room doesn't appear until the client syncs.]
        // Ideally we should fix the forward dialog to update and eliminate races, until then, there is only one
        // room so we click the first button.
        await dialog.getByRole("listitem" /*, { name: "A test room" }*/).getByRole("button", { name: "Send" }).click();
        await dialog.getByRole("button", { name: "Close" }).click();
        await app.viewRoomByName("A test room");
        const lastMessage = page.locator(".mx_RoomView_MessageList .mx_EventTile_last");
        await expect(lastMessage).toBeVisible();
        const lastMessageText = await lastMessage.locator(".mx_EventTile_body").innerText();
        await expect(lastMessageText).toBe("Hello world");
    });
});

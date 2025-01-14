/*
Copyright 2024 New Vector Ltd.
Copyright 2024 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { test, expect } from "../../element-web-test";
import { isDendrite } from "../../plugins/homeserver/dendrite";

const TEST_ROOM_NAME = "The mark unread test room";

test.describe("Mark as Unread", () => {
    test.skip(isDendrite, "due to Dendrite bug https://github.com/element-hq/dendrite/issues/2970");

    test.use({
        displayName: "Tom",
        botCreateOpts: {
            displayName: "BotBob",
            autoAcceptInvites: true,
        },
    });

    test("should mark a room as unread", async ({ page, app, bot }) => {
        const roomId = await app.client.createRoom({
            name: TEST_ROOM_NAME,
        });
        const dummyRoomId = await app.client.createRoom({
            name: "Room of no consequence",
        });
        await app.client.inviteUser(roomId, bot.credentials.userId);
        await bot.joinRoom(roomId);
        await bot.sendMessage(roomId, "I am a robot. Beep.");

        // Regular notification on new message
        await expect(page.getByLabel(TEST_ROOM_NAME + " 1 unread message.")).toBeVisible();
        await expect(page).toHaveTitle("Element [1]");

        await page.goto("/#/room/" + roomId);

        // should now be read, since we viewed the room (we have to assert the page title:
        // the room badge isn't visible since we're viewing the room)
        await expect(page).toHaveTitle("Element | " + TEST_ROOM_NAME);

        // navigate away from the room again
        await page.goto("/#/room/" + dummyRoomId);

        const roomTile = page.getByLabel(TEST_ROOM_NAME);
        await roomTile.focus();
        await roomTile.getByRole("button", { name: "Room options" }).click();
        await page.getByRole("menuitem", { name: "Mark as unread" }).click();

        await expect(page.getByLabel(TEST_ROOM_NAME + " Unread messages.")).toBeVisible();
    });
});

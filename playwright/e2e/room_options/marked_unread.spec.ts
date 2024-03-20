/*
Copyright 2024 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import { test, expect } from "../../element-web-test";

const TEST_ROOM_NAME = "The mark unread test room";

test.describe("Mark as Unread", () => {
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

        expect(page.getByLabel(TEST_ROOM_NAME + " Unread messages.")).toBeVisible();
    });
});

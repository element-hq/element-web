/*
Copyright 2023 The Matrix.org Foundation C.I.C.

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

/* See readme.md for tips on writing these tests. */

import { test } from ".";

test.describe("Read receipts", () => {
    test.describe("Room list order", () => {
        test("Rooms with unread messages appear at the top of room list if 'unread first' is selected", async ({
            roomAlpha: room1,
            roomBeta: room2,
            util,
            msg,
            page,
        }) => {
            await util.goTo(room2);

            // Display the unread first room
            await util.toggleRoomUnreadOrder();
            await util.receiveMessages(room1, ["Msg1"]);
            await page.reload();

            // Room 1 has an unread message and should be displayed first
            await util.assertRoomListOrder([room1, room2]);
        });

        test("Rooms with unread threads appear at the top of room list if 'unread first' is selected", async ({
            roomAlpha: room1,
            roomBeta: room2,
            util,
            msg,
        }) => {
            await util.goTo(room2);
            await util.receiveMessages(room1, ["Msg1"]);
            await util.markAsRead(room1);
            await util.assertRead(room1);

            // Display the unread first room
            await util.toggleRoomUnreadOrder();
            await util.receiveMessages(room1, [msg.threadedOff("Msg1", "Resp1")]);
            await util.saveAndReload();

            // Room 1 has an unread message and should be displayed first
            await util.assertRoomListOrder([room1, room2]);
        });
    });
});

/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

/* See readme.md for tips on writing these tests. */

import { test } from ".";

test.describe("Read receipts", { tag: "@mergequeue" }, () => {
    test.describe("Room list order", () => {
        test("Rooms with unread messages appear at the top of room list with default 'activity' ordering", async ({
            roomAlpha: room1,
            roomBeta: room2,
            util,
            msg,
            page,
        }) => {
            await util.goTo(room2);

            // Display the unread first room
            await util.receiveMessages(room1, ["Msg1"]);
            await page.reload();

            // switch rooms so they can re-order in the list
            await util.goTo(room1);

            // Room 1 has an unread message and should be displayed first
            // (as the default is to sort by activity)
            await util.assertRoomListOrder([room1, room2]);
        });

        test("Rooms with unread threads appear at the top of room list with default 'activity' order", async ({
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
            await util.receiveMessages(room1, [msg.threadedOff("Msg1", "Resp1")]);
            await util.saveAndReload();

            // Room 1 has an unread message and should be displayed first
            await util.assertRoomListOrder([room1, room2]);
        });
    });
});

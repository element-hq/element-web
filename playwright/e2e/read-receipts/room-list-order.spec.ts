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
            app,
            bot,
        }) => {
            // Create a third room to navigate to
            const room3Id = await app.client.createRoom({ name: "Room Gamma", invite: [bot.credentials.userId] });
            await bot.awaitRoomMembership(room3Id);
            const room3 = { name: "Room Gamma", roomId: room3Id };

            await util.goTo(room2);

            // Display the unread first room
            await util.receiveMessages(room2, ["Msg2"]);
            await util.receiveMessages(room1, ["Msg1"]);
            await page.reload();

            // Switch to room3 so neither room1 nor room2 is selected/sticky
            // This allows them to reorder based on activity
            await util.goTo(room3);

            // Room 1 has an unread message and should be displayed first
            // (as the default is to sort by activity)
            await util.assertRoomListOrder([room1, room2, room3]);
        });

        test("Rooms with unread threads appear at the top of room list with default 'activity' order", async ({
            roomAlpha: room1,
            roomBeta: room2,
            util,
            msg,
            app,
            bot,
        }) => {
            // Create a third room to navigate to
            const room3Id = await app.client.createRoom({ name: "Room Gamma", invite: [bot.credentials.userId] });
            await bot.awaitRoomMembership(room3Id);
            const room3 = { name: "Room Gamma", roomId: room3Id };

            await util.goTo(room2);
            await util.receiveMessages(room1, ["Msg1"]);
            await util.receiveMessages(room2, ["Msg2"]);
            await util.markAsRead(room1);
            await util.assertRead(room1);

            // Display the unread first room (room1 moves above room2 as it has an unread thread)
            await util.receiveMessages(room1, [msg.threadedOff("Msg1", "Resp1")]);
            await util.saveAndReload();

            // Switch to room3 so neither room1 nor room2 is selected/sticky
            await util.goTo(room3);

            // Room 1 has an unread message and should be displayed first
            await util.assertRoomListOrder([room1, room2, room3]);
        });
    });
});

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

import { many, test } from ".";

test.describe("Read receipts", () => {
    test.describe("new messages", () => {
        test.describe("in the main timeline", () => {
            test("Receiving a message makes a room unread", async ({
                roomAlpha: room1,
                roomBeta: room2,
                util,
                msg,
            }) => {
                // Given I am in a different room
                await util.goTo(room1);
                await util.assertRead(room2);

                // When I receive some messages
                await util.receiveMessages(room2, ["Msg1"]);

                // Then the room is marked as unread
                await util.assertUnread(room2, 1);
            });
            test("Reading latest message makes the room read", async ({
                roomAlpha: room1,
                roomBeta: room2,
                util,
                msg,
            }) => {
                // Given I have some unread messages
                await util.goTo(room1);
                await util.assertRead(room2);
                await util.receiveMessages(room2, ["Msg1"]);
                await util.assertUnread(room2, 1);

                // When I read the main timeline
                await util.goTo(room2);

                // Then the room becomes read
                await util.assertRead(room2);
            });
            test("Reading an older message leaves the room unread", async ({
                roomAlpha: room1,
                roomBeta: room2,
                util,
                msg,
            }) => {
                // Given there are lots of messages in a room
                await util.goTo(room1);
                await util.receiveMessages(room2, many("Msg", 30));
                await util.assertUnread(room2, 30);

                // When I jump to one of the older messages
                await msg.jumpTo(room2.name, "Msg0001");

                // Then the room is still unread, but some messages were read
                await util.assertUnreadLessThan(room2, 30);
            });
            test("Marking a room as read makes it read", async ({ roomAlpha: room1, roomBeta: room2, util, msg }) => {
                // Given I have some unread messages
                await util.goTo(room1);
                await util.assertRead(room2);
                await util.receiveMessages(room2, ["Msg1"]);
                await util.assertUnread(room2, 1);

                // When I mark the room as read
                await util.markAsRead(room2);

                // Then it is read
                await util.assertRead(room2);
            });
            test("Receiving a new message after marking as read makes it unread", async ({
                roomAlpha: room1,
                roomBeta: room2,
                util,
                msg,
            }) => {
                // Given I have marked my messages as read
                await util.goTo(room1);
                await util.assertRead(room2);
                await util.receiveMessages(room2, ["Msg1"]);
                await util.assertUnread(room2, 1);
                await util.markAsRead(room2);
                await util.assertRead(room2);

                // When I receive a new message
                await util.receiveMessages(room2, ["Msg2"]);

                // Then the room is unread
                await util.assertUnread(room2, 1);
            });
            test("A room with a new message is still unread after restart", async ({
                roomAlpha: room1,
                roomBeta: room2,
                util,
                msg,
            }) => {
                // Given I have an unread message
                await util.goTo(room1);
                await util.assertRead(room2);
                await util.receiveMessages(room2, ["Msg1"]);
                await util.assertUnread(room2, 1);

                // When I restart
                await util.saveAndReload();

                // Then I still have an unread message
                await util.assertUnread(room2, 1);
            });
            test("A room where all messages are read is still read after restart", async ({
                roomAlpha: room1,
                roomBeta: room2,
                util,
                msg,
            }) => {
                // Given I have read all messages
                await util.goTo(room1);
                await util.assertRead(room2);
                await util.receiveMessages(room2, ["Msg1"]);
                await util.assertUnread(room2, 1);
                await util.goTo(room2);
                await util.assertRead(room2);

                // When I restart
                await util.saveAndReload();

                // Then all messages are still read
                await util.assertRead(room2);
            });
            test("A room that was marked as read is still read after restart", async ({
                roomAlpha: room1,
                roomBeta: room2,
                util,
                msg,
            }) => {
                // Given I have marked all messages as read
                await util.goTo(room1);
                await util.assertRead(room2);
                await util.receiveMessages(room2, ["Msg1"]);
                await util.assertUnread(room2, 1);
                await util.markAsRead(room2);
                await util.assertRead(room2);

                // When I restart
                await util.saveAndReload();

                // Then all messages are still read
                await util.assertRead(room2);
            });
        });
    });
});

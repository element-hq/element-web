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
    test.describe("editing messages", () => {
        test.describe("thread roots", () => {
            test("An edit of a thread root leaves the room read", async ({
                roomAlpha: room1,
                roomBeta: room2,
                util,
                msg,
            }) => {
                // Given I have read a thread
                await util.goTo(room1);
                await util.receiveMessages(room2, ["Msg1", msg.threadedOff("Msg1", "Resp1")]);
                await util.assertUnread(room2, 1);
                await util.goTo(room2);
                await util.openThread("Msg1");
                await util.backToThreadsList();
                await util.assertRead(room2);
                await util.goTo(room1);

                // When the thread root is edited
                await util.receiveMessages(room2, [msg.editOf("Msg1", "Edit1")]);

                // Then the room is read
                await util.assertStillRead(room2);

                // And the thread is read
                await util.goTo(room2);
                await util.assertStillRead(room2);
                await util.assertReadThread("Edit1");
            });

            test("Reading an edit of a thread root leaves the room read", async ({
                roomAlpha: room1,
                roomBeta: room2,
                util,
                msg,
            }) => {
                // Given a fully-read thread exists
                await util.goTo(room2);
                await util.receiveMessages(room2, ["Msg1", msg.threadedOff("Msg1", "Resp1")]);
                await util.openThread("Msg1");
                await util.assertRead(room2);
                await util.goTo(room1);
                await util.assertRead(room2);

                // When the thread root is edited
                await util.receiveMessages(room2, [msg.editOf("Msg1", "Msg1 Edit1")]);

                // And I read that edit
                await util.goTo(room2);

                // Then the room becomes read and stays read
                await util.assertStillRead(room2);
                await util.goTo(room1);
                await util.assertStillRead(room2);
            });

            test("Editing a thread root after reading leaves the room read", async ({
                roomAlpha: room1,
                roomBeta: room2,
                util,
                msg,
            }) => {
                // Given a fully-read thread exists
                await util.goTo(room2);
                await util.receiveMessages(room2, ["Msg1", msg.threadedOff("Msg1", "Resp1")]);
                await util.openThread("Msg1");
                await util.assertRead(room2);
                await util.goTo(room1);

                // When the thread root is edited
                await util.receiveMessages(room2, [msg.editOf("Msg1", "Msg1 Edit1")]);

                // Then the room stays read
                await util.assertStillRead(room2);
            });

            test("Marking a room as read after an edit of a thread root keeps it read", async ({
                roomAlpha: room1,
                roomBeta: room2,
                util,
                msg,
            }) => {
                // Given a fully-read thread exists
                await util.goTo(room2);
                await util.receiveMessages(room2, ["Msg1", msg.threadedOff("Msg1", "Resp1")]);
                await util.openThread("Msg1");
                await util.assertRead(room2);
                await util.goTo(room1);
                await util.assertRead(room2);

                // When the thread root is edited (and I receive another message
                // to allow Mark as read)
                await util.receiveMessages(room2, [msg.editOf("Msg1", "Msg1 Edit1"), "Msg2"]);

                // And when I mark the room as read
                await util.markAsRead(room2);

                // Then the room becomes read and stays read
                await util.assertStillRead(room2);
                await util.goTo(room1);
                await util.assertStillRead(room2);
            });

            test("Editing a thread root that is a reply after marking as read leaves the room read", async ({
                roomAlpha: room1,
                roomBeta: room2,
                util,
                msg,
            }) => {
                // Given a thread based on a reply exists and is read because it is marked as read
                await util.goTo(room1);
                await util.receiveMessages(room2, [
                    "Msg",
                    msg.replyTo("Msg", "Reply"),
                    msg.threadedOff("Reply", "InThread"),
                ]);
                await util.assertUnread(room2, 2);
                await util.markAsRead(room2);
                await util.assertRead(room2);

                // When I edit the thread root
                await util.receiveMessages(room2, [msg.editOf("Reply", "Edited Reply")]);

                // Then the room is read
                await util.assertStillRead(room2);

                // And the thread is read
                await util.goTo(room2);
                await util.assertReadThread("Edited Reply");
            });

            test("Marking a room as read after an edit of a thread root that is a reply leaves it read", async ({
                roomAlpha: room1,
                roomBeta: room2,
                util,
                msg,
            }) => {
                // Given a thread based on a reply exists and the reply has been edited
                await util.goTo(room1);
                await util.receiveMessages(room2, [
                    "Msg",
                    msg.replyTo("Msg", "Reply"),
                    msg.threadedOff("Reply", "InThread"),
                ]);
                await util.receiveMessages(room2, [msg.editOf("Reply", "Edited Reply")]);
                await util.assertUnread(room2, 2);

                // When I mark the room as read
                await util.markAsRead(room2);

                // Then the room and thread are read
                await util.assertStillRead(room2);
                await util.goTo(room2);
                await util.assertReadThread("Edited Reply");
            });
        });
    });
});

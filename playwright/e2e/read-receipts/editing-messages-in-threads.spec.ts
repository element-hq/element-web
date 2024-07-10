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
        test.describe("in threads", () => {
            test("An edit of a threaded message makes the room unread", async ({
                roomAlpha: room1,
                roomBeta: room2,
                util,
                msg,
            }) => {
                // Given we have read the thread
                await util.goTo(room1);
                await util.receiveMessages(room2, ["Msg1", msg.threadedOff("Msg1", "Resp1")]);
                await util.assertUnread(room2, 1);
                await util.goTo(room2);
                await util.openThread("Msg1");
                await util.assertRead(room2);
                await util.assertReadThread("Resp1");
                await util.goTo(room1);

                // When a message inside it is edited
                await util.receiveMessages(room2, [msg.editOf("Resp1", "Edit1")]);

                // Then the room and thread are read
                await util.assertStillRead(room2);
                await util.goTo(room2);
                await util.assertReadThread("Msg1");
            });

            test("Reading an edit of a threaded message makes the room read", async ({
                roomAlpha: room1,
                roomBeta: room2,
                util,
                msg,
            }) => {
                // Given an edited thread message appears after we read it
                await util.goTo(room1);
                await util.receiveMessages(room2, ["Msg1", msg.threadedOff("Msg1", "Resp1")]);
                await util.assertUnread(room2, 1);
                await util.goTo(room2);
                await util.openThread("Msg1");
                await util.assertRead(room2);
                await util.assertReadThread("Resp1");
                await util.goTo(room1);
                await util.receiveMessages(room2, [msg.editOf("Resp1", "Edit1")]);
                await util.assertStillRead(room2);

                // When I read it
                await util.goTo(room2);
                await util.openThread("Msg1");

                // Then the room and thread are still read
                await util.assertStillRead(room2);
                await util.assertReadThread("Msg1");
            });

            test("Marking a room as read after an edit in a thread makes it read", async ({
                roomAlpha: room1,
                roomBeta: room2,
                util,
                msg,
            }) => {
                // Given an edit in a thread is making the room unread
                await util.goTo(room1);
                await util.receiveMessages(room2, [
                    "Msg1",
                    msg.threadedOff("Msg1", "Resp1"),
                    msg.editOf("Resp1", "Edit1"),
                ]);
                await util.assertUnread(room2, 1);

                // When I mark the room as read
                await util.markAsRead(room2);

                // Then it is read
                await util.assertRead(room2);
                await util.assertReadThread("Msg1");
            });

            test("Editing a thread message after marking as read leaves the room read", async ({
                roomAlpha: room1,
                roomBeta: room2,
                util,
                msg,
            }) => {
                // Given a room is marked as read
                await util.goTo(room1);
                await util.receiveMessages(room2, ["Msg1", msg.threadedOff("Msg1", "Resp1")]);
                await util.assertUnread(room2, 1);
                await util.markAsRead(room2);
                await util.assertRead(room2);

                // When a message is edited
                await util.receiveMessages(room2, [msg.editOf("Resp1", "Edit1")]);

                // Then the room remains read
                await util.assertStillRead(room2);
                await util.assertReadThread("Msg1");
            });

            test("A room with an edited threaded message is still read after restart", async ({
                roomAlpha: room1,
                roomBeta: room2,
                util,
                msg,
            }) => {
                // Given an edit in a thread is leaving a room read
                await util.goTo(room1);
                await util.receiveMessages(room2, ["Msg1", msg.threadedOff("Msg1", "Resp1")]);
                await util.markAsRead(room2);
                await util.receiveMessages(room2, [msg.editOf("Resp1", "Edit1")]);
                await util.assertStillRead(room2);

                // When I restart
                await util.saveAndReload();

                // Then is it still read
                await util.assertRead(room2);
            });

            test("A room where all threaded edits are read is still read after restart", async ({
                roomAlpha: room1,
                roomBeta: room2,
                util,
                msg,
            }) => {
                await util.goTo(room1);
                await util.receiveMessages(room2, ["Msg1", msg.threadedOff("Msg1", "Resp1")]);
                await util.assertUnread(room2, 1);
                await util.receiveMessages(room2, [msg.editOf("Resp1", "Edit1")]);
                await util.assertUnread(room2, 1);

                await util.goTo(room2);

                await util.openThread("Msg1");
                await util.assertRead(room2);
                await util.assertReadThread("Msg1");
                await util.goTo(room1); // Make sure we are looking at room1 after reload
                await util.assertStillRead(room2);

                await util.saveAndReload();
                await util.assertRead(room2);
                await util.assertReadThread("Msg1");
            });

            test("A room where all threaded edits are marked as read is still read after restart", async ({
                roomAlpha: room1,
                roomBeta: room2,
                util,
                msg,
            }) => {
                await util.goTo(room1);
                await util.receiveMessages(room2, [
                    "Msg1",
                    msg.threadedOff("Msg1", "Resp1"),
                    msg.editOf("Resp1", "Edit1"),
                ]);
                await util.assertUnread(room2, 1);
                await util.markAsRead(room2);
                await util.assertRead(room2);
                await util.assertReadThread("Msg1");

                // When I restart
                await util.saveAndReload();

                // It is still read
                await util.assertRead(room2);
                await util.assertReadThread("Msg1");
            });
        });
    });
});

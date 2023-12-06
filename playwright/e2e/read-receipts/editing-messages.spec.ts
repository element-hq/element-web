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
        test.describe("in the main timeline", () => {
            test("Editing a message leaves a room read", async ({ roomAlpha: room1, roomBeta: room2, util, msg }) => {
                // Given I am not looking at the room
                await util.goTo(room1);

                await util.receiveMessages(room2, ["Msg1"]);
                await util.assertUnread(room2, 1);
                await util.goTo(room2);
                await util.assertRead(room2);
                await util.goTo(room1);

                // When an edit appears in the room
                await util.receiveMessages(room2, [msg.editOf("Msg1", "Msg1 Edit1")]);

                // Then it remains read
                await util.assertStillRead(room2);
            });
            test("Reading an edit leaves the room read", async ({ roomAlpha: room1, roomBeta: room2, util, msg }) => {
                // Given an edit is making the room unread
                await util.goTo(room1);
                await util.receiveMessages(room2, ["Msg1"]);
                await util.assertUnread(room2, 1);

                await util.goTo(room2);
                await util.assertRead(room2);
                await util.goTo(room1);

                await util.receiveMessages(room2, [msg.editOf("Msg1", "Msg1 Edit1")]);
                await util.assertStillRead(room2);

                // When I read it
                await util.goTo(room2);

                // Then the room stays read
                await util.assertStillRead(room2);
                await util.goTo(room1);
                await util.assertStillRead(room2);
            });
            test("Editing a message after marking as read leaves the room read", async ({
                roomAlpha: room1,
                roomBeta: room2,
                util,
                msg,
            }) => {
                // Given the room is marked as read
                await util.goTo(room1);
                await util.receiveMessages(room2, ["Msg1"]);
                await util.assertUnread(room2, 1);
                await util.markAsRead(room2);
                await util.assertRead(room2);

                // When a message is edited
                await util.receiveMessages(room2, [msg.editOf("Msg1", "Msg1 Edit1")]);

                // Then the room remains read
                await util.assertStillRead(room2);
            });
            test("Editing a reply after reading it makes the room unread", async ({
                roomAlpha: room1,
                roomBeta: room2,
                util,
                msg,
            }) => {
                // Given the room is all read
                await util.goTo(room1);
                await util.receiveMessages(room2, ["Msg1", msg.replyTo("Msg1", "Reply1")]);
                await util.assertUnread(room2, 2);
                await util.goTo(room2);
                await util.assertRead(room2);
                await util.goTo(room1);

                // When a message is edited
                await util.receiveMessages(room2, [msg.editOf("Reply1", "Reply1 Edit1")]);

                // Then it remains read
                await util.assertStillRead(room2);
            });
            test("Editing a reply after marking as read makes the room unread", async ({
                roomAlpha: room1,
                roomBeta: room2,
                util,
                msg,
            }) => {
                // Given a reply is marked as read
                await util.goTo(room1);
                await util.receiveMessages(room2, ["Msg1", msg.replyTo("Msg1", "Reply1")]);
                await util.assertUnread(room2, 2);
                await util.markAsRead(room2);
                await util.assertRead(room2);

                // When the reply is edited
                await util.receiveMessages(room2, [msg.editOf("Reply1", "Reply1 Edit1")]);

                // Then the room remains read
                await util.assertStillRead(room2);
            });
            test("A room with an edit is still read after restart", async ({
                roomAlpha: room1,
                roomBeta: room2,
                util,
                msg,
            }) => {
                // Given a message is marked as read
                await util.goTo(room1);
                await util.receiveMessages(room2, ["Msg1"]);
                await util.assertUnread(room2, 1);
                await util.markAsRead(room2);
                await util.assertRead(room2);

                // When an edit appears in the room
                await util.receiveMessages(room2, [msg.editOf("Msg1", "Msg1 Edit1")]);

                // Then it remains read
                await util.assertStillRead(room2);

                // And remains so after a reload
                await util.saveAndReload();
                await util.assertStillRead(room2);
            });
            test("An edited message becomes read if it happens while I am looking", async ({
                roomAlpha: room1,
                roomBeta: room2,
                util,
                msg,
            }) => {
                // Given a message is marked as read
                await util.goTo(room2);
                await util.receiveMessages(room2, ["Msg1"]);
                await util.assertRead(room2);

                // When I see an edit appear in the room I am looking at
                await util.receiveMessages(room2, [msg.editOf("Msg1", "Msg1 Edit1")]);

                // Then it becomes read
                await util.assertStillRead(room2);
            });
            test("A room where all edits are read is still read after restart", async ({
                roomAlpha: room1,
                roomBeta: room2,
                util,
                msg,
            }) => {
                // Given a message was edited and read
                await util.goTo(room1);
                await util.receiveMessages(room2, ["Msg1", msg.editOf("Msg1", "Msg1 Edit1")]);
                await util.assertUnread(room2, 1);
                await util.goTo(room2);
                await util.assertRead(room2);

                // When I reload
                await util.saveAndReload();

                // Then the room is still read
                await util.assertRead(room2);
            });
        });

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
                await util.assertUnread(room2, 2);
                await util.goTo(room2);
                await util.openThread("Msg1");
                await util.assertRead(room2);
                await util.backToThreadsList();
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
                await util.assertUnread(room2, 2);
                await util.goTo(room2);
                await util.openThread("Msg1");
                await util.assertRead(room2);
                await util.backToThreadsList();
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
                await util.assertUnread(room2, 2);

                // When I mark the room as read
                await util.markAsRead(room2);

                // Then it is read
                await util.assertRead(room2);
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
                await util.assertUnread(room2, 2);
                await util.markAsRead(room2);
                await util.assertRead(room2);

                // When a message is edited
                await util.receiveMessages(room2, [msg.editOf("Resp1", "Edit1")]);

                // Then the room remains read
                await util.assertStillRead(room2);
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
            // XXX: Failing since migration to Playwright
            test.skip("A room where all threaded edits are read is still read after restart", async ({
                roomAlpha: room1,
                roomBeta: room2,
                util,
                msg,
            }) => {
                await util.goTo(room2);
                await util.receiveMessages(room2, [
                    "Msg1",
                    msg.threadedOff("Msg1", "Resp1"),
                    msg.editOf("Resp1", "Edit1"),
                ]);
                await util.assertUnread(room2, 1);
                await util.openThread("Msg1");
                await util.assertRead(room2);
                await util.goTo(room1); // Make sure we are looking at room1 after reload
                await util.assertStillRead(room2);

                await util.saveAndReload();
                await util.assertRead(room2);
            });
            // XXX: fails because the room becomes unread after restart
            test.skip("A room where all threaded edits are marked as read is still read after restart", async ({
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
                await util.assertUnread(room2, 2);
                await util.markAsRead(room2);
                await util.assertRead(room2);

                // When I restart
                await util.saveAndReload();

                // It is still read
                await util.assertRead(room2);
            });
        });

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
                await util.assertUnread(room2, 2);
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
                await util.assertUnread(room2, 3);
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
                await util.assertUnread(room2, 3);

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

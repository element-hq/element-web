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
    test.describe("redactions", () => {
        test.describe("in the main timeline", () => {
            test("Redacting the message pointed to by my receipt leaves the room read", async ({
                roomAlpha: room1,
                roomBeta: room2,
                util,
                msg,
            }) => {
                // Given I have read the messages in a room
                await util.goTo(room1);
                await util.receiveMessages(room2, ["Msg1", "Msg2"]);
                await util.assertUnread(room2, 2);
                await util.goTo(room2);
                await util.assertRead(room2);
                await util.goTo(room1);

                // When the latest message is redacted
                await util.receiveMessages(room2, [msg.redactionOf("Msg2")]);

                // Then the room remains read
                await util.assertStillRead(room2);
            });

            test("Reading an unread room after a redaction of the latest message makes it read", async ({
                roomAlpha: room1,
                roomBeta: room2,
                util,
                msg,
            }) => {
                // Given an unread room
                await util.goTo(room1);
                await util.receiveMessages(room2, ["Msg1", "Msg2"]);
                await util.assertUnread(room2, 2);

                // And the latest message has been redacted
                await util.receiveMessages(room2, [msg.redactionOf("Msg2")]);

                // When I read the room
                await util.goTo(room2);
                await util.assertRead(room2);
                await util.goTo(room1);

                // Then it becomes read
                await util.assertStillRead(room2);
            });
            test("Reading an unread room after a redaction of an older message makes it read", async ({
                roomAlpha: room1,
                roomBeta: room2,
                util,
                msg,
            }) => {
                // Given an unread room with an earlier redaction
                await util.goTo(room1);
                await util.receiveMessages(room2, ["Msg1", "Msg2"]);
                await util.assertUnread(room2, 2);
                await util.receiveMessages(room2, [msg.redactionOf("Msg1")]);

                // When I read the room
                await util.goTo(room2);
                await util.assertRead(room2);
                await util.goTo(room1);

                // Then it becomes read
                await util.assertStillRead(room2);
            });
            test("Marking an unread room as read after a redaction makes it read", async ({
                roomAlpha: room1,
                roomBeta: room2,
                util,
                msg,
            }) => {
                // Given an unread room where latest message is redacted
                await util.goTo(room1);
                await util.receiveMessages(room2, ["Msg1", "Msg2"]);
                await util.assertUnread(room2, 2);
                await util.receiveMessages(room2, [msg.redactionOf("Msg2")]);
                await util.assertUnread(room2, 1);

                // When I mark it as read
                await util.markAsRead(room2);

                // Then it becomes read
                await util.assertRead(room2);
            });
            test("Sending and redacting a message after marking the room as read makes it read", async ({
                roomAlpha: room1,
                roomBeta: room2,
                util,
                msg,
            }) => {
                // Given a room that is marked as read
                await util.goTo(room1);
                await util.receiveMessages(room2, ["Msg1", "Msg2"]);
                await util.assertUnread(room2, 2);
                await util.markAsRead(room2);
                await util.assertRead(room2);

                // When a message is sent and then redacted
                await util.receiveMessages(room2, ["Msg3"]);
                await util.assertUnread(room2, 1);
                await util.receiveMessages(room2, [msg.redactionOf("Msg3")]);

                // Then the room is read
                await util.assertRead(room2);
            });
            test("Redacting a message after marking the room as read leaves it read", async ({
                roomAlpha: room1,
                roomBeta: room2,
                util,
                msg,
            }) => {
                // Given a room that is marked as read
                await util.goTo(room1);
                await util.receiveMessages(room2, ["Msg1", "Msg2", "Msg3"]);
                await util.assertUnread(room2, 3);
                await util.markAsRead(room2);
                await util.assertRead(room2);

                // When we redact some messages
                await util.receiveMessages(room2, [msg.redactionOf("Msg3")]);
                await util.receiveMessages(room2, [msg.redactionOf("Msg1")]);

                // Then it is still read
                await util.assertStillRead(room2);
            });
            test("Redacting one of the unread messages reduces the unread count", async ({
                roomAlpha: room1,
                roomBeta: room2,
                util,
                msg,
            }) => {
                // Given an unread room
                await util.goTo(room1);
                await util.receiveMessages(room2, ["Msg1", "Msg2", "Msg3"]);
                await util.assertUnread(room2, 3);

                // When I redact a non-latest message
                await util.receiveMessages(room2, [msg.redactionOf("Msg2")]);

                // Then the unread count goes down
                await util.assertUnread(room2, 2);

                // And when I redact the latest message
                await util.receiveMessages(room2, [msg.redactionOf("Msg3")]);

                // Then the unread count goes down again
                await util.assertUnread(room2, 1);
            });
            test("Redacting one of the unread messages reduces the unread count after restart", async ({
                roomAlpha: room1,
                roomBeta: room2,
                util,
                msg,
            }) => {
                // Given unread count was reduced by redacting messages
                await util.goTo(room1);
                await util.receiveMessages(room2, ["Msg1", "Msg2", "Msg3"]);
                await util.assertUnread(room2, 3);
                await util.receiveMessages(room2, [msg.redactionOf("Msg2")]);
                await util.assertUnread(room2, 2);
                await util.receiveMessages(room2, [msg.redactionOf("Msg3")]);
                await util.assertUnread(room2, 1);

                // When I restart
                await util.saveAndReload();

                // Then the unread count is still reduced
                await util.assertUnread(room2, 1);
            });
            test("Redacting all unread messages makes the room read", async ({
                roomAlpha: room1,
                roomBeta: room2,
                util,
                msg,
            }) => {
                // Given an unread room
                await util.goTo(room1);
                await util.receiveMessages(room2, ["Msg1", "Msg2"]);
                await util.assertUnread(room2, 2);

                // When I redact all the unread messages
                await util.receiveMessages(room2, [msg.redactionOf("Msg2")]);
                await util.receiveMessages(room2, [msg.redactionOf("Msg1")]);

                // Then the room is back to being read
                await util.assertRead(room2);
            });
            test("Redacting all unread messages makes the room read after restart", async ({
                roomAlpha: room1,
                roomBeta: room2,
                util,
                msg,
            }) => {
                // Given all unread messages were redacted
                await util.goTo(room1);
                await util.receiveMessages(room2, ["Msg1", "Msg2"]);
                await util.assertUnread(room2, 2);
                await util.receiveMessages(room2, [msg.redactionOf("Msg2")]);
                await util.receiveMessages(room2, [msg.redactionOf("Msg1")]);
                await util.assertRead(room2);

                // When I restart
                await util.saveAndReload();

                // Then the room is still read
                await util.assertRead(room2);
            });
            test("Reacting to a redacted message leaves the room read", async ({
                page,
                roomAlpha: room1,
                roomBeta: room2,
                util,
                msg,
            }) => {
                // Given a redacted message exists
                await util.goTo(room1);
                await util.receiveMessages(room2, ["Msg1", "Msg2"]);
                await util.assertUnread(room2, 2);
                await util.receiveMessages(room2, [msg.redactionOf("Msg2")]);
                await util.assertUnread(room2, 1);

                // And the room is read
                await util.goTo(room2);
                await util.assertRead(room2);
                await page.waitForTimeout(200);
                await util.goTo(room1);

                // When I react to the redacted message
                await util.receiveMessages(room2, [msg.reactionTo("Msg2", "🪿")]);

                // Then the room is still read
                await util.assertStillRead(room2);
            });
            test("Editing a redacted message leaves the room read", async ({
                roomAlpha: room1,
                roomBeta: room2,
                util,
                msg,
            }) => {
                // Given a redacted message exists
                await util.goTo(room1);
                await util.receiveMessages(room2, ["Msg1", "Msg2"]);
                await util.assertUnread(room2, 2);
                await util.receiveMessages(room2, [msg.redactionOf("Msg2")]);
                await util.assertUnread(room2, 1);

                // And the room is read
                await util.goTo(room2);
                await util.assertRead(room2);
                await util.goTo(room1);

                // When I attempt to edit the redacted message
                await util.receiveMessages(room2, [msg.editOf("Msg2", "Msg2 is BACK")]);

                // Then the room is still read
                await util.assertStillRead(room2);
            });
            test("A reply to a redacted message makes the room unread", async ({
                roomAlpha: room1,
                roomBeta: room2,
                util,
                msg,
            }) => {
                // Given a message was redacted
                await util.goTo(room1);
                await util.receiveMessages(room2, ["Msg1", "Msg2"]);
                await util.assertUnread(room2, 2);
                await util.receiveMessages(room2, [msg.redactionOf("Msg2")]);
                await util.assertUnread(room2, 1);

                // And the room is read
                await util.goTo(room2);
                await util.assertRead(room2);
                await util.goTo(room1);

                // When I receive a reply to the redacted message
                await util.receiveMessages(room2, [msg.replyTo("Msg2", "Reply to Msg2")]);

                // Then the room is unread
                await util.assertUnread(room2, 1);
            });
            test("Reading a reply to a redacted message marks the room as read", async ({
                roomAlpha: room1,
                roomBeta: room2,
                util,
                msg,
            }) => {
                // Given someone replied to a redacted message
                await util.goTo(room1);
                await util.receiveMessages(room2, ["Msg1", "Msg2"]);
                await util.assertUnread(room2, 2);
                await util.receiveMessages(room2, [msg.redactionOf("Msg2")]);
                await util.assertUnread(room2, 1);
                await util.goTo(room2);
                await util.assertRead(room2);
                await util.goTo(room1);
                await util.receiveMessages(room2, [msg.replyTo("Msg2", "Reply to Msg2")]);
                await util.assertUnread(room2, 1);

                // When I read the reply
                await util.goTo(room2);
                await util.assertRead(room2);

                // Then the room is unread
                await util.goTo(room1);
                await util.assertStillRead(room2);
            });
        });

        test.describe("in threads", () => {
            test("Redacting the threaded message pointed to by my receipt leaves the room read", async ({
                roomAlpha: room1,
                roomBeta: room2,
                util,
                msg,
            }) => {
                // Given I have some threads
                await util.goTo(room1);
                await util.receiveMessages(room2, [
                    "Root1",
                    msg.threadedOff("Root1", "ThreadMsg1"),
                    msg.threadedOff("Root1", "ThreadMsg2"),
                    "Root2",
                    msg.threadedOff("Root2", "Root2->A"),
                ]);
                await util.assertUnread(room2, 5);

                // And I have read them
                await util.goTo(room2);
                await util.assertUnreadThread("Root1");
                await util.openThread("Root1");
                await util.assertUnreadLessThan(room2, 4);
                await util.openThread("Root2");
                await util.assertRead(room2);
                await util.closeThreadsPanel();
                await util.goTo(room1);
                await util.assertRead(room2);

                // When the latest message in a thread is redacted
                await util.receiveMessages(room2, [msg.redactionOf("ThreadMsg2")]);

                // Then the room and thread are still read
                await util.assertStillRead(room2);
                await util.goTo(room2);
                await util.assertReadThread("Root1");
            });
            test("Reading an unread thread after a redaction of the latest message makes it read", async ({
                roomAlpha: room1,
                roomBeta: room2,
                util,
                msg,
            }) => {
                // Given an unread thread where the latest message was redacted
                await util.goTo(room1);
                await util.receiveMessages(room2, [
                    "Root",
                    msg.threadedOff("Root", "ThreadMsg1"),
                    msg.threadedOff("Root", "ThreadMsg2"),
                ]);
                await util.assertUnread(room2, 3);
                await util.receiveMessages(room2, [msg.redactionOf("ThreadMsg2")]);
                await util.assertUnread(room2, 2);
                await util.goTo(room2);
                await util.assertUnreadThread("Root");

                // When I read the thread
                await util.openThread("Root");
                await util.assertRead(room2);
                await util.closeThreadsPanel();
                await util.goTo(room1);

                // Then the thread is read
                await util.assertRead(room2);
                await util.goTo(room2);
                await util.assertReadThread("Root");
            });
            test("Reading an unread thread after a redaction of the latest message makes it read after restart", async ({
                roomAlpha: room1,
                roomBeta: room2,
                util,
                msg,
            }) => {
                // Given a redacted message is not counted in the unread count
                await util.goTo(room1);
                await util.receiveMessages(room2, [
                    "Root",
                    msg.threadedOff("Root", "ThreadMsg1"),
                    msg.threadedOff("Root", "ThreadMsg2"),
                ]);
                await util.assertUnread(room2, 3);
                await util.receiveMessages(room2, [msg.redactionOf("ThreadMsg2")]);
                await util.assertUnread(room2, 2);
                await util.goTo(room2);
                await util.assertUnreadThread("Root");
                await util.openThread("Root");
                await util.assertRead(room2);
                await util.closeThreadsPanel();
                await util.goTo(room1);
                await util.assertRead(room2);
                await util.goTo(room2);
                await util.assertReadThread("Root");

                // When I restart
                await util.saveAndReload();

                // Then the room is still read
                await util.assertRead(room2);
            });
            test("Reading an unread thread after a redaction of an older message makes it read", async ({
                roomAlpha: room1,
                roomBeta: room2,
                util,
                msg,
            }) => {
                // Given an unread thread where an older message was redacted
                await util.goTo(room1);
                await util.receiveMessages(room2, [
                    "Root",
                    msg.threadedOff("Root", "ThreadMsg1"),
                    msg.threadedOff("Root", "ThreadMsg2"),
                ]);
                await util.assertUnread(room2, 3);
                await util.receiveMessages(room2, [msg.redactionOf("ThreadMsg1")]);
                await util.assertUnread(room2, 2);
                await util.goTo(room2);
                await util.assertUnreadThread("Root");

                // When I read the thread
                await util.openThread("Root");
                await util.assertRead(room2);
                await util.closeThreadsPanel();
                await util.goTo(room1);

                // Then the thread is read
                await util.assertRead(room2);
                await util.goTo(room2);
                await util.assertReadThread("Root");
            });
            test("Marking an unread thread as read after a redaction makes it read", async ({
                roomAlpha: room1,
                roomBeta: room2,
                util,
                msg,
            }) => {
                // Given an unread thread where an older message was redacted
                await util.goTo(room1);
                await util.receiveMessages(room2, [
                    "Root",
                    msg.threadedOff("Root", "ThreadMsg1"),
                    msg.threadedOff("Root", "ThreadMsg2"),
                ]);
                await util.assertUnread(room2, 3);
                await util.receiveMessages(room2, [msg.redactionOf("ThreadMsg1")]);
                await util.assertUnread(room2, 2);

                // When I mark the room as read
                await util.markAsRead(room2);
                await util.assertRead(room2);

                // Then the thread is read
                await util.assertRead(room2);
                await util.goTo(room2);
                await util.assertReadThread("Root");
            });
            test("Sending and redacting a message after marking the thread as read leaves it read", async ({
                roomAlpha: room1,
                roomBeta: room2,
                util,
                msg,
            }) => {
                // Given a thread exists and is marked as read
                await util.goTo(room1);
                await util.receiveMessages(room2, [
                    "Root",
                    msg.threadedOff("Root", "ThreadMsg1"),
                    msg.threadedOff("Root", "ThreadMsg2"),
                ]);
                await util.assertUnread(room2, 3);
                await util.markAsRead(room2);
                await util.assertRead(room2);

                // When I send and redact a message
                await util.receiveMessages(room2, [msg.threadedOff("Root", "Msg3")]);
                await util.assertUnread(room2, 1);
                await util.receiveMessages(room2, [msg.redactionOf("Msg3")]);

                // Then the room and thread are read
                await util.assertRead(room2);
                await util.goTo(room2);
                await util.assertReadThread("Root");
            });
            test("Redacting a message after marking the thread as read leaves it read", async ({
                roomAlpha: room1,
                roomBeta: room2,
                util,
                msg,
            }) => {
                // Given a thread exists and is marked as read
                await util.goTo(room1);
                await util.receiveMessages(room2, [
                    "Root",
                    msg.threadedOff("Root", "ThreadMsg1"),
                    msg.threadedOff("Root", "ThreadMsg2"),
                ]);
                await util.assertUnread(room2, 3);
                await util.markAsRead(room2);
                await util.assertRead(room2);

                // When I redact a message
                await util.receiveMessages(room2, [msg.redactionOf("ThreadMsg1")]);

                // Then the room and thread are read
                await util.assertRead(room2);
                await util.goTo(room2);
                await util.assertReadThread("Root");
            });
            test("Reacting to a redacted message leaves the thread read", async ({
                roomAlpha: room1,
                roomBeta: room2,
                util,
                msg,
            }) => {
                // Given a message in a thread was redacted and everything is read
                await util.goTo(room1);
                await util.receiveMessages(room2, [
                    "Root",
                    msg.threadedOff("Root", "Msg2"),
                    msg.threadedOff("Root", "Msg3"),
                ]);
                await util.assertUnread(room2, 3);
                await util.receiveMessages(room2, [msg.redactionOf("Msg2")]);
                await util.assertUnread(room2, 2);
                await util.goTo(room2);
                await util.assertUnread(room2, 1);
                await util.openThread("Root");
                await util.assertRead(room2);
                await util.goTo(room1);

                // When we receive a reaction to the redacted event
                await util.receiveMessages(room2, [msg.reactionTo("Msg2", "z")]);

                // Then the room is unread
                await util.assertStillRead(room2);
            });
            test("Editing a redacted message leaves the thread read", async ({
                roomAlpha: room1,
                roomBeta: room2,
                util,
                msg,
            }) => {
                // Given a message in a thread was redacted and everything is read
                await util.goTo(room1);
                await util.receiveMessages(room2, [
                    "Root",
                    msg.threadedOff("Root", "Msg2"),
                    msg.threadedOff("Root", "Msg3"),
                ]);
                await util.assertUnread(room2, 3);
                await util.receiveMessages(room2, [msg.redactionOf("Msg2")]);
                await util.assertUnread(room2, 2);
                await util.goTo(room2);
                await util.assertUnread(room2, 1);
                await util.openThread("Root");
                await util.assertRead(room2);
                await util.goTo(room1);

                // When we receive an edit of the redacted message
                await util.receiveMessages(room2, [msg.editOf("Msg2", "New Msg2")]);

                // Then the room is unread
                await util.assertStillRead(room2);
            });
            test("Reading a thread after a reaction to a redacted message marks the thread as read", async ({
                roomAlpha: room1,
                roomBeta: room2,
                util,
                msg,
            }) => {
                // Given a redacted message in a thread exists, but someone reacted to it before it was redacted
                await util.goTo(room1);
                await util.receiveMessages(room2, [
                    "Root",
                    msg.threadedOff("Root", "Msg2"),
                    msg.threadedOff("Root", "Msg3"),
                    msg.reactionTo("Msg3", "x"),
                ]);
                await util.assertUnread(room2, 3);
                await util.receiveMessages(room2, [msg.redactionOf("Msg3")]);
                await util.assertUnread(room2, 2);

                // When we read the thread
                await util.goTo(room2);
                await util.openThread("Root");

                // Then the thread (and room) are read
                await util.assertRead(room2);
                await util.assertReadThread("Root");
            });
            test("Reading a thread containing a redacted, edited message marks the thread as read", async ({
                roomAlpha: room1,
                roomBeta: room2,
                util,
                msg,
            }) => {
                // Given a redacted message in a thread exists, but someone edited it before it was redacted
                await util.goTo(room1);
                await util.receiveMessages(room2, [
                    "Root",
                    msg.threadedOff("Root", "Msg2"),
                    msg.threadedOff("Root", "Msg3"),
                    msg.editOf("Msg3", "Msg3 Edited"),
                ]);
                await util.assertUnread(room2, 3);
                await util.receiveMessages(room2, [msg.redactionOf("Msg3")]);

                // When we read the thread
                await util.goTo(room2);
                await util.openThread("Root");

                // Then the thread (and room) are read
                await util.assertRead(room2);
                await util.assertReadThread("Root");
            });
            test("Reading a reply to a redacted message marks the thread as read", async ({
                roomAlpha: room1,
                roomBeta: room2,
                util,
                msg,
            }) => {
                // Given a redacted message in a thread exists, but someone replied before it was redacted
                await util.goTo(room1);
                await util.receiveMessages(room2, [
                    "Root",
                    msg.threadedOff("Root", "Msg2"),
                    msg.threadedOff("Root", "Msg3"),
                    msg.replyTo("Msg3", "Msg3Reply"),
                ]);
                await util.assertUnread(room2, 4);
                await util.receiveMessages(room2, [msg.redactionOf("Msg3")]);

                // When we read the thread, creating a receipt that points at the edit
                await util.goTo(room2);
                await util.openThread("Root");

                // Then the thread (and room) are read
                await util.assertRead(room2);
                await util.assertReadThread("Root");
            });
            test("Reading a thread root when its only message has been redacted leaves the room read", async ({
                roomAlpha: room1,
                roomBeta: room2,
                util,
                msg,
            }) => {
                // Given we had a thread
                await util.goTo(room1);
                await util.receiveMessages(room2, ["Root", msg.threadedOff("Root", "Msg2")]);
                await util.assertUnread(room2, 2);

                // And then redacted the message that makes it a thread
                await util.receiveMessages(room2, [msg.redactionOf("Msg2")]);
                await util.assertUnread(room2, 1);

                // When we read the main timeline
                await util.goTo(room2);

                // Then the room is read
                await util.assertRead(room2);
            });
            test("A thread with a redacted unread is still read after restart", async ({
                roomAlpha: room1,
                roomBeta: room2,
                util,
                msg,
            }) => {
                // Given I sent and redacted a message in an otherwise-read thread
                await util.goTo(room1);
                await util.receiveMessages(room2, [
                    "Root",
                    msg.threadedOff("Root", "ThreadMsg1"),
                    msg.threadedOff("Root", "ThreadMsg2"),
                ]);
                await util.assertUnread(room2, 3);
                await util.goTo(room2);
                await util.openThread("Root");
                await util.assertRead(room2);
                await util.assertReadThread("Root");
                await util.receiveMessages(room2, [msg.threadedOff("Root", "Msg3")]);
                await util.assertUnread(room2, 1);
                await util.receiveMessages(room2, [msg.redactionOf("Msg3")]);
                await util.assertRead(room2);
                await util.goTo(room2);
                await util.assertReadThread("Root");
                await util.goTo(room1);

                // When I restart
                await util.saveAndReload();

                // Then the room and thread are still read
                await util.assertRead(room2);
                await util.goTo(room2);
                await util.assertReadThread("Root");
            });
            test("A thread with a read redaction is still read after restart", async ({
                roomAlpha: room1,
                roomBeta: room2,
                util,
                msg,
            }) => {
                // Given my receipt points at a redacted thread message
                await util.goTo(room1);
                await util.receiveMessages(room2, [
                    "Root1",
                    msg.threadedOff("Root1", "ThreadMsg1"),
                    msg.threadedOff("Root1", "ThreadMsg2"),
                    "Root2",
                    msg.threadedOff("Root2", "Root2->A"),
                ]);
                await util.assertUnread(room2, 5);
                await util.goTo(room2);
                await util.assertUnreadThread("Root1");
                await util.openThread("Root1");
                await util.assertUnreadLessThan(room2, 4);
                await util.openThread("Root2");
                await util.assertRead(room2);
                await util.closeThreadsPanel();
                await util.goTo(room1);
                await util.assertRead(room2);
                await util.receiveMessages(room2, [msg.redactionOf("ThreadMsg2")]);
                await util.assertStillRead(room2);
                await util.goTo(room2);
                await util.assertReadThread("Root1");

                // When I restart
                await util.saveAndReload();

                // Then the room is still read
                await util.assertRead(room2);
            });
            test("A thread with an unread reply to a redacted message is still unread after restart", async ({
                roomAlpha: room1,
                roomBeta: room2,
                util,
                msg,
            }) => {
                // Given a redacted message in a thread exists, but someone replied before it was redacted
                await util.goTo(room1);
                await util.receiveMessages(room2, [
                    "Root",
                    msg.threadedOff("Root", "Msg2"),
                    msg.threadedOff("Root", "Msg3"),
                    msg.replyTo("Msg3", "Msg3Reply"),
                ]);
                await util.assertUnread(room2, 4);
                await util.receiveMessages(room2, [msg.redactionOf("Msg3")]);

                // And we have read all this
                await util.goTo(room2);
                await util.openThread("Root");
                await util.assertRead(room2);
                await util.assertReadThread("Root");

                // When I restart
                await util.saveAndReload();

                // Then the room is still read
                await util.assertRead(room2);
                await util.assertReadThread("Root");
            });
            test("A thread with a read reply to a redacted message is still read after restart", async ({
                roomAlpha: room1,
                roomBeta: room2,
                util,
                msg,
            }) => {
                // Given a redacted message in a thread exists, but someone replied before it was redacted
                await util.goTo(room1);
                await util.receiveMessages(room2, [
                    "Root",
                    msg.threadedOff("Root", "Msg2"),
                    msg.threadedOff("Root", "Msg3"),
                    msg.replyTo("Msg3", "Msg3Reply"),
                ]);
                await util.assertUnread(room2, 4);
                await util.receiveMessages(room2, [msg.redactionOf("Msg3")]);

                // And I read it, so the room is read
                await util.goTo(room2);
                await util.openThread("Root");
                await util.assertRead(room2);
                await util.assertReadThread("Root");

                // When I restart
                await util.saveAndReload();

                // Then the room is still read
                await util.assertRead(room2);
                await util.assertReadThread("Root");
            });
        });

        test.describe("thread roots", () => {
            test("Redacting a thread root after it was read leaves the room read", async ({
                roomAlpha: room1,
                roomBeta: room2,
                util,
                msg,
            }) => {
                test.slow();

                // Given a thread exists and is read
                await util.goTo(room1);
                await util.receiveMessages(room2, [
                    "Root",
                    msg.threadedOff("Root", "Msg2"),
                    msg.threadedOff("Root", "Msg3"),
                ]);
                await util.assertUnread(room2, 3);
                await util.goTo(room2);
                await util.openThread("Root");
                await util.assertRead(room2);
                await util.assertReadThread("Root");

                // When someone redacts the thread root
                await util.receiveMessages(room2, [msg.redactionOf("Root")]);

                // Then the room is still read
                await util.assertStillRead(room2);
            });
            test("Redacting a thread root still allows us to read the thread", async ({
                roomAlpha: room1,
                roomBeta: room2,
                util,
                msg,
            }) => {
                // Given an unread thread exists
                await util.goTo(room1);
                await util.receiveMessages(room2, [
                    "Root",
                    msg.threadedOff("Root", "Msg2"),
                    msg.threadedOff("Root", "Msg3"),
                ]);
                await util.assertUnread(room2, 3);

                // When someone redacts the thread root
                await util.receiveMessages(room2, [msg.redactionOf("Root")]);

                // Then the room is still unread
                await util.assertUnread(room2, 2);

                // And I can open the thread and read it
                await util.goTo(room2);
                await util.assertUnread(room2, 2);
                // The redacted message gets collapsed into, "foo was invited, joined and removed a message"
                await util.openCollapsedMessage(1);
                await util.openThread("Message deleted");
                await util.assertRead(room2);
                await util.assertReadThread("Root");
            });
            test("Sending a threaded message onto a redacted thread root leaves the room unread", async ({
                roomAlpha: room1,
                roomBeta: room2,
                util,
                msg,
            }) => {
                // Given a thread exists, is read and its root is redacted
                await util.goTo(room1);
                await util.receiveMessages(room2, [
                    "Root",
                    msg.threadedOff("Root", "Msg2"),
                    msg.threadedOff("Root", "Msg3"),
                ]);
                await util.assertUnread(room2, 3);
                await util.goTo(room2);
                await util.openThread("Root");
                await util.assertRead(room2);
                await util.assertReadThread("Root");
                await util.receiveMessages(room2, [msg.redactionOf("Root")]);

                // When we receive a new message on it
                await util.receiveMessages(room2, [msg.threadedOff("Root", "Msg4")]);

                // Then the room and thread are unread
                await util.assertUnread(room2, 1);
                await util.goTo(room2);
                await util.assertUnreadThread("Message deleted");
            });
            test("Reacting to a redacted thread root leaves the room read", async ({
                roomAlpha: room1,
                roomBeta: room2,
                util,
                msg,
            }) => {
                // Given a thread exists, is read and the root was redacted
                await util.goTo(room1);
                await util.receiveMessages(room2, [
                    "Root",
                    msg.threadedOff("Root", "Msg2"),
                    msg.threadedOff("Root", "Msg3"),
                ]);
                await util.assertUnread(room2, 3);
                await util.goTo(room2);
                await util.openThread("Root");
                await util.assertRead(room2);
                await util.assertReadThread("Root");
                await util.receiveMessages(room2, [msg.redactionOf("Root")]);

                // When I react to the old root
                await util.receiveMessages(room2, [msg.reactionTo("Root", "y")]);

                // Then the room is still read
                await util.assertRead(room2);
            });
            test("Editing a redacted thread root leaves the room read", async ({
                roomAlpha: room1,
                roomBeta: room2,
                util,
                msg,
            }) => {
                // Given a thread exists, is read and the root was redacted
                await util.goTo(room1);
                await util.receiveMessages(room2, [
                    "Root",
                    msg.threadedOff("Root", "Msg2"),
                    msg.threadedOff("Root", "Msg3"),
                ]);
                await util.assertUnread(room2, 3);
                await util.goTo(room2);
                await util.openThread("Root");
                await util.assertRead(room2);
                await util.assertReadThread("Root");
                await util.receiveMessages(room2, [msg.redactionOf("Root")]);

                // When I edit the old root
                await util.receiveMessages(room2, [msg.editOf("Root", "New Root")]);

                // Then the room is still read
                await util.assertRead(room2);
            });
            test("Replying to a redacted thread root makes the room unread", async ({
                roomAlpha: room1,
                roomBeta: room2,
                util,
                msg,
            }) => {
                // Given a thread exists, is read and the root was redacted
                await util.goTo(room1);
                await util.receiveMessages(room2, [
                    "Root",
                    msg.threadedOff("Root", "Msg2"),
                    msg.threadedOff("Root", "Msg3"),
                ]);
                await util.assertUnread(room2, 3);
                await util.goTo(room2);
                await util.openThread("Root");
                await util.assertRead(room2);
                await util.assertReadThread("Root");
                await util.receiveMessages(room2, [msg.redactionOf("Root")]);

                // When I reply to the old root
                await util.receiveMessages(room2, [msg.replyTo("Root", "Reply!")]);

                // Then the room is unread
                await util.assertUnread(room2, 1);
            });
            test("Reading a reply to a redacted thread root makes the room read", async ({
                roomAlpha: room1,
                roomBeta: room2,
                util,
                msg,
            }) => {
                // Given a thread exists, is read and the root was redacted, and
                // someone replied to it
                await util.goTo(room1);
                await util.receiveMessages(room2, [
                    "Root",
                    msg.threadedOff("Root", "Msg2"),
                    msg.threadedOff("Root", "Msg3"),
                ]);
                await util.assertUnread(room2, 3);
                await util.goTo(room2);
                await util.openThread("Root");
                await util.assertRead(room2);
                await util.assertReadThread("Root");
                await util.receiveMessages(room2, [msg.redactionOf("Root")]);
                await util.assertStillRead(room2);
                await util.receiveMessages(room2, [msg.replyTo("Root", "Reply!")]);
                await util.assertUnread(room2, 1);

                // When I read the room
                await util.goTo(room2);

                // Then it becomes read
                await util.assertRead(room2);
            });
        });
    });
});

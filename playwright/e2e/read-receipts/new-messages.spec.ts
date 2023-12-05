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
            // XXX: fails (sometimes!) because the unread count stays high
            test.skip("Reading an older message leaves the room unread", async ({
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
            // XXX: fails because the room remains unread even though I sent a message
            // Note: this test should not re-use the same MatrixClient - it
            // should create a new one logged in as the same user.
            test.skip("Me sending a message from a different client marks room as read", async ({
                roomAlpha: room1,
                roomBeta: room2,
                util,
                app,
            }) => {
                // Given I have unread messages
                await util.goTo(room1);
                await util.assertRead(room2);
                await util.receiveMessages(room2, ["Msg1"]);
                await util.assertUnread(room2, 1);

                // When I send a new message from a different client
                await util.sendMessageAsClient(app.client, room2, ["Msg2"]);

                // Then this room is marked as read
                await util.assertRead(room2);
            });
        });

        test.describe("in threads", () => {
            test("Receiving a message makes a room unread", async ({
                roomAlpha: room1,
                roomBeta: room2,
                util,
                msg,
            }) => {
                // Given a message arrived and is read
                await util.goTo(room1);
                await util.receiveMessages(room2, ["Msg1"]);
                await util.assertUnread(room2, 1);
                await util.goTo(room2);
                await util.assertRead(room2);
                await util.goTo(room1);

                // When I receive a threaded message
                await util.receiveMessages(room2, [msg.threadedOff("Msg1", "Resp1")]);

                // Then the room becomes unread
                await util.assertUnread(room2, 1);
            });
            test("Reading the last threaded message makes the room read", async ({
                roomAlpha: room1,
                roomBeta: room2,
                util,
                msg,
            }) => {
                // Given a thread exists and is not read
                await util.goTo(room1);
                await util.receiveMessages(room2, ["Msg1", msg.threadedOff("Msg1", "Resp1")]);
                await util.assertUnread(room2, 2);
                await util.goTo(room2);

                // When I read it
                await util.openThread("Msg1");

                // The room becomes read
                await util.assertRead(room2);
            });
            test("Reading a thread message makes the thread read", async ({
                roomAlpha: room1,
                roomBeta: room2,
                util,
                msg,
            }) => {
                // Given a thread exists
                await util.goTo(room1);
                await util.receiveMessages(room2, [
                    "Msg1",
                    msg.threadedOff("Msg1", "Resp1"),
                    msg.threadedOff("Msg1", "Resp2"),
                ]);
                await util.assertUnread(room2, 3); // (Sanity)

                // When I read the main timeline
                await util.goTo(room2);

                // Then room does appear unread
                await util.assertUnread(room2, 2);

                // Until we open the thread
                await util.openThread("Msg1");
                await util.assertReadThread("Msg1");
                await util.assertRead(room2);
            });
            // XXX: Fails since migration to Playwright
            test.skip("Reading an older thread message leaves the thread unread", async ({
                roomAlpha: room1,
                roomBeta: room2,
                util,
                msg,
            }) => {
                // Given there are many messages in a thread
                await util.goTo(room1);
                await util.receiveMessages(room2, [
                    "ThreadRoot",
                    ...msg.manyThreadedOff("ThreadRoot", many("InThread", 20)),
                ]);
                await util.assertUnread(room2, 21);

                // When I read an older message in the thread
                await msg.jumpTo(room2.name, "InThread0001", true);
                await util.assertUnreadLessThan(room2, 21);
                // TODO: for some reason, we can't find the first message
                // "InThread0", so I am using the second here. Also, they appear
                // out of order, with "InThread2" before "InThread1". Might be a
                // clue to the sporadic reports we have had of messages going
                // missing in threads?

                // Then the thread is still marked as unread
                await util.backToThreadsList();
                await util.assertUnreadThread("ThreadRoot");
            });
            test("Reading only one thread's message does not make the room read", async ({
                roomAlpha: room1,
                roomBeta: room2,
                util,
                msg,
            }) => {
                // Given two threads are unread
                await util.goTo(room1);
                await util.receiveMessages(room2, [
                    "Msg1",
                    msg.threadedOff("Msg1", "Resp1"),
                    "Msg2",
                    msg.threadedOff("Msg2", "Resp2"),
                ]);
                await util.assertUnread(room2, 4);
                await util.goTo(room2);
                await util.assertUnread(room2, 2);

                // When I only read one of them
                await util.openThread("Msg1");

                // The room is still unread
                await util.assertUnread(room2, 1);
            });
            test("Reading only one thread's message makes that thread read but not others", async ({
                roomAlpha: room1,
                roomBeta: room2,
                util,
                msg,
            }) => {
                // Given I have unread threads
                await util.goTo(room1);
                await util.receiveMessages(room2, [
                    "Msg1",
                    "Msg2",
                    msg.threadedOff("Msg1", "Resp1"),
                    msg.threadedOff("Msg2", "Resp2"),
                ]);
                await util.assertUnread(room2, 4); // (Sanity)
                await util.goTo(room2);
                await util.assertUnread(room2, 2);
                await util.assertUnreadThread("Msg1");
                await util.assertUnreadThread("Msg2");

                // When I read one of them
                await util.openThread("Msg1");

                // Then that one is read, but the other is not
                await util.assertReadThread("Msg1");
                await util.assertUnreadThread("Msg2");
            });
            test("Reading the main timeline does not mark a thread message as read", async ({
                roomAlpha: room1,
                roomBeta: room2,
                util,
                msg,
            }) => {
                // Given a thread exists
                await util.goTo(room1);
                await util.receiveMessages(room2, [
                    "Msg1",
                    msg.threadedOff("Msg1", "Resp1"),
                    msg.threadedOff("Msg1", "Resp2"),
                ]);
                await util.assertUnread(room2, 3); // (Sanity)

                // When I read the main timeline
                await util.goTo(room2);
                await util.assertUnread(room2, 2);

                // Then thread does appear unread
                await util.assertUnreadThread("Msg1");
            });
            test("Marking a room with unread threads as read makes it read", async ({
                roomAlpha: room1,
                roomBeta: room2,
                util,
                msg,
            }) => {
                // Given I have an unread thread
                await util.goTo(room1);
                await util.receiveMessages(room2, [
                    "Msg1",
                    msg.threadedOff("Msg1", "Resp1"),
                    msg.threadedOff("Msg1", "Resp2"),
                ]);
                await util.assertUnread(room2, 3); // (Sanity)

                // When I mark the room as read
                await util.markAsRead(room2);

                // Then the room is read
                await util.assertRead(room2);
            });
            test("Sending a new thread message after marking as read makes it unread", async ({
                roomAlpha: room1,
                roomBeta: room2,
                util,
                msg,
            }) => {
                // Given a thread exists
                await util.goTo(room1);
                await util.receiveMessages(room2, [
                    "Msg1",
                    msg.threadedOff("Msg1", "Resp1"),
                    msg.threadedOff("Msg1", "Resp2"),
                ]);

                // When I mark the room as read
                await util.markAsRead(room2);
                await util.assertRead(room2);

                // Then another message appears in the thread
                await util.receiveMessages(room2, [msg.threadedOff("Msg1", "Resp3")]);

                // Then the room becomes unread
                await util.assertUnread(room2, 1);
            });
            test("Sending a new different-thread message after marking as read makes it unread", async ({
                roomAlpha: room1,
                roomBeta: room2,
                util,
                msg,
            }) => {
                // Given 2 threads exist, and Thread2 has the latest message in it
                await util.goTo(room1);
                await util.receiveMessages(room2, ["Thread1", "Thread2", msg.threadedOff("Thread1", "t1a")]);
                // Make sure the message in Thread 1 has definitely arrived, so that we know for sure
                // that the one in Thread 2 is the latest.
                await util.assertUnread(room2, 3);

                await util.receiveMessages(room2, [msg.threadedOff("Thread2", "t2a")]);
                // Make sure the 4th message has arrived before we mark as read.
                await util.assertUnread(room2, 4);

                // When I mark the room as read (making an unthreaded receipt for t2a)
                await util.markAsRead(room2);
                await util.assertRead(room2);

                // Then another message appears in the other thread
                await util.receiveMessages(room2, [msg.threadedOff("Thread1", "t1b")]);

                // Then the room becomes unread
                await util.assertUnread(room2, 1);
            });
            test("A room with a new threaded message is still unread after restart", async ({
                roomAlpha: room1,
                roomBeta: room2,
                util,
                msg,
            }) => {
                // Given a thread exists
                await util.goTo(room1);
                await util.receiveMessages(room2, [
                    "Msg1",
                    msg.threadedOff("Msg1", "Resp1"),
                    msg.threadedOff("Msg1", "Resp2"),
                ]);
                await util.assertUnread(room2, 3); // (Sanity)

                // When I read the main timeline
                await util.goTo(room2);

                // Then room does appear unread
                await util.assertUnread(room2, 2);

                await util.saveAndReload();
                await util.assertUnread(room2, 2);

                // Until we open the thread
                await util.openThread("Msg1");
                await util.assertRead(room2);
            });
            test("A room where all threaded messages are read is still read after restart", async ({
                roomAlpha: room1,
                roomBeta: room2,
                util,
                msg,
            }) => {
                // Given I have read all the threads
                await util.goTo(room1);
                await util.receiveMessages(room2, [
                    "Msg1",
                    msg.threadedOff("Msg1", "Resp1"),
                    msg.threadedOff("Msg1", "Resp2"),
                ]);
                await util.assertUnread(room2, 3); // (Sanity)
                await util.goTo(room2);
                await util.assertUnread(room2, 2);
                await util.openThread("Msg1");
                await util.assertRead(room2);

                // When I restart
                await util.saveAndReload();

                // Then the room is still read
                await util.assertRead(room2);
            });
        });

        test.describe("thread roots", () => {
            test("Reading a thread root does not mark the thread as read", async ({
                roomAlpha: room1,
                roomBeta: room2,
                util,
                msg,
            }) => {
                // Given a thread exists
                await util.goTo(room1);
                await util.receiveMessages(room2, ["Msg1", msg.threadedOff("Msg1", "Resp1")]);
                await util.assertUnread(room2, 2); // (Sanity)

                // When I read the main timeline
                await util.goTo(room2);

                // Then room does appear unread
                await util.assertUnread(room2, 1);
                await util.assertUnreadThread("Msg1");
            });
            // XXX: fails because we jump to the wrong place in the timeline
            test.skip("Reading a thread root within the thread view marks it as read in the main timeline", async ({
                roomAlpha: room1,
                roomBeta: room2,
                util,
                msg,
            }) => {
                // Given lots of messages are on the main timeline, and one has a thread off it
                await util.goTo(room1);
                await util.receiveMessages(room2, [
                    ...many("beforeThread", 30),
                    "ThreadRoot",
                    msg.threadedOff("ThreadRoot", "InThread"),
                    ...many("afterThread", 30),
                ]);
                await util.assertUnread(room2, 62); // Sanity

                // When I jump to an old message and read the thread
                await msg.jumpTo(room2.name, "beforeThread0000");
                await util.openThread("ThreadRoot");

                // Then the thread root is marked as read in the main timeline,
                // so there are only 30 left - the ones after the thread root.
                await util.assertUnread(room2, 30);
            });
            test("Creating a new thread based on a reply makes the room unread", async ({
                roomAlpha: room1,
                roomBeta: room2,
                util,
                msg,
            }) => {
                // Given a message and reply exist and are read
                await util.goTo(room1);
                await util.receiveMessages(room2, ["Msg1", msg.replyTo("Msg1", "Reply1")]);
                await util.goTo(room2);
                await util.assertRead(room2);
                await util.goTo(room1);
                await util.assertRead(room2);

                // When I receive a thread message created on the reply
                await util.receiveMessages(room2, [msg.threadedOff("Reply1", "Resp1")]);

                // Then the room is unread
                await util.assertUnread(room2, 1);
            });
            test("Reading a thread whose root is a reply makes the room read", async ({
                roomAlpha: room1,
                roomBeta: room2,
                util,
                msg,
            }) => {
                // Given an unread thread off a reply exists
                await util.goTo(room1);
                await util.receiveMessages(room2, [
                    "Msg1",
                    msg.replyTo("Msg1", "Reply1"),
                    msg.threadedOff("Reply1", "Resp1"),
                ]);
                await util.assertUnread(room2, 3);
                await util.goTo(room2);
                await util.assertUnread(room2, 1);
                await util.assertUnreadThread("Reply1");

                // When I read the thread
                await util.openThread("Reply1");

                // Then the room and thread are read
                await util.assertRead(room2);
                await util.assertReadThread("Reply1");
            });
        });
    });
});

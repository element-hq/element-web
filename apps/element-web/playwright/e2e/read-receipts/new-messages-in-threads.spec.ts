/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

/* See readme.md for tips on writing these tests. */

import { many, test } from ".";
import { isDendrite } from "../../plugins/homeserver/dendrite";

test.describe("Read receipts", { tag: "@mergequeue" }, () => {
    test.skip(isDendrite, "due to Dendrite bug https://github.com/element-hq/dendrite/issues/2970");

    test.describe("new messages", () => {
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

                // Then the room stays read
                await util.assertRead(room2);
                // but the thread is unread
                await util.goTo(room2);
                await util.assertUnreadThread("Msg1");
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
                await util.assertUnread(room2, 1);
                await util.goTo(room2);

                // When I read it
                await util.openThread("Msg1");

                // The thread becomes read
                await util.assertReadThread("Msg1");
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
                await util.assertUnread(room2, 1); // (Sanity)

                // When I read the main timeline
                await util.goTo(room2);

                // Then room is read
                await util.assertRead(room2);

                // Reading the thread causes it to become read too
                await util.openThread("Msg1");
                await util.assertReadThread("Msg1");
                await util.assertRead(room2);
            });

            test("Reading an older thread message leaves the thread unread", async ({
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
                await util.assertUnread(room2, 1);
                await util.goTo(room2);
                await util.assertUnreadThread("ThreadRoot");
                await util.goTo(room1);

                // When I read an older message in the thread
                await msg.jumpTo(room2, "InThread0000", true);

                // Then the thread is still marked as unread
                await util.backToThreadsList();
                await util.assertUnreadThread("ThreadRoot");
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
                await util.assertUnread(room2, 2); // (Sanity)
                await util.goTo(room2);
                await util.assertRead(room2);
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
                await util.assertUnread(room2, 1); // (Sanity)

                // When I read the main timeline
                await util.goTo(room2);
                await util.assertRead(room2);

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
                await util.assertUnread(room2, 1); // (Sanity)

                // When I mark the room as read
                await util.markAsRead(room2);

                // Then the room is read
                await util.assertRead(room2);
                // and so are the threads
                await util.assertReadThread("Msg1");
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

                // Then the thread becomes unread
                await util.goTo(room2);
                await util.assertUnreadThread("Msg1");
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

                await util.receiveMessages(room2, [msg.threadedOff("Thread2", "t2a")]);

                // When I mark the room as read (making an unthreaded receipt for t2a)
                await util.markAsRead(room2);
                await util.assertRead(room2);

                // Then another message appears in the other thread
                await util.receiveMessages(room2, [msg.threadedOff("Thread1", "t1b")]);

                // Then the other thread becomes unread
                await util.goTo(room2);
                await util.assertUnreadThread("Thread1");
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
                await util.assertUnread(room2, 1); // (Sanity)

                // When I read the main timeline
                await util.goTo(room2);

                // Then room appears read
                await util.assertRead(room2);
                /// but with an unread thread
                await util.assertUnreadThread("Msg1");

                await util.saveAndReload();
                await util.assertRead(room2);
                await util.goTo(room2);
                await util.assertUnreadThread("Msg1");

                // Opening the thread now marks it as read
                await util.openThread("Msg1");
                await util.assertReadThread("Msg1");
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
                await util.assertUnread(room2, 1); // (Sanity)
                await util.goTo(room2);
                await util.assertRead(room2);
                await util.assertUnreadThread("Msg1");
                await util.openThread("Msg1");
                await util.assertReadThread("Msg1");

                // When I restart
                await util.saveAndReload();

                // Then the room & thread still read
                await util.assertRead(room2);
                await util.goTo(room2);
                await util.assertReadThread("Msg1");
            });
        });
    });
});

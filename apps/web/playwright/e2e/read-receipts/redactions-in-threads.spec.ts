/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

/* See readme.md for tips on writing these tests. */

import { test } from ".";
import { isDendrite } from "../../plugins/homeserver/dendrite";

test.describe("Read receipts", { tag: "@mergequeue" }, () => {
    test.skip(isDendrite, "due to Dendrite bug https://github.com/element-hq/dendrite/issues/2970");

    test.describe("redactions", () => {
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
                await util.assertUnread(room2, 2);

                await util.goTo(room2);
                await util.assertUnreadThread("Root1");
                await util.assertUnreadThread("Root2");

                // And I have read them
                await util.assertUnreadThread("Root1");
                await util.openThread("Root1");
                await util.assertRead(room2);
                await util.backToThreadsList();
                await util.assertReadThread("Root1");

                await util.openThread("Root2");
                await util.assertReadThread("Root2");
                await util.closeThreadsPanel();
                await util.goTo(room1);

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
                await util.assertUnread(room2, 1);
                await util.receiveMessages(room2, [msg.redactionOf("ThreadMsg2")]);
                await util.assertUnread(room2, 1);
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
                await util.assertUnread(room2, 1);
                await util.receiveMessages(room2, [msg.redactionOf("ThreadMsg2")]);
                await util.assertUnread(room2, 1);
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

                // Then the room and thread are still read
                await util.assertRead(room2);
                await util.openThreadList();
                await util.assertReadThread("Root");
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
                await util.assertUnread(room2, 1);
                await util.receiveMessages(room2, [msg.redactionOf("ThreadMsg1")]);
                await util.assertUnread(room2, 1);
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
                await util.assertUnread(room2, 1);
                await util.receiveMessages(room2, [msg.redactionOf("ThreadMsg1")]);
                await util.assertUnread(room2, 1);

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
                await util.assertUnread(room2, 1);
                await util.markAsRead(room2);
                await util.assertRead(room2);

                // When I send and redact a message
                await util.receiveMessages(room2, [msg.threadedOff("Root", "Msg3")]);
                await util.goTo(room2);
                await util.openThreadList();
                await util.assertUnreadThread("Root");
                await util.receiveMessages(room2, [msg.redactionOf("Msg3")]);

                // Then the room and thread are read
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
                await util.assertUnread(room2, 1);
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
                await util.assertUnread(room2, 1);
                await util.receiveMessages(room2, [msg.redactionOf("Msg2")]);
                await util.assertUnread(room2, 1);
                await util.goTo(room2);
                await util.assertRead(room2);
                await util.openThread("Root");
                await util.assertRead(room2);
                await util.backToThreadsList();
                await util.assertReadThread("Root");
                await util.goTo(room1);

                // When we receive a reaction to the redacted event
                await util.receiveMessages(room2, [msg.reactionTo("Msg2", "z")]);

                // Then the room is read
                await util.assertStillRead(room2);
                await util.goTo(room2);
                await util.openThreadList();
                await util.assertReadThread("Root");
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
                await util.assertUnread(room2, 1);
                await util.receiveMessages(room2, [msg.redactionOf("Msg2")]);
                await util.assertUnread(room2, 1);
                await util.goTo(room2);
                await util.assertRead(room2);
                await util.openThreadList();
                await util.assertUnreadThread("Root");
                await util.openThread("Root");
                await util.assertReadThread("Root");
                await util.goTo(room1);

                // When we receive an edit of the redacted message
                await util.receiveMessages(room2, [msg.editOf("Msg2", "New Msg2")]);

                // Then the room is unread
                await util.assertStillRead(room2);
                // and so is the thread
                await util.goTo(room2);
                await util.openThreadList();
                await util.assertReadThread("Root");
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
                await util.assertUnread(room2, 1);
                await util.receiveMessages(room2, [msg.redactionOf("Msg3")]);
                await util.assertUnread(room2, 1);

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
                await util.assertUnread(room2, 1);
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
                await util.assertUnread(room2, 1);
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
                await util.assertUnread(room2, 1);

                // And then redacted the message that makes it a thread
                await util.receiveMessages(room2, [msg.redactionOf("Msg2")]);
                await util.assertUnread(room2, 1);

                // When we read the main timeline
                await util.goTo(room2);

                // Then the room is read
                await util.assertRead(room2);
                // and that thread is read
                await util.openThreadList();
                await util.assertReadThread("Root");
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
                await util.assertUnread(room2, 1);
                await util.goTo(room2);
                await util.openThread("Root");
                await util.assertRead(room2);
                await util.assertReadThread("Root");
                await util.receiveMessages(room2, [msg.threadedOff("Root", "Msg3")]);
                await util.assertRead(room2);
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

            /*
             * Disabled: this doesn't seem to work as, at some point after syncing from cache, the redaction and redacted
             * event get removed from the thread timeline such that we have no record of the events that the read receipt
             * points to. I suspect this may have been passing by fluke before.
             */
            test.skip("A thread with a read redaction is still read after restart", async ({
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
                await util.assertUnread(room2, 2);
                await util.goTo(room2);
                await util.assertUnreadThread("Root1");
                await util.openThread("Root1");
                await util.assertRead(room2);
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
                // and so is the thread
                await util.openThreadList();
                await util.assertReadThread("Root1");
                await util.assertReadThread("Root2");
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
                await util.assertUnread(room2, 1);
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
                await util.assertUnread(room2, 1);
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
    });
});

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
                await util.assertUnread(room2, 1);
                await util.goTo(room2);
                await util.openThread("Root");
                await util.assertRead(room2);
                await util.assertReadThread("Root");

                // When someone redacts the thread root
                await util.receiveMessages(room2, [msg.redactionOf("Root")]);

                // Then the room is still read
                await util.assertStillRead(room2);
            });

            /*
             * Disabled for the same reason as "A thread with a read redaction is still read after restart"
             * above
             */
            test.skip("Redacting a thread root still allows us to read the thread", async ({
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
                await util.assertUnread(room2, 1);

                // When someone redacts the thread root
                await util.receiveMessages(room2, [msg.redactionOf("Root")]);

                // Then the room is still unread
                await util.assertUnread(room2, 1);

                // And I can open the thread and read it
                await util.goTo(room2);
                await util.assertRead(room2);
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
                await util.assertUnread(room2, 1);
                await util.goTo(room2);
                await util.openThread("Root");
                await util.assertRead(room2);
                await util.assertReadThread("Root");
                await util.receiveMessages(room2, [msg.redactionOf("Root")]);

                // When we receive a new message on it
                await util.receiveMessages(room2, [msg.threadedOff("Root", "Msg4")]);

                // Then the room is read but the thread is unread
                await util.assertRead(room2);
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
                await util.assertUnread(room2, 1);
                await util.goTo(room2);
                await util.openThread("Root");
                await util.assertRead(room2);
                await util.assertReadThread("Root");
                await util.receiveMessages(room2, [msg.redactionOf("Root")]);

                // When I react to the old root
                await util.receiveMessages(room2, [msg.reactionTo("Root", "y")]);

                // Then the room is still read
                await util.assertRead(room2);
                await util.assertReadThread("Root");
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
                await util.assertUnread(room2, 1);
                await util.goTo(room2);
                await util.openThread("Root");
                await util.assertRead(room2);
                await util.assertReadThread("Root");
                await util.receiveMessages(room2, [msg.redactionOf("Root")]);

                // When I edit the old root
                await util.receiveMessages(room2, [msg.editOf("Root", "New Root")]);

                // Then the room is still read
                await util.assertRead(room2);
                // as is the thread
                await util.assertReadThread("Root");
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
                await util.assertUnread(room2, 1);
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
                await util.assertUnread(room2, 1);
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

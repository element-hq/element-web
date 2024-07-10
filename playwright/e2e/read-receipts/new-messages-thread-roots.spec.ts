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
                await util.assertUnread(room2, 1); // (Sanity)

                // When I read the main timeline
                await util.goTo(room2);

                // Then room doesn't appear unread but the thread does
                await util.assertRead(room2);
                await util.assertUnreadThread("Msg1");
            });

            test("Reading a thread root within the thread view marks it as read in the main timeline", async ({
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
                await util.assertUnread(room2, 61); // Sanity

                // When I jump to an old message and read the thread
                await msg.jumpTo(room2.name, "beforeThread0000");
                // When the thread is opened, the timeline is scrolled until the thread root reached the center
                await util.openThread("ThreadRoot");

                // Then the thread root is marked as read in the main timeline,
                // 30 remaining messages are unread - 7 messages are displayed under the thread root
                await util.assertUnread(room2, 30 - 7);
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

                // Then the thread is unread
                await util.goTo(room2);
                await util.assertUnreadThread("Reply1");
            });

            test("Reading a thread whose root is a reply makes the thread read", async ({
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
                await util.assertUnread(room2, 2);
                await util.goTo(room2);
                await util.assertRead(room2);
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

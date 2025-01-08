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
                await msg.jumpTo(room2, "beforeThread0000");
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

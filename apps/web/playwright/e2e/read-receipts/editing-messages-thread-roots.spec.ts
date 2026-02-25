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

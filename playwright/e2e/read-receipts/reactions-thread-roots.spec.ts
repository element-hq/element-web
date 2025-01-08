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
    test.describe("reactions", () => {
        test.describe("thread roots", () => {
            test("A reaction to a thread root does not make the room unread", async ({
                page,
                roomAlpha: room1,
                roomBeta: room2,
                util,
                msg,
            }) => {
                // Given a read thread root exists
                await util.goTo(room1);
                await util.assertRead(room2);
                await util.receiveMessages(room2, ["Msg1", msg.threadedOff("Msg1", "Reply1")]);
                await util.assertUnread(room2, 1);
                await util.goTo(room2);
                await util.openThread("Msg1");
                await util.assertRead(room2);
                await util.assertReadThread("Msg1");

                // When someone reacts to it
                await util.goTo(room1);
                await util.receiveMessages(room2, [msg.reactionTo("Msg1", "🪿")]);
                await page.waitForTimeout(200);

                // Then the room is still read
                await util.assertRead(room2);
                // as is the thread
                await util.assertReadThread("Msg1");
            });

            test("Reading a reaction to a thread root leaves the room read", async ({
                page,
                roomAlpha: room1,
                roomBeta: room2,
                util,
                msg,
            }) => {
                // Given a read thread root exists
                await util.goTo(room1);
                await util.assertRead(room2);
                await util.receiveMessages(room2, ["Msg1", msg.threadedOff("Msg1", "Reply1")]);
                await util.assertUnread(room2, 1);
                await util.goTo(room2);
                await util.openThread("Msg1");
                await util.assertRead(room2);

                // And the reaction to it does not make us unread
                await util.goTo(room1);
                await util.receiveMessages(room2, [msg.reactionTo("Msg1", "🪿")]);
                await util.assertRead(room2);
                await util.assertReadThread("Msg1");

                // When we read the reaction and go away again
                await util.goTo(room2);
                await util.openThread("Msg1");
                await util.assertRead(room2);
                await util.goTo(room1);
                await page.waitForTimeout(200);

                // Then the room is still read
                await util.assertRead(room2);
                await util.assertReadThread("Msg1");
            });

            test("Reacting to a thread root after marking as read makes the room unread but not the thread", async ({
                page,
                roomAlpha: room1,
                roomBeta: room2,
                util,
                msg,
            }) => {
                // Given a thread root exists
                await util.goTo(room1);
                await util.assertRead(room2);
                await util.receiveMessages(room2, ["Msg1", msg.threadedOff("Msg1", "Reply1")]);
                await util.assertUnread(room2, 1);

                // And we have marked the room as read
                await util.markAsRead(room2);
                await util.assertRead(room2);
                await util.assertReadThread("Msg1");

                // When someone reacts to it
                await util.receiveMessages(room2, [msg.reactionTo("Msg1", "🪿")]);
                await page.waitForTimeout(200);

                // Then the room is still read
                await util.assertRead(room2);
                // as is the thread
                await util.assertReadThread("Msg1");
            });
        });
    });
});

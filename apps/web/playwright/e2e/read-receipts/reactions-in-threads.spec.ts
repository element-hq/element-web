/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

/* See readme.md for tips on writing these tests. */

import { test, expect } from ".";
import { isDendrite } from "../../plugins/homeserver/dendrite";

test.describe("Read receipts", { tag: "@mergequeue" }, () => {
    test.skip(isDendrite, "due to Dendrite bug https://github.com/element-hq/dendrite/issues/2970");

    test.describe("reactions", () => {
        test.describe("in threads", () => {
            test("A reaction to a threaded message does not make the room unread", async ({
                roomAlpha: room1,
                roomBeta: room2,
                util,
                msg,
            }) => {
                // Given a thread exists and I have read it
                await util.goTo(room1);
                await util.assertRead(room2);
                await util.receiveMessages(room2, ["Msg1", msg.threadedOff("Msg1", "Reply1")]);
                await util.assertUnread(room2, 1);
                await util.goTo(room2);
                await util.openThread("Msg1");
                await util.assertRead(room2);
                await util.assertReadThread("Msg1");
                await util.goTo(room1);

                // When someone reacts to a thread message
                await util.receiveMessages(room2, [msg.reactionTo("Reply1", "🪿")]);

                // Then the room remains read
                await util.assertStillRead(room2);
                await util.assertReadThread("Msg1");
            });

            test("Marking a room as read after a reaction in a thread makes it read", async ({
                roomAlpha: room1,
                roomBeta: room2,
                util,
                msg,
            }) => {
                // Given a thread exists with a reaction
                await util.goTo(room1);
                await util.assertRead(room2);
                await util.receiveMessages(room2, [
                    "Msg1",
                    msg.threadedOff("Msg1", "Reply1"),
                    msg.reactionTo("Reply1", "🪿"),
                ]);
                await util.assertUnread(room2, 1);

                // When I mark the room as read
                await util.markAsRead(room2);

                // Then it becomes read
                await util.assertRead(room2);
            });

            test("Reacting to a thread message after marking as read does not make the room unread", async ({
                roomAlpha: room1,
                roomBeta: room2,
                util,
                msg,
            }) => {
                // Given a thread exists and I have marked it as read
                await util.goTo(room1);
                await util.assertRead(room2);
                await util.receiveMessages(room2, ["Msg1", msg.threadedOff("Msg1", "Reply1")]);
                await util.assertUnread(room2, 1);
                await util.markAsRead(room2);
                await util.assertRead(room2);

                // When someone reacts to a thread message
                await util.receiveMessages(room2, [msg.reactionTo("Reply1", "🪿")]);

                // Then the room remains read
                await util.assertStillRead(room2);
                // as does the thread
                await util.assertReadThread("Msg1");
            });

            test("A room with a reaction to a threaded message is still unread after restart", async ({
                roomAlpha: room1,
                roomBeta: room2,
                util,
                msg,
            }) => {
                // Given a thread exists and I have read it
                await util.goTo(room1);
                await util.assertRead(room2);
                await util.receiveMessages(room2, ["Msg1", msg.threadedOff("Msg1", "Reply1")]);
                await util.assertUnread(room2, 1);
                await util.goTo(room2);
                await util.openThread("Msg1");
                await util.assertRead(room2);
                await util.goTo(room1);

                // And someone reacted to it, which doesn't make it read
                await util.receiveMessages(room2, [msg.reactionTo("Reply1", "🪿")]);
                await util.assertStillRead(room2);
                await util.assertReadThread("Msg1");

                // When I restart
                await util.saveAndReload();

                // Then the room is still read
                await util.assertRead(room2);
                await util.assertReadThread("Msg1");
            });

            test("A room where all reactions in threads are read is still read after restart", async ({
                roomAlpha: room1,
                roomBeta: room2,
                util,
                msg,
            }) => {
                // Given multiple threads with reactions exist and are read
                await util.goTo(room1);
                await util.assertRead(room2);
                await util.receiveMessages(room2, [
                    "Msg1",
                    msg.threadedOff("Msg1", "Reply1a"),
                    msg.reactionTo("Reply1a", "r"),
                    "Msg2",
                    msg.threadedOff("Msg1", "Reply1b"),
                    msg.threadedOff("Msg2", "Reply2a"),
                    msg.reactionTo("Msg1", "e"),
                    msg.threadedOff("Msg2", "Reply2b"),
                    msg.reactionTo("Reply2a", "a"),
                    msg.reactionTo("Reply2b", "c"),
                    msg.reactionTo("Reply1b", "t"),
                ]);
                await util.assertUnread(room2, 2);
                await util.goTo(room2);
                await util.openThread("Msg1");
                await util.assertReadThread("Msg1");
                await util.openThread("Msg2");
                await util.assertReadThread("Msg2");
                await util.assertRead(room2);
                await util.goTo(room1);

                // When I restart
                await util.saveAndReload();

                // Then the room is still read
                await util.assertRead(room2);
                await util.goTo(room2);
                await util.assertReadThread("Msg1");
                await util.assertReadThread("Msg2");
            });

            test("Can remove a reaction in a thread", async ({
                page,
                roomAlpha: room1,
                roomBeta: room2,
                util,
                msg,
            }) => {
                // Note: this is not strictly a read receipt test, but it checks
                // for a bug we caused when we were fixing unreads, so it's
                // included here. The bug is:
                // https://github.com/vector-im/element-web/issues/26498

                // Given a thread exists
                await util.goTo(room1);
                await util.assertRead(room2);
                await util.receiveMessages(room2, ["Msg1", msg.threadedOff("Msg1", "Reply1a")]);
                await util.assertUnread(room2, 1);

                // When I react to a thread message
                await util.goTo(room2);
                await util.openThread("Msg1");
                await page.locator(".mx_ThreadPanel").getByText("Reply1a").hover();
                await page.getByRole("button", { name: "React" }).click();
                await page.locator(".mx_EmojiPicker_body").getByText("😀").click();

                // And cancel the reaction
                await page.locator(".mx_ThreadPanel").getByLabel("Mae reacted with 😀").click();

                // Then it disappears
                await expect(page.locator(".mx_ThreadPanel").getByLabel("Mae reacted with 😀")).not.toBeVisible();

                // And I can do it all again without an error
                await page.locator(".mx_ThreadPanel").getByText("Reply1a").hover();
                await page.getByRole("button", { name: "React" }).click();
                await page.locator(".mx_EmojiPicker_body").getByText("😀").first().click();
                await page.locator(".mx_ThreadPanel").getByLabel("Mae reacted with 😀").click();
                await expect(await page.locator(".mx_ThreadPanel").getByLabel("Mae reacted with 😀")).not.toBeVisible();
            });
        });
    });
});

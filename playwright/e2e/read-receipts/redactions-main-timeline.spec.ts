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
    });
});

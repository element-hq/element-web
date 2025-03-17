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
        test.describe("in the main timeline", () => {
            test("Receiving a reaction to a message does not make a room unread", async ({
                roomAlpha: room1,
                roomBeta: room2,
                util,
                msg,
            }) => {
                await util.goTo(room1);
                await util.assertRead(room2);
                await util.receiveMessages(room2, ["Msg1", "Msg2"]);
                await util.assertUnread(room2, 2);

                // When I read the main timeline
                await util.goTo(room2);
                await util.assertRead(room2);

                await util.goTo(room1);
                await util.receiveMessages(room2, [msg.reactionTo("Msg2", "🪿")]);
                await util.assertRead(room2);
            });
            test("Reacting to a message after marking as read does not make the room unread", async ({
                roomAlpha: room1,
                roomBeta: room2,
                util,
                msg,
            }) => {
                await util.goTo(room1);
                await util.assertRead(room2);
                await util.receiveMessages(room2, ["Msg1", "Msg2"]);
                await util.assertUnread(room2, 2);

                await util.markAsRead(room2);
                await util.assertRead(room2);

                await util.receiveMessages(room2, [msg.reactionTo("Msg2", "🪿")]);
                await util.assertRead(room2);
            });
            test("A room with an unread reaction is still read after restart", async ({
                roomAlpha: room1,
                roomBeta: room2,
                util,
                msg,
            }) => {
                await util.goTo(room1);
                await util.assertRead(room2);
                await util.receiveMessages(room2, ["Msg1", "Msg2"]);
                await util.assertUnread(room2, 2);

                await util.markAsRead(room2);
                await util.assertRead(room2);

                await util.receiveMessages(room2, [msg.reactionTo("Msg2", "🪿")]);
                await util.assertRead(room2);

                await util.saveAndReload();
                await util.assertRead(room2);
            });
            test("A room where all reactions are read is still read after restart", async ({
                roomAlpha: room1,
                roomBeta: room2,
                util,
                msg,
            }) => {
                await util.goTo(room1);
                await util.assertRead(room2);
                await util.receiveMessages(room2, ["Msg1", "Msg2", msg.reactionTo("Msg2", "🪿")]);
                await util.assertUnread(room2, 2);

                await util.markAsRead(room2);
                await util.assertRead(room2);

                await util.saveAndReload();
                await util.assertRead(room2);
            });
        });
    });
});

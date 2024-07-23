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

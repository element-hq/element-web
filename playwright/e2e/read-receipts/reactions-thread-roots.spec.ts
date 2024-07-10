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

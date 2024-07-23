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
    test.describe("editing messages", () => {
        test.describe("in the main timeline", () => {
            test("Editing a message leaves a room read", async ({ roomAlpha: room1, roomBeta: room2, util, msg }) => {
                // Given I am not looking at the room
                await util.goTo(room1);

                await util.receiveMessages(room2, ["Msg1"]);
                await util.assertUnread(room2, 1);
                await util.goTo(room2);
                await util.assertRead(room2);
                await util.goTo(room1);

                // When an edit appears in the room
                await util.receiveMessages(room2, [msg.editOf("Msg1", "Msg1 Edit1")]);

                // Then it remains read
                await util.assertStillRead(room2);
            });
            test("Reading an edit leaves the room read", async ({ roomAlpha: room1, roomBeta: room2, util, msg }) => {
                // Given an edit is making the room unread
                await util.goTo(room1);
                await util.receiveMessages(room2, ["Msg1"]);
                await util.assertUnread(room2, 1);

                await util.goTo(room2);
                await util.assertRead(room2);
                await util.goTo(room1);

                await util.receiveMessages(room2, [msg.editOf("Msg1", "Msg1 Edit1")]);
                await util.assertStillRead(room2);

                // When I read it
                await util.goTo(room2);

                // Then the room stays read
                await util.assertStillRead(room2);
                await util.goTo(room1);
                await util.assertStillRead(room2);
            });
            test("Editing a message after marking as read leaves the room read", async ({
                roomAlpha: room1,
                roomBeta: room2,
                util,
                msg,
            }) => {
                // Given the room is marked as read
                await util.goTo(room1);
                await util.receiveMessages(room2, ["Msg1"]);
                await util.assertUnread(room2, 1);
                await util.markAsRead(room2);
                await util.assertRead(room2);

                // When a message is edited
                await util.receiveMessages(room2, [msg.editOf("Msg1", "Msg1 Edit1")]);

                // Then the room remains read
                await util.assertStillRead(room2);
            });
            test("Editing a reply after reading it makes the room unread", async ({
                roomAlpha: room1,
                roomBeta: room2,
                util,
                msg,
            }) => {
                // Given the room is all read
                await util.goTo(room1);
                await util.receiveMessages(room2, ["Msg1", msg.replyTo("Msg1", "Reply1")]);
                await util.assertUnread(room2, 2);
                await util.goTo(room2);
                await util.assertRead(room2);
                await util.goTo(room1);

                // When a message is edited
                await util.receiveMessages(room2, [msg.editOf("Reply1", "Reply1 Edit1")]);

                // Then it remains read
                await util.assertStillRead(room2);
            });
            test("Editing a reply after marking as read makes the room unread", async ({
                roomAlpha: room1,
                roomBeta: room2,
                util,
                msg,
            }) => {
                // Given a reply is marked as read
                await util.goTo(room1);
                await util.receiveMessages(room2, ["Msg1", msg.replyTo("Msg1", "Reply1")]);
                await util.assertUnread(room2, 2);
                await util.markAsRead(room2);
                await util.assertRead(room2);

                // When the reply is edited
                await util.receiveMessages(room2, [msg.editOf("Reply1", "Reply1 Edit1")]);

                // Then the room remains read
                await util.assertStillRead(room2);
            });
            test("A room with an edit is still read after restart", async ({
                roomAlpha: room1,
                roomBeta: room2,
                util,
                msg,
            }) => {
                // Given a message is marked as read
                await util.goTo(room1);
                await util.receiveMessages(room2, ["Msg1"]);
                await util.assertUnread(room2, 1);
                await util.markAsRead(room2);
                await util.assertRead(room2);

                // When an edit appears in the room
                await util.receiveMessages(room2, [msg.editOf("Msg1", "Msg1 Edit1")]);

                // Then it remains read
                await util.assertStillRead(room2);

                // And remains so after a reload
                await util.saveAndReload();
                await util.assertStillRead(room2);
            });
            test("An edited message becomes read if it happens while I am looking", async ({
                roomAlpha: room1,
                roomBeta: room2,
                util,
                msg,
            }) => {
                // Given a message is marked as read
                await util.goTo(room2);
                await util.receiveMessages(room2, ["Msg1"]);
                await util.assertRead(room2);

                // When I see an edit appear in the room I am looking at
                await util.receiveMessages(room2, [msg.editOf("Msg1", "Msg1 Edit1")]);

                // Then it becomes read
                await util.assertStillRead(room2);
            });
            test("A room where all edits are read is still read after restart", async ({
                roomAlpha: room1,
                roomBeta: room2,
                util,
                msg,
            }) => {
                // Given a message was edited and read
                await util.goTo(room1);
                await util.receiveMessages(room2, ["Msg1", msg.editOf("Msg1", "Msg1 Edit1")]);
                await util.assertUnread(room2, 1);
                await util.goTo(room2);
                await util.assertRead(room2);

                // When I reload
                await util.saveAndReload();

                // Then the room is still read
                await util.assertRead(room2);
            });
        });
    });
});

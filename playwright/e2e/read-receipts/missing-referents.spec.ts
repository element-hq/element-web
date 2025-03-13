/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

/* See readme.md for tips on writing these tests. */

import { test } from ".";

test.describe("Read receipts", { tag: "@mergequeue" }, () => {
    test.describe("messages with missing referents", () => {
        test.fixme(
            "A message in an unknown thread is not visible and the room is read",
            async ({ roomAlpha: room1, roomBeta: room2, util, msg }) => {
                // Given a thread existed and the room is read
                await util.goTo(room1);
                await util.receiveMessages(room2, ["Root1", msg.threadedOff("Root1", "T1a")]);

                // When I restart, forgetting the thread root
                // And I receive a message on that thread
                // Then the message is invisible and the room remains read
            },
        );
        test.fixme("When a message's thread root appears later the thread appears and the room is unread", () => {});
        test.fixme("An edit of an unknown message is not visible and the room is read", () => {});
        test.fixme("When an edit's message appears later the edited version appears and the room is unread", () => {});
        test.fixme("A reaction to an unknown message is not visible and the room is read", () => {});
        test.fixme("When an reactions's message appears later it appears and the room is unread", () => {});
        // Harder: validate that we request the messages we are missing?
    });

    test.describe("receipts with missing events", () => {
        // Later: when we have order in receipts, we can change these tests to
        // make receipts still work, even when their message is not found.
        test.fixme("A receipt for an unknown message does not change the state of an unread room", () => {});
        test.fixme("A receipt for an unknown message does not change the state of a read room", () => {});
        test.fixme("A threaded receipt for an unknown message does not change the state of an unread thread", () => {});
        test.fixme("A threaded receipt for an unknown message does not change the state of a read thread", () => {});
        test.fixme("A threaded receipt for an unknown thread does not change the state of an unread thread", () => {});
        test.fixme("A threaded receipt for an unknown thread does not change the state of a read thread", () => {});
        test.fixme("A threaded receipt for a message on main does not change the state of an unread room", () => {});
        test.fixme("A threaded receipt for a message on main does not change the state of a read room", () => {});
        test.fixme("A main receipt for a message on a thread does not change the state of an unread room", () => {});
        test.fixme("A main receipt for a message on a thread does not change the state of a read room", () => {});
        test.fixme("A threaded receipt for a thread root does not mark it as read", () => {});
        // Harder: validate that we request the messages we are missing?
    });
});

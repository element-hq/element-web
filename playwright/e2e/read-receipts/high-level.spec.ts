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

import { customEvent, many, test } from ".";

test.describe("Read receipts", () => {
    test.describe("Message ordering", () => {
        test.describe("in the main timeline", () => {
            test.fixme(
                "A receipt for the last event in sync order (even with wrong ts) marks a room as read",
                () => {},
            );
            test.fixme(
                "A receipt for a non-last event in sync order (even when ts makes it last) leaves room unread",
                () => {},
            );
        });

        test.describe("in threads", () => {
            // These don't pass yet - we need MSC4033 - we don't even know the Sync order yet
            test.fixme(
                "A receipt for the last event in sync order (even with wrong ts) marks a thread as read",
                () => {},
            );
            test.fixme(
                "A receipt for a non-last event in sync order (even when ts makes it last) leaves thread unread",
                () => {},
            );

            // These pass now and should not later - we should use order from MSC4033 instead of ts
            // These are broken out
            test.fixme(
                "A receipt for last threaded event in ts order (even when it was received non-last) marks a thread as read",
                () => {},
            );
            test.fixme(
                "A receipt for non-last threaded event in ts order (even when it was received last) leaves thread unread",
                () => {},
            );
            test.fixme(
                "A receipt for last threaded edit in ts order (even when it was received non-last) marks a thread as read",
                () => {},
            );
            test.fixme(
                "A receipt for non-last threaded edit in ts order (even when it was received last) leaves thread unread",
                () => {},
            );
            test.fixme(
                "A receipt for last threaded reaction in ts order (even when it was received non-last) marks a thread as read",
                () => {},
            );
            test.fixme(
                "A receipt for non-last threaded reaction in ts order (even when it was received last) leaves thread unread",
                () => {},
            );
        });

        test.describe("thread roots", () => {
            test.fixme(
                "A receipt for last reaction to thread root in sync order (even when ts makes it last) marks room as read",
                () => {},
            );
            test.fixme(
                "A receipt for non-last reaction to thread root in sync order (even when ts makes it last) leaves room unread",
                () => {},
            );
            test.fixme(
                "A receipt for last edit to thread root in sync order (even when ts makes it last) marks room as read",
                () => {},
            );
            test.fixme(
                "A receipt for non-last edit to thread root in sync order (even when ts makes it last) leaves room unread",
                () => {},
            );
        });
    });

    test.describe("Ignored events", () => {
        test("If all events after receipt are unimportant, the room is read", async ({
            roomAlpha: room1,
            roomBeta: room2,
            util,
        }) => {
            await util.goTo(room1);
            await util.assertRead(room2);
            await util.receiveMessages(room2, ["Msg1", "Msg2"]);
            await util.assertUnread(room2, 2);

            await util.markAsRead(room2);
            await util.assertRead(room2);

            await util.receiveMessages(room2, [customEvent("org.custom.event", { body: "foobar" })]);
            await util.assertRead(room2);
        });
        test("Sending an important event after unimportant ones makes the room unread", async ({
            roomAlpha: room1,
            roomBeta: room2,
            util,
        }) => {
            // Given We have read the important messages
            await util.goTo(room1);
            await util.assertRead(room2);
            await util.receiveMessages(room2, ["Msg1", "Msg2"]);
            await util.assertUnread(room2, 2);
            await util.goTo(room2);
            await util.assertRead(room2);
            await util.goTo(room1);

            // When we receive unimportant messages
            await util.receiveMessages(room2, [customEvent("org.custom.event", { body: "foobar" })]);

            // Then the room is still read
            await util.assertStillRead(room2);

            // And when we receive more important ones
            await util.receiveMessages(room2, ["Hello"]);

            // The room is unread again
            await util.assertUnread(room2, 1);
        });
        test("A receipt for the last unimportant event makes the room read, even if all are unimportant", async ({
            roomAlpha: room1,
            roomBeta: room2,
            util,
        }) => {
            // Display room 1
            await util.goTo(room1);

            // The room 2 is read
            await util.assertRead(room2);

            // We received 3 unimportant messages to room2
            await util.receiveMessages(room2, [
                customEvent("org.custom.event", { body: "foobar1" }),
                customEvent("org.custom.event", { body: "foobar2" }),
                customEvent("org.custom.event", { body: "foobar3" }),
            ]);

            // The room 2 is still read
            await util.assertStillRead(room2);
        });
    });

    test.describe("Paging up", () => {
        test("Paging up through old messages after a room is read leaves the room read", async ({
            page,
            roomAlpha: room1,
            roomBeta: room2,
            util,
        }) => {
            // Given lots of messages are in the room, but we have read them
            await util.goTo(room1);
            await util.receiveMessages(room2, many("Msg", 110));
            await util.assertUnread(room2, 110);
            await util.goTo(room2);
            await util.assertRead(room2);
            await util.goTo(room1);

            // When we restart, so only recent messages are loaded
            await util.saveAndReload();
            await util.goTo(room2);
            await util.assertMessageNotLoaded("Msg0010");

            // And we page up, loading in old messages
            await util.pageUp();
            await page.waitForTimeout(200);
            await util.pageUp();
            await page.waitForTimeout(200);
            await util.pageUp();
            await util.assertMessageLoaded("Msg0010");

            // Then the room remains read
            await util.assertStillRead(room2);
        });
        test("Paging up through old messages of an unread room leaves the room unread", async ({
            roomAlpha: room1,
            roomBeta: room2,
            util,
            msg,
        }) => {
            // Given lots of messages are in the room, and they are not read
            await util.goTo(room1);
            await util.receiveMessages(room2, many("x\ny\nz\nMsg", 40)); // newline to spread out messages
            await util.assertUnread(room2, 40);

            // When I jump to a message in the middle and page up
            await msg.jumpTo(room2.name, "x\ny\nz\nMsg0020");
            await util.pageUp();

            // Then the room is still unread
            await util.assertUnreadGreaterThan(room2, 1);
        });
        test("Paging up to find old threads that were previously read leaves the room read", async ({
            roomAlpha: room1,
            roomBeta: room2,
            util,
            msg,
        }) => {
            test.slow();

            // Given lots of messages in threads are all read
            await util.goTo(room1);
            await util.receiveMessages(room2, [
                "Root1",
                "Root2",
                "Root3",
                ...msg.manyThreadedOff("Root1", many("T", 20)),
                ...msg.manyThreadedOff("Root2", many("T", 20)),
                ...msg.manyThreadedOff("Root3", many("T", 20)),
            ]);
            await util.goTo(room2);
            await util.assertRead(room2);
            await util.assertUnreadThread("Root1");
            await util.assertUnreadThread("Root2");
            await util.assertUnreadThread("Root3");
            await util.openThread("Root1");
            await util.assertReadThread("Root1");
            await util.openThread("Root2");
            await util.assertReadThread("Root2");
            await util.openThread("Root3");
            await util.assertReadThread("Root3");

            // When I restart and page up to load old thread roots
            await util.goTo(room1);
            await util.saveAndReload();
            await util.goTo(room2);
            await util.pageUp();

            // Then the room and threads remain read
            await util.assertRead(room2);
            await util.assertReadThread("Root1");
            await util.assertReadThread("Root2");
            await util.assertReadThread("Root3");
        });

        test("Paging up to find old threads that were never read keeps the room unread", async ({
            cryptoBackend,
            roomAlpha: room1,
            roomBeta: room2,
            util,
            msg,
        }) => {
            test.slow();

            // Given lots of messages in threads that are unread
            await util.goTo(room1);
            await util.receiveMessages(room2, [
                "Root1",
                "Root2",
                "Root3",
                ...msg.manyThreadedOff("Root1", many("T", 2)),
                ...msg.manyThreadedOff("Root2", many("T", 2)),
                ...msg.manyThreadedOff("Root3", many("T", 2)),
                ...many("Msg", 100),
            ]);
            await util.goTo(room2);
            await util.assertRead(room2);
            await util.assertUnreadThread("Root1");
            await util.assertUnreadThread("Root2");
            await util.assertUnreadThread("Root3");

            // When I restart
            await util.closeThreadsPanel();
            await util.goTo(room1);
            await util.saveAndReload();

            // Then the room remembers it's read
            // TODO: I (andyb) think this will fall in an encrypted room
            await util.assertRead(room2);

            // And when I page up to load old thread roots
            await util.goTo(room2);
            await util.pageUp();

            // Then the room remains read
            await util.assertRead(room2);
            await util.assertUnreadThread("Root1");
            await util.assertUnreadThread("Root2");
            await util.assertUnreadThread("Root3");
        });

        test("Looking in thread view to find old threads that were never read makes the room unread", async ({
            roomAlpha: room1,
            roomBeta: room2,
            util,
            msg,
        }) => {
            // Given lots of messages in threads that are unread
            await util.goTo(room1);
            await util.receiveMessages(room2, [
                "Root1",
                "Root2",
                "Root3",
                ...msg.manyThreadedOff("Root1", many("T", 2)),
                ...msg.manyThreadedOff("Root2", many("T", 2)),
                ...msg.manyThreadedOff("Root3", many("T", 2)),
                ...many("Msg", 100),
            ]);
            await util.goTo(room2);
            await util.assertRead(room2);
            await util.assertUnreadThread("Root1");
            await util.assertUnreadThread("Root2");
            await util.assertUnreadThread("Root3");

            // When I restart
            await util.closeThreadsPanel();
            await util.goTo(room1);
            await util.saveAndReload();

            // Then the room remembers it's read
            // TODO: I (andyb) think this will fall in an encrypted room
            await util.assertRead(room2);

            // And when I open the threads view
            await util.goTo(room2);
            await util.openThreadList();

            // Then the room remains read
            await util.assertRead(room2);
            await util.assertUnreadThread("Root1");
            await util.assertUnreadThread("Root2");
            await util.assertUnreadThread("Root3");
        });

        test("After marking room as read, paging up to find old threads that were never read leaves the room read", async ({
            cryptoBackend,
            roomAlpha: room1,
            roomBeta: room2,
            util,
            msg,
        }) => {
            test.slow();

            // Given lots of messages in threads that are unread but I marked as read on a main timeline message
            await util.goTo(room1);
            await util.receiveMessages(room2, [
                "Root1",
                "Root2",
                "Root3",
                ...msg.manyThreadedOff("Root1", many("T", 2)),
                ...msg.manyThreadedOff("Root2", many("T", 2)),
                ...msg.manyThreadedOff("Root3", many("T", 2)),
                ...many("Msg", 100),
            ]);
            await util.markAsRead(room2);
            await util.assertRead(room2);

            // When I restart
            await util.saveAndReload();

            // Then the room remembers it's read
            await util.assertRead(room2);

            // And when I page up to load old thread roots
            await util.goTo(room2);
            await util.pageUp();
            await util.pageUp();
            await util.pageUp();

            // Then the room remains read
            await util.assertStillRead(room2);
            await util.assertReadThread("Root1");
            await util.assertReadThread("Root2");
            await util.assertReadThread("Root3");
        });
        test("After marking room as read based on a thread message, opening threads view to find old threads that were never read leaves the room read", async ({
            roomAlpha: room1,
            roomBeta: room2,
            util,
            msg,
        }) => {
            // Given lots of messages in threads that are unread but I marked as read on a thread message
            await util.goTo(room1);
            await util.receiveMessages(room2, [
                "Root1",
                "Root2",
                "Root3",
                ...msg.manyThreadedOff("Root1", many("T1-", 2)),
                ...msg.manyThreadedOff("Root2", many("T2-", 2)),
                ...msg.manyThreadedOff("Root3", many("T3-", 2)),
                ...many("Msg", 100),
                msg.threadedOff("Msg0099", "Thread off 99"),
            ]);
            await util.markAsRead(room2);
            await util.assertRead(room2);

            // When I restart
            await util.saveAndReload();

            // Then the room remembers it's read
            await util.assertRead(room2);

            // And when I page up to load old thread roots
            await util.goTo(room2);
            await util.openThreadList();

            // Then the room remains read
            await util.assertStillRead(room2);
            await util.assertReadThread("Root1");
            await util.assertReadThread("Root2");
            await util.assertReadThread("Root3");
        });
    });

    test.describe("Room list order", () => {
        test("Rooms with unread messages appear at the top of room list if 'unread first' is selected", async ({
            roomAlpha: room1,
            roomBeta: room2,
            util,
            msg,
            page,
        }) => {
            await util.goTo(room2);

            // Display the unread first room
            await util.toggleRoomUnreadOrder();
            await util.receiveMessages(room1, ["Msg1"]);
            await page.reload();

            // Room 1 has an unread message and should be displayed first
            await util.assertRoomListOrder([room1, room2]);
        });

        test("Rooms with unread threads appear at the top of room list if 'unread first' is selected", async ({
            roomAlpha: room1,
            roomBeta: room2,
            util,
            msg,
        }) => {
            await util.goTo(room2);
            await util.receiveMessages(room1, ["Msg1"]);
            await util.markAsRead(room1);
            await util.assertRead(room1);

            // Display the unread first room
            await util.toggleRoomUnreadOrder();
            await util.receiveMessages(room1, [msg.threadedOff("Msg1", "Resp1")]);
            await util.saveAndReload();

            // Room 1 has an unread message and should be displayed first
            await util.assertRoomListOrder([room1, room2]);
        });
    });

    test.describe("Notifications", () => {
        test.describe("in the main timeline", () => {
            test.fixme("A new message that mentions me shows a notification", () => {});
            test.fixme(
                "Reading a notifying message reduces the notification count in the room list, space and tab",
                () => {},
            );
            test.fixme(
                "Reading the last notifying message removes the notification marker from room list, space and tab",
                () => {},
            );
            test.fixme("Editing a message to mentions me shows a notification", () => {});
            test.fixme("Reading the last notifying edited message removes the notification marker", () => {});
            test.fixme("Redacting a notifying message removes the notification marker", () => {});
        });

        test.describe("in threads", () => {
            test.fixme("A new threaded message that mentions me shows a notification", () => {});
            test.fixme("Reading a notifying threaded message removes the notification count", () => {});
            test.fixme(
                "Notification count remains steady when reading threads that contain seen notifications",
                () => {},
            );
            test.fixme(
                "Notification count remains steady when paging up thread view even when threads contain seen notifications",
                () => {},
            );
            test.fixme(
                "Notification count remains steady when paging up thread view after mark as unread even if older threads contain notifications",
                () => {},
            );
            test.fixme("Redacting a notifying threaded message removes the notification marker", () => {});
        });
    });
});

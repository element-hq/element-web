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

/// <reference types="cypress" />

import { HomeserverInstance } from "../../plugins/utils/homeserver";
import {
    assertMessageLoaded,
    assertMessageNotLoaded,
    assertRead,
    assertReadThread,
    assertStillRead,
    assertUnread,
    assertUnreadGreaterThan,
    assertUnreadThread,
    closeThreadsPanel,
    customEvent,
    goTo,
    many,
    markAsRead,
    Message,
    MessageContentSpec,
    MessageFinder,
    openThread,
    openThreadList,
    pageUp,
    ReadReceiptSetup,
    saveAndReload,
    sendMessageAsClient,
} from "./read-receipts-utils";
import { skipIfRustCrypto } from "../../support/util";

describe("Read receipts", () => {
    const roomAlpha = "Room Alpha";
    const roomBeta = "Room Beta";

    let homeserver: HomeserverInstance;
    let messageFinder: MessageFinder;
    let testSetup: ReadReceiptSetup;

    function threadedOff(rootMessage: string, newMessage: string): MessageContentSpec {
        return messageFinder.threadedOff(rootMessage, newMessage);
    }

    function manyThreadedOff(rootMessage: string, newMessages: Array<string>): Array<MessageContentSpec> {
        return messageFinder.manyThreadedOff(rootMessage, newMessages);
    }

    function jumpTo(room: string, message: string, includeThreads = false) {
        return messageFinder.jumpTo(room, message, includeThreads);
    }

    before(() => {
        // Note: unusually for the Cypress tests in this repo, we share a single
        // Synapse between all the tests in this file.
        //
        // Stopping and starting Synapse costs about 0.25 seconds per test, so
        // for most suites this is worth the cost for the extra assurance that
        // each test is independent.
        //
        // Because there are so many tests in this file, and because sharing a
        // Synapse should have no effect (because we create new rooms and users
        // for each test), we share it here, saving ~30 seconds per run at time
        // of writing.

        cy.startHomeserver("default").then((data) => {
            homeserver = data;
        });
    });

    beforeEach(() => {
        messageFinder = new MessageFinder();
        testSetup = new ReadReceiptSetup(homeserver, "Mae", "Other User", roomAlpha, roomBeta);
    });

    after(() => {
        cy.stopHomeserver(homeserver);
    });

    /**
     * Sends messages into given room as a bot
     * @param room - the name of the room to send messages into
     * @param messages - the list of messages to send, these can be strings or implementations of MessageSpec like `editOf`
     */
    function receiveMessages(room: string, messages: Message[]) {
        sendMessageAsClient(testSetup.bot, room, messages);
    }

    const room1 = roomAlpha;
    const room2 = roomBeta;

    describe("Message ordering", () => {
        describe("in the main timeline", () => {
            it.skip("A receipt for the last event in sync order (even with wrong ts) marks a room as read", () => {});
            it.skip("A receipt for a non-last event in sync order (even when ts makes it last) leaves room unread", () => {});
        });

        describe("in threads", () => {
            // These don't pass yet - we need MSC4033 - we don't even know the Sync order yet
            it.skip("A receipt for the last event in sync order (even with wrong ts) marks a thread as read", () => {});
            it.skip("A receipt for a non-last event in sync order (even when ts makes it last) leaves thread unread", () => {});

            // These pass now and should not later - we should use order from MSC4033 instead of ts
            // These are broken out
            it.skip("A receipt for last threaded event in ts order (even when it was received non-last) marks a thread as read", () => {});
            it.skip("A receipt for non-last threaded event in ts order (even when it was received last) leaves thread unread", () => {});
            it.skip("A receipt for last threaded edit in ts order (even when it was received non-last) marks a thread as read", () => {});
            it.skip("A receipt for non-last threaded edit in ts order (even when it was received last) leaves thread unread", () => {});
            it.skip("A receipt for last threaded reaction in ts order (even when it was received non-last) marks a thread as read", () => {});
            it.skip("A receipt for non-last threaded reaction in ts order (even when it was received last) leaves thread unread", () => {});
        });

        describe("thread roots", () => {
            it.skip("A receipt for last reaction to thread root in sync order (even when ts makes it last) marks room as read", () => {});
            it.skip("A receipt for non-last reaction to thread root in sync order (even when ts makes it last) leaves room unread", () => {});
            it.skip("A receipt for last edit to thread root in sync order (even when ts makes it last) marks room as read", () => {});
            it.skip("A receipt for non-last edit to thread root in sync order (even when ts makes it last) leaves room unread", () => {});
        });
    });

    describe("Ignored events", () => {
        it("If all events after receipt are unimportant, the room is read", () => {
            goTo(room1);
            assertRead(room2);
            receiveMessages(room2, ["Msg1", "Msg2"]);
            assertUnread(room2, 2);

            markAsRead(room2);
            assertRead(room2);

            receiveMessages(room2, [customEvent("org.custom.event", { body: "foobar" })]);
            assertRead(room2);
        });
        it("Sending an important event after unimportant ones makes the room unread", () => {
            // Given We have read the important messages
            goTo(room1);
            assertRead(room2);
            receiveMessages(room2, ["Msg1", "Msg2"]);
            assertUnread(room2, 2);
            goTo(room2);
            assertRead(room2);
            goTo(room1);

            // When we receive unimportant messages
            receiveMessages(room2, [customEvent("org.custom.event", { body: "foobar" })]);

            // Then the room is still read
            assertStillRead(room2);

            // And when we receive more important ones
            receiveMessages(room2, ["Hello"]);

            // The room is unread again
            assertUnread(room2, 1);
        });
        it("A receipt for the last unimportant event makes the room read, even if all are unimportant", () => {
            // Display room 1
            goTo(room1);

            // The room 2 is read
            assertRead(room2);

            // We received 3 unimportant messages to room2
            receiveMessages(room2, [
                customEvent("org.custom.event", { body: "foobar1" }),
                customEvent("org.custom.event", { body: "foobar2" }),
                customEvent("org.custom.event", { body: "foobar3" }),
            ]);

            // The room 2 is still read
            assertStillRead(room2);
        });
    });

    describe("Paging up", () => {
        // Flaky test https://github.com/vector-im/element-web/issues/26437
        it.skip("Paging up through old messages after a room is read leaves the room read", () => {
            // Given lots of messages are in the room, but we have read them
            goTo(room1);
            receiveMessages(room2, many("Msg", 110));
            assertUnread(room2, 110);
            goTo(room2);
            assertRead(room2);
            goTo(room1);

            // When we restart, so only recent messages are loaded
            saveAndReload();
            goTo(room2);
            assertMessageNotLoaded("Msg0010");

            // And we page up, loading in old messages
            pageUp();
            cy.wait(200);
            pageUp();
            cy.wait(200);
            pageUp();
            assertMessageLoaded("Msg0010");

            // Then the room remains read
            assertStillRead(room2);
        });
        it("Paging up through old messages of an unread room leaves the room unread", () => {
            // Given lots of messages are in the room, and they are not read
            goTo(room1);
            receiveMessages(room2, many("x\ny\nz\nMsg", 40)); // newline to spread out messages
            assertUnread(room2, 40);

            // When I jump to a message in the middle and page up
            jumpTo(room2, "x\ny\nz\nMsg0020");
            pageUp();

            // Then the room is still unread
            assertUnreadGreaterThan(room2, 1);
        });
        it("Paging up to find old threads that were previously read leaves the room read", () => {
            // Given lots of messages in threads are all read
            goTo(room1);
            receiveMessages(room2, [
                "Root1",
                "Root2",
                "Root3",
                ...manyThreadedOff("Root1", many("T", 20)),
                ...manyThreadedOff("Root2", many("T", 20)),
                ...manyThreadedOff("Root3", many("T", 20)),
            ]);
            goTo(room2);
            assertUnread(room2, 60);
            openThread("Root1");
            assertUnread(room2, 40);
            assertReadThread("Root1");
            openThread("Root2");
            assertUnread(room2, 20);
            assertReadThread("Root2");
            openThread("Root3");
            assertRead(room2);
            assertReadThread("Root3");

            // When I restart and page up to load old thread roots
            goTo(room1);
            saveAndReload();
            goTo(room2);
            pageUp();

            // Then the room and threads remain read
            assertRead(room2);
            assertReadThread("Root1");
            assertReadThread("Root2");
            assertReadThread("Root3");
        });
        it("Paging up to find old threads that were never read keeps the room unread", () => {
            // Flaky with rust crypto
            // See https://github.com/vector-im/element-web/issues/26539
            skipIfRustCrypto();

            // Given lots of messages in threads that are unread
            goTo(room1);
            receiveMessages(room2, [
                "Root1",
                "Root2",
                "Root3",
                ...manyThreadedOff("Root1", many("T", 2)),
                ...manyThreadedOff("Root2", many("T", 2)),
                ...manyThreadedOff("Root3", many("T", 2)),
                ...many("Msg", 100),
            ]);
            goTo(room2);
            assertUnread(room2, 6);
            assertUnreadThread("Root1");
            assertUnreadThread("Root2");
            assertUnreadThread("Root3");

            // When I restart
            closeThreadsPanel();
            goTo(room1);
            saveAndReload();

            // Then the room remembers it's unread
            // TODO: I (andyb) think this will fall in an encrypted room
            assertUnread(room2, 6);

            // And when I page up to load old thread roots
            goTo(room2);
            pageUp();

            // Then the room remains unread
            assertUnread(room2, 6);
            assertUnreadThread("Root1");
            assertUnreadThread("Root2");
            assertUnreadThread("Root3");
        });
        it("Looking in thread view to find old threads that were never read makes the room unread", () => {
            // Given lots of messages in threads that are unread
            goTo(room1);
            receiveMessages(room2, [
                "Root1",
                "Root2",
                "Root3",
                ...manyThreadedOff("Root1", many("T", 2)),
                ...manyThreadedOff("Root2", many("T", 2)),
                ...manyThreadedOff("Root3", many("T", 2)),
                ...many("Msg", 100),
            ]);
            goTo(room2);
            assertUnread(room2, 6);
            assertUnreadThread("Root1");
            assertUnreadThread("Root2");
            assertUnreadThread("Root3");

            // When I restart
            closeThreadsPanel();
            goTo(room1);
            saveAndReload();

            // Then the room remembers it's unread
            // TODO: I (andyb) think this will fall in an encrypted room
            assertUnread(room2, 6);

            // And when I open the threads view
            goTo(room2);
            openThreadList();

            // Then the room remains unread
            assertUnread(room2, 6);
            assertUnreadThread("Root1");
            assertUnreadThread("Root2");
            assertUnreadThread("Root3");
        });
        it("After marking room as read, paging up to find old threads that were never read leaves the room read", () => {
            // Flaky with rust crypto
            // See https://github.com/vector-im/element-web/issues/26341
            skipIfRustCrypto();

            // Given lots of messages in threads that are unread but I marked as read on a main timeline message
            goTo(room1);
            receiveMessages(room2, [
                "Root1",
                "Root2",
                "Root3",
                ...manyThreadedOff("Root1", many("T", 2)),
                ...manyThreadedOff("Root2", many("T", 2)),
                ...manyThreadedOff("Root3", many("T", 2)),
                ...many("Msg", 100),
            ]);
            markAsRead(room2);
            assertRead(room2);

            // When I restart
            saveAndReload();

            // Then the room remembers it's read
            assertRead(room2);

            // And when I page up to load old thread roots
            goTo(room2);
            pageUp();
            pageUp();
            pageUp();

            // Then the room remains read
            assertStillRead(room2);
            assertReadThread("Root1");
            assertReadThread("Root2");
            assertReadThread("Root3");
        });
        // XXX: fails because we see a dot instead of an unread number - probably the server and client disagree
        it.skip("After marking room as read based on a thread message, opening threads view to find old threads that were never read leaves the room read", () => {
            // Given lots of messages in threads that are unread but I marked as read on a thread message
            goTo(room1);
            receiveMessages(room2, [
                "Root1",
                "Root2",
                "Root3",
                ...manyThreadedOff("Root1", many("T1-", 2)),
                ...manyThreadedOff("Root2", many("T2-", 2)),
                ...manyThreadedOff("Root3", many("T3-", 2)),
                ...many("Msg", 100),
                threadedOff("Msg0099", "Thread off 99"),
            ]);
            markAsRead(room2);
            assertRead(room2);

            // When I restart
            saveAndReload();

            // Then the room remembers it's read
            assertRead(room2);

            // And when I page up to load old thread roots
            goTo(room2);
            openThreadList();

            // Then the room remains read
            assertStillRead(room2);
            assertReadThread("Root1");
            assertReadThread("Root2");
            assertReadThread("Root3");
        });
    });

    describe("Room list order", () => {
        it.skip("Rooms with unread threads appear at the top of room list if 'unread first' is selected", () => {});
    });

    describe("Notifications", () => {
        describe("in the main timeline", () => {
            it.skip("A new message that mentions me shows a notification", () => {});
            it.skip("Reading a notifying message reduces the notification count in the room list, space and tab", () => {});
            it.skip("Reading the last notifying message removes the notification marker from room list, space and tab", () => {});
            it.skip("Editing a message to mentions me shows a notification", () => {});
            it.skip("Reading the last notifying edited message removes the notification marker", () => {});
            it.skip("Redacting a notifying message removes the notification marker", () => {});
        });

        describe("in threads", () => {
            it.skip("A new threaded message that mentions me shows a notification", () => {});
            it.skip("Reading a notifying threaded message removes the notification count", () => {});
            it.skip("Notification count remains steady when reading threads that contain seen notifications", () => {});
            it.skip("Notification count remains steady when paging up thread view even when threads contain seen notifications", () => {});
            it.skip("Notification count remains steady when paging up thread view after mark as unread even if older threads contain notifications", () => {});
            it.skip("Redacting a notifying threaded message removes the notification marker", () => {});
        });
    });
});

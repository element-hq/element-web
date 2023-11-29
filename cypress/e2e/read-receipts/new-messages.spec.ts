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
    assertRead,
    assertReadThread,
    assertUnread,
    assertUnreadLessThan,
    assertUnreadThread,
    backToThreadsList,
    ReadReceiptSetup,
    goTo,
    many,
    markAsRead,
    Message,
    MessageContentSpec,
    MessageFinder,
    openThread,
    saveAndReload,
    sendMessageAsClient,
} from "./read-receipts-utils";

describe("Read receipts", () => {
    const roomAlpha = "Room Alpha";
    const roomBeta = "Room Beta";

    let homeserver: HomeserverInstance;
    let messageFinder: MessageFinder;
    let testSetup: ReadReceiptSetup;

    function replyTo(targetMessage: string, newMessage: string): MessageContentSpec {
        return messageFinder.replyTo(targetMessage, newMessage);
    }

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

    /**
     * Sends messages into given room as the currently logged-in user
     * @param room - the name of the room to send messages into
     * @param messages - the list of messages to send, these can be strings or implementations of MessageSpec like `editOf`
     */
    function sendMessages(room: string, messages: Message[]) {
        cy.getClient().then((cli) => sendMessageAsClient(cli, room, messages));
    }

    const room1 = roomAlpha;
    const room2 = roomBeta;

    describe("new messages", () => {
        describe("in the main timeline", () => {
            it("Receiving a message makes a room unread", () => {
                // Given I am in a different room
                goTo(room1);
                assertRead(room2);

                // When I receive some messages
                receiveMessages(room2, ["Msg1"]);

                // Then the room is marked as unread
                assertUnread(room2, 1);
            });
            it("Reading latest message makes the room read", () => {
                // Given I have some unread messages
                goTo(room1);
                assertRead(room2);
                receiveMessages(room2, ["Msg1"]);
                assertUnread(room2, 1);

                // When I read the main timeline
                goTo(room2);

                // Then the room becomes read
                assertRead(room2);
            });
            // XXX: fails (sometimes!) because the unread count stays high
            it.skip("Reading an older message leaves the room unread", () => {
                // Given there are lots of messages in a room
                goTo(room1);
                receiveMessages(room2, many("Msg", 30));
                assertUnread(room2, 30);

                // When I jump to one of the older messages
                jumpTo(room2, "Msg0001");

                // Then the room is still unread, but some messages were read
                assertUnreadLessThan(room2, 30);
            });
            it("Marking a room as read makes it read", () => {
                // Given I have some unread messages
                goTo(room1);
                assertRead(room2);
                receiveMessages(room2, ["Msg1"]);
                assertUnread(room2, 1);

                // When I mark the room as read
                markAsRead(room2);

                // Then it is read
                assertRead(room2);
            });
            it("Receiving a new message after marking as read makes it unread", () => {
                // Given I have marked my messages as read
                goTo(room1);
                assertRead(room2);
                receiveMessages(room2, ["Msg1"]);
                assertUnread(room2, 1);
                markAsRead(room2);
                assertRead(room2);

                // When I receive a new message
                receiveMessages(room2, ["Msg2"]);

                // Then the room is unread
                assertUnread(room2, 1);
            });
            it("A room with a new message is still unread after restart", () => {
                // Given I have an unread message
                goTo(room1);
                assertRead(room2);
                receiveMessages(room2, ["Msg1"]);
                assertUnread(room2, 1);

                // When I restart
                saveAndReload();

                // Then I still have an unread message
                assertUnread(room2, 1);
            });
            it("A room where all messages are read is still read after restart", () => {
                // Given I have read all messages
                goTo(room1);
                assertRead(room2);
                receiveMessages(room2, ["Msg1"]);
                assertUnread(room2, 1);
                goTo(room2);
                assertRead(room2);

                // When I restart
                saveAndReload();

                // Then all messages are still read
                assertRead(room2);
            });
            it("A room that was marked as read is still read after restart", () => {
                // Given I have marked all messages as read
                goTo(room1);
                assertRead(room2);
                receiveMessages(room2, ["Msg1"]);
                assertUnread(room2, 1);
                markAsRead(room2);
                assertRead(room2);

                // When I restart
                saveAndReload();

                // Then all messages are still read
                assertRead(room2);
            });
            // XXX: fails because the room remains unread even though I sent a message
            // Note: this test should not re-use the same MatrixClient - it
            // should create a new one logged in as the same user.
            it.skip("Me sending a message from a different client marks room as read", () => {
                // Given I have unread messages
                goTo(room1);
                assertRead(room2);
                receiveMessages(room2, ["Msg1"]);
                assertUnread(room2, 1);

                // When I send a new message from a different client
                sendMessages(room2, ["Msg2"]);

                // Then this room is marked as read
                assertRead(room2);
            });
        });

        describe("in threads", () => {
            it("Receiving a message makes a room unread", () => {
                // Given a message arrived and is read
                goTo(room1);
                receiveMessages(room2, ["Msg1"]);
                assertUnread(room2, 1);
                goTo(room2);
                assertRead(room2);
                goTo(room1);

                // When I receive a threaded message
                receiveMessages(room2, [threadedOff("Msg1", "Resp1")]);

                // Then the room becomes unread
                assertUnread(room2, 1);
            });
            it("Reading the last threaded message makes the room read", () => {
                // Given a thread exists and is not read
                goTo(room1);
                receiveMessages(room2, ["Msg1", threadedOff("Msg1", "Resp1")]);
                assertUnread(room2, 2);
                goTo(room2);

                // When I read it
                openThread("Msg1");

                // The room becomes read
                assertRead(room2);
            });
            it("Reading a thread message makes the thread read", () => {
                // Given a thread exists
                goTo(room1);
                receiveMessages(room2, ["Msg1", threadedOff("Msg1", "Resp1"), threadedOff("Msg1", "Resp2")]);
                assertUnread(room2, 3); // (Sanity)

                // When I read the main timeline
                goTo(room2);

                // Then room does appear unread
                assertUnread(room2, 2);

                // Until we open the thread
                openThread("Msg1");
                assertReadThread("Msg1");
                assertRead(room2);
            });
            it("Reading an older thread message leaves the thread unread", () => {
                // Given there are many messages in a thread
                goTo(room1);
                receiveMessages(room2, ["ThreadRoot", ...manyThreadedOff("ThreadRoot", many("InThread", 20))]);
                assertUnread(room2, 21);

                // When I read an older message in the thread
                jumpTo(room2, "InThread0001", true);
                assertUnreadLessThan(room2, 21);
                // TODO: for some reason, we can't find the first message
                // "InThread0", so I am using the second here. Also, they appear
                // out of order, with "InThread2" before "InThread1". Might be a
                // clue to the sporadic reports we have had of messages going
                // missing in threads?

                // Then the thread is still marked as unread
                backToThreadsList();
                assertUnreadThread("ThreadRoot");
            });
            it("Reading only one thread's message does not make the room read", () => {
                // Given two threads are unread
                goTo(room1);
                receiveMessages(room2, ["Msg1", threadedOff("Msg1", "Resp1"), "Msg2", threadedOff("Msg2", "Resp2")]);
                assertUnread(room2, 4);
                goTo(room2);
                assertUnread(room2, 2);

                // When I only read one of them
                openThread("Msg1");

                // The room is still unread
                assertUnread(room2, 1);
            });
            it("Reading only one thread's message makes that thread read but not others", () => {
                // Given I have unread threads
                goTo(room1);
                receiveMessages(room2, ["Msg1", "Msg2", threadedOff("Msg1", "Resp1"), threadedOff("Msg2", "Resp2")]);
                assertUnread(room2, 4); // (Sanity)
                goTo(room2);
                assertUnread(room2, 2);
                assertUnreadThread("Msg1");
                assertUnreadThread("Msg2");

                // When I read one of them
                openThread("Msg1");

                // Then that one is read, but the other is not
                assertReadThread("Msg1");
                assertUnreadThread("Msg2");
            });
            it("Reading the main timeline does not mark a thread message as read", () => {
                // Given a thread exists
                goTo(room1);
                receiveMessages(room2, ["Msg1", threadedOff("Msg1", "Resp1"), threadedOff("Msg1", "Resp2")]);
                assertUnread(room2, 3); // (Sanity)

                // When I read the main timeline
                goTo(room2);
                assertUnread(room2, 2);

                // Then thread does appear unread
                assertUnreadThread("Msg1");
            });
            it("Marking a room with unread threads as read makes it read", () => {
                // Given I have an unread thread
                goTo(room1);
                receiveMessages(room2, ["Msg1", threadedOff("Msg1", "Resp1"), threadedOff("Msg1", "Resp2")]);
                assertUnread(room2, 3); // (Sanity)

                // When I mark the room as read
                markAsRead(room2);

                // Then the room is read
                assertRead(room2);
            });
            it("Sending a new thread message after marking as read makes it unread", () => {
                // Given a thread exists
                goTo(room1);
                receiveMessages(room2, ["Msg1", threadedOff("Msg1", "Resp1"), threadedOff("Msg1", "Resp2")]);

                // When I mark the room as read
                markAsRead(room2);
                assertRead(room2);

                // Then another message appears in the thread
                receiveMessages(room2, [threadedOff("Msg1", "Resp3")]);

                // Then the room becomes unread
                assertUnread(room2, 1);
            });
            it("Sending a new different-thread message after marking as read makes it unread", () => {
                // Given 2 threads exist, and Thread2 has the latest message in it
                goTo(room1);
                receiveMessages(room2, ["Thread1", "Thread2", threadedOff("Thread1", "t1a")]);
                assertUnread(room2, 3);
                receiveMessages(room2, [threadedOff("Thread2", "t2a")]);

                // When I mark the room as read (making an unthreaded receipt for t2a)
                markAsRead(room2);
                assertRead(room2);

                // Then another message appears in the other thread
                receiveMessages(room2, [threadedOff("Thread1", "t1b")]);

                // Then the room becomes unread
                assertUnread(room2, 1);
            });
            it("A room with a new threaded message is still unread after restart", () => {
                // Given a thread exists
                goTo(room1);
                receiveMessages(room2, ["Msg1", threadedOff("Msg1", "Resp1"), threadedOff("Msg1", "Resp2")]);
                assertUnread(room2, 3); // (Sanity)

                // When I read the main timeline
                goTo(room2);

                // Then room does appear unread
                assertUnread(room2, 2);

                saveAndReload();
                assertUnread(room2, 2);

                // Until we open the thread
                openThread("Msg1");
                assertRead(room2);
            });
            it("A room where all threaded messages are read is still read after restart", () => {
                // Given I have read all the threads
                goTo(room1);
                receiveMessages(room2, ["Msg1", threadedOff("Msg1", "Resp1"), threadedOff("Msg1", "Resp2")]);
                assertUnread(room2, 3); // (Sanity)
                goTo(room2);
                assertUnread(room2, 2);
                openThread("Msg1");
                assertRead(room2);

                // When I restart
                saveAndReload();

                // Then the room is still read
                assertRead(room2);
            });
        });

        describe("thread roots", () => {
            it("Reading a thread root does not mark the thread as read", () => {
                // Given a thread exists
                goTo(room1);
                receiveMessages(room2, ["Msg1", threadedOff("Msg1", "Resp1")]);
                assertUnread(room2, 2); // (Sanity)

                // When I read the main timeline
                goTo(room2);

                // Then room does appear unread
                assertUnread(room2, 1);
                assertUnreadThread("Msg1");
            });
            // XXX: fails because we jump to the wrong place in the timeline
            it.skip("Reading a thread root within the thread view marks it as read in the main timeline", () => {
                // Given lots of messages are on the main timeline, and one has a thread off it
                goTo(room1);
                receiveMessages(room2, [
                    ...many("beforeThread", 30),
                    "ThreadRoot",
                    threadedOff("ThreadRoot", "InThread"),
                    ...many("afterThread", 30),
                ]);
                assertUnread(room2, 62); // Sanity

                // When I jump to an old message and read the thread
                jumpTo(room2, "beforeThread0000");
                openThread("ThreadRoot");

                // Then the thread root is marked as read in the main timeline,
                // so there are only 30 left - the ones after the thread root.
                assertUnread(room2, 30);
            });
            it("Creating a new thread based on a reply makes the room unread", () => {
                // Given a message and reply exist and are read
                goTo(room1);
                receiveMessages(room2, ["Msg1", replyTo("Msg1", "Reply1")]);
                goTo(room2);
                assertRead(room2);
                goTo(room1);
                assertRead(room2);

                // When I receive a thread message created on the reply
                receiveMessages(room2, [threadedOff("Reply1", "Resp1")]);

                // Then the room is unread
                assertUnread(room2, 1);
            });
            it("Reading a thread whose root is a reply makes the room read", () => {
                // Given an unread thread off a reply exists
                goTo(room1);
                receiveMessages(room2, ["Msg1", replyTo("Msg1", "Reply1"), threadedOff("Reply1", "Resp1")]);
                assertUnread(room2, 3);
                goTo(room2);
                assertUnread(room2, 1);
                assertUnreadThread("Reply1");

                // When I read the thread
                openThread("Reply1");

                // Then the room and thread are read
                assertRead(room2);
                assertReadThread("Reply1");
            });
        });
    });
});

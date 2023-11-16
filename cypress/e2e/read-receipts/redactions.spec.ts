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
    assertStillRead,
    assertUnread,
    assertUnreadLessThan,
    assertUnreadThread,
    BotActionSpec,
    closeThreadsPanel,
    goTo,
    markAsRead,
    Message,
    MessageContentSpec,
    MessageFinder,
    openThread,
    ReadReceiptSetup,
    saveAndReload,
    sendMessageAsClient,
} from "./read-receipts-utils";

describe("Read receipts", () => {
    const roomAlpha = "Room Alpha";
    const roomBeta = "Room Beta";

    let homeserver: HomeserverInstance;
    let messageFinder: MessageFinder;
    let testSetup: ReadReceiptSetup;

    function editOf(originalMessage: string, newMessage: string): MessageContentSpec {
        return messageFinder.editOf(originalMessage, newMessage);
    }

    function replyTo(targetMessage: string, newMessage: string): MessageContentSpec {
        return messageFinder.replyTo(targetMessage, newMessage);
    }

    function threadedOff(rootMessage: string, newMessage: string): MessageContentSpec {
        return messageFinder.threadedOff(rootMessage, newMessage);
    }

    function reactionTo(targetMessage: string, reaction: string): BotActionSpec {
        return messageFinder.reactionTo(targetMessage, reaction);
    }

    function redactionOf(targetMessage: string): BotActionSpec {
        return messageFinder.redactionOf(targetMessage);
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

    describe("redactions", () => {
        describe("in the main timeline", () => {
            it("Redacting the message pointed to by my receipt leaves the room read", () => {
                // Given I have read the messages in a room
                goTo(room1);
                receiveMessages(room2, ["Msg1", "Msg2"]);
                assertUnread(room2, 2);
                goTo(room2);
                assertRead(room2);
                goTo(room1);

                // When the latest message is redacted
                receiveMessages(room2, [redactionOf("Msg2")]);

                // Then the room remains read
                assertStillRead(room2);
            });

            it("Reading an unread room after a redaction of the latest message makes it read", () => {
                // Given an unread room
                goTo(room1);
                receiveMessages(room2, ["Msg1", "Msg2"]);
                assertUnread(room2, 2);

                // And the latest message has been redacted
                receiveMessages(room2, [redactionOf("Msg2")]);

                // When I read the room
                goTo(room2);
                assertRead(room2);
                goTo(room1);

                // Then it becomes read
                assertStillRead(room2);
            });
            it("Reading an unread room after a redaction of an older message makes it read", () => {
                // Given an unread room with an earlier redaction
                goTo(room1);
                receiveMessages(room2, ["Msg1", "Msg2"]);
                assertUnread(room2, 2);
                receiveMessages(room2, [redactionOf("Msg1")]);

                // When I read the room
                goTo(room2);
                assertRead(room2);
                goTo(room1);

                // Then it becomes read
                assertStillRead(room2);
            });
            it("Marking an unread room as read after a redaction makes it read", () => {
                // Given an unread room where latest message is redacted
                goTo(room1);
                receiveMessages(room2, ["Msg1", "Msg2"]);
                assertUnread(room2, 2);
                receiveMessages(room2, [redactionOf("Msg2")]);
                assertUnread(room2, 1);

                // When I mark it as read
                markAsRead(room2);

                // Then it becomes read
                assertRead(room2);
            });
            it("Sending and redacting a message after marking the room as read makes it read", () => {
                // Given a room that is marked as read
                goTo(room1);
                receiveMessages(room2, ["Msg1", "Msg2"]);
                assertUnread(room2, 2);
                markAsRead(room2);
                assertRead(room2);

                // When a message is sent and then redacted
                receiveMessages(room2, ["Msg3"]);
                assertUnread(room2, 1);
                receiveMessages(room2, [redactionOf("Msg3")]);

                // Then the room is read
                assertRead(room2);
            });
            it("Redacting a message after marking the room as read leaves it read", () => {
                // Given a room that is marked as read
                goTo(room1);
                receiveMessages(room2, ["Msg1", "Msg2", "Msg3"]);
                assertUnread(room2, 3);
                markAsRead(room2);
                assertRead(room2);

                // When we redact some messages
                receiveMessages(room2, [redactionOf("Msg3")]);
                receiveMessages(room2, [redactionOf("Msg1")]);

                // Then it is still read
                assertStillRead(room2);
            });
            it("Redacting one of the unread messages reduces the unread count", () => {
                // Given an unread room
                goTo(room1);
                receiveMessages(room2, ["Msg1", "Msg2", "Msg3"]);
                assertUnread(room2, 3);

                // When I redact a non-latest message
                receiveMessages(room2, [redactionOf("Msg2")]);

                // Then the unread count goes down
                assertUnread(room2, 2);

                // And when I redact the latest message
                receiveMessages(room2, [redactionOf("Msg3")]);

                // Then the unread count goes down again
                assertUnread(room2, 1);
            });
            it("Redacting one of the unread messages reduces the unread count after restart", () => {
                // Given unread count was reduced by redacting messages
                goTo(room1);
                receiveMessages(room2, ["Msg1", "Msg2", "Msg3"]);
                assertUnread(room2, 3);
                receiveMessages(room2, [redactionOf("Msg2")]);
                assertUnread(room2, 2);
                receiveMessages(room2, [redactionOf("Msg3")]);
                assertUnread(room2, 1);

                // When I restart
                saveAndReload();

                // Then the unread count is still reduced
                assertUnread(room2, 1);
            });
            it("Redacting all unread messages makes the room read", () => {
                // Given an unread room
                goTo(room1);
                receiveMessages(room2, ["Msg1", "Msg2"]);
                assertUnread(room2, 2);

                // When I redact all the unread messages
                receiveMessages(room2, [redactionOf("Msg2")]);
                receiveMessages(room2, [redactionOf("Msg1")]);

                // Then the room is back to being read
                assertRead(room2);
            });
            // XXX: fails because it flakes saying the room is unread when it should be read
            it.skip("Redacting all unread messages makes the room read after restart", () => {
                // Given all unread messages were redacted
                goTo(room1);
                receiveMessages(room2, ["Msg1", "Msg2"]);
                assertUnread(room2, 2);
                receiveMessages(room2, [redactionOf("Msg2")]);
                receiveMessages(room2, [redactionOf("Msg1")]);
                assertRead(room2);

                // When I restart
                saveAndReload();

                // Then the room is still read
                assertRead(room2);
            });
            it("Reacting to a redacted message leaves the room read", () => {
                // Given a redacted message exists
                goTo(room1);
                receiveMessages(room2, ["Msg1", "Msg2"]);
                assertUnread(room2, 2);
                receiveMessages(room2, [redactionOf("Msg2")]);
                assertUnread(room2, 1);

                // And the room is read
                goTo(room2);
                assertRead(room2);
                cy.wait(200);
                goTo(room1);

                // When I react to the redacted message
                receiveMessages(room2, [reactionTo("Msg2", "🪿")]);

                // Then the room is still read
                assertStillRead(room2);
            });
            it("Editing a redacted message leaves the room read", () => {
                // Given a redacted message exists
                goTo(room1);
                receiveMessages(room2, ["Msg1", "Msg2"]);
                assertUnread(room2, 2);
                receiveMessages(room2, [redactionOf("Msg2")]);
                assertUnread(room2, 1);

                // And the room is read
                goTo(room2);
                assertRead(room2);
                goTo(room1);

                // When I attempt to edit the redacted message
                receiveMessages(room2, [editOf("Msg2", "Msg2 is BACK")]);

                // Then the room is still read
                assertStillRead(room2);
            });
            // XXX: fails because flakes showing 2 unread instead of 1
            it.skip("A reply to a redacted message makes the room unread", () => {
                // Given a message was redacted
                goTo(room1);
                receiveMessages(room2, ["Msg1", "Msg2"]);
                assertUnread(room2, 2);
                receiveMessages(room2, [redactionOf("Msg2")]);
                assertUnread(room2, 1);

                // And the room is read
                goTo(room2);
                assertRead(room2);
                goTo(room1);

                // When I receive a reply to the redacted message
                receiveMessages(room2, [replyTo("Msg2", "Reply to Msg2")]);

                // Then the room is unread
                assertUnread(room2, 1);
            });
            it("Reading a reply to a redacted message marks the room as read", () => {
                // Given someone replied to a redacted message
                goTo(room1);
                receiveMessages(room2, ["Msg1", "Msg2"]);
                assertUnread(room2, 2);
                receiveMessages(room2, [redactionOf("Msg2")]);
                assertUnread(room2, 1);
                goTo(room2);
                assertRead(room2);
                goTo(room1);
                receiveMessages(room2, [replyTo("Msg2", "Reply to Msg2")]);
                assertUnread(room2, 1);

                // When I read the reply
                goTo(room2);
                assertRead(room2);

                // Then the room is unread
                goTo(room1);
                assertStillRead(room2);
            });
        });

        describe("in threads", () => {
            // XXX: fails because it flakes saying the room is unread when it should be read
            it.skip("Redacting the threaded message pointed to by my receipt leaves the room read", () => {
                // Given I have some threads
                goTo(room1);
                receiveMessages(room2, [
                    "Root",
                    threadedOff("Root", "ThreadMsg1"),
                    threadedOff("Root", "ThreadMsg2"),
                    "Root2",
                    threadedOff("Root2", "Root2->A"),
                ]);
                assertUnread(room2, 5);

                // And I have read them
                goTo(room2);
                assertUnreadThread("Root");
                openThread("Root");
                assertUnreadLessThan(room2, 4);
                openThread("Root2");
                assertRead(room2);
                closeThreadsPanel();
                goTo(room1);
                assertRead(room2);

                // When the latest message in a thread is redacted
                receiveMessages(room2, [redactionOf("ThreadMsg2")]);

                // Then the room and thread are still read
                assertStillRead(room2);
                goTo(room2);
                assertReadThread("Root");
            });
            // XXX: fails because it flakes (on CI only)
            it.skip("Reading an unread thread after a redaction of the latest message makes it read", () => {
                // Given an unread thread where the latest message was redacted
                goTo(room1);
                receiveMessages(room2, ["Root", threadedOff("Root", "ThreadMsg1"), threadedOff("Root", "ThreadMsg2")]);
                assertUnread(room2, 3);
                receiveMessages(room2, [redactionOf("ThreadMsg2")]);
                assertUnread(room2, 2);
                goTo(room2);
                assertUnreadThread("Root");

                // When I read the thread
                openThread("Root");
                assertRead(room2);
                closeThreadsPanel();
                goTo(room1);

                // Then the thread is read
                assertRead(room2);
                goTo(room2);
                assertReadThread("Root");
            });
            // XXX: fails because the unread count is still 1 when it should be 0
            it.skip("Reading an unread thread after a redaction of the latest message makes it read after restart", () => {
                // Given a redacted message is not counted in the unread count
                goTo(room1);
                receiveMessages(room2, ["Root", threadedOff("Root", "ThreadMsg1"), threadedOff("Root", "ThreadMsg2")]);
                assertUnread(room2, 3);
                receiveMessages(room2, [redactionOf("ThreadMsg2")]);
                assertUnread(room2, 2);
                goTo(room2);
                assertUnreadThread("Root");
                openThread("Root");
                assertRead(room2);
                closeThreadsPanel();
                goTo(room1);
                assertRead(room2);
                goTo(room2);
                assertReadThread("Root");

                // When I restart
                saveAndReload();

                // Then the room is still read
                assertRead(room2);
            });
            // XXX: fails because it flakes (on CI only)
            it.skip("Reading an unread thread after a redaction of an older message makes it read", () => {
                // Given an unread thread where an older message was redacted
                goTo(room1);
                receiveMessages(room2, ["Root", threadedOff("Root", "ThreadMsg1"), threadedOff("Root", "ThreadMsg2")]);
                assertUnread(room2, 3);
                receiveMessages(room2, [redactionOf("ThreadMsg1")]);
                assertUnread(room2, 2);
                goTo(room2);
                assertUnreadThread("Root");

                // When I read the thread
                openThread("Root");
                assertRead(room2);
                closeThreadsPanel();
                goTo(room1);

                // Then the thread is read
                assertRead(room2);
                goTo(room2);
                assertReadThread("Root");
            });
            // XXX: fails because it flakes (on CI only)
            it.skip("Marking an unread thread as read after a redaction makes it read", () => {
                // Given an unread thread where an older message was redacted
                goTo(room1);
                receiveMessages(room2, ["Root", threadedOff("Root", "ThreadMsg1"), threadedOff("Root", "ThreadMsg2")]);
                assertUnread(room2, 3);
                receiveMessages(room2, [redactionOf("ThreadMsg1")]);
                assertUnread(room2, 2);

                // When I mark the room as read
                markAsRead(room2);
                assertRead(room2);

                // Then the thread is read
                assertRead(room2);
                goTo(room2);
                assertReadThread("Root");
            });
            // XXX: fails because the room has an unread dot after I marked it as read
            it.skip("Sending and redacting a message after marking the thread as read leaves it read", () => {
                // Given a thread exists and is marked as read
                goTo(room1);
                receiveMessages(room2, ["Root", threadedOff("Root", "ThreadMsg1"), threadedOff("Root", "ThreadMsg2")]);
                assertUnread(room2, 3);
                markAsRead(room2);
                assertRead(room2);

                // When I send and redact a message
                receiveMessages(room2, [threadedOff("Root", "Msg3")]);
                assertUnread(room2, 1);
                receiveMessages(room2, [redactionOf("Msg3")]);

                // Then the room and thread are read
                assertRead(room2);
                goTo(room2);
                assertReadThread("Root");
            });
            // XXX: fails because the room has an unread dot after I marked it as read
            it.skip("Redacting a message after marking the thread as read leaves it read", () => {
                // Given a thread exists and is marked as read
                goTo(room1);
                receiveMessages(room2, ["Root", threadedOff("Root", "ThreadMsg1"), threadedOff("Root", "ThreadMsg2")]);
                assertUnread(room2, 3);
                markAsRead(room2);
                assertRead(room2);

                // When I redact a message
                receiveMessages(room2, [redactionOf("ThreadMsg1")]);

                // Then the room and thread are read
                assertRead(room2);
                goTo(room2);
                assertReadThread("Root");
            });
            // XXX: fails because it flakes - sometimes the room is still unread after opening the thread (initially)
            it.skip("Reacting to a redacted message leaves the thread read", () => {
                // Given a message in a thread was redacted and everything is read
                goTo(room1);
                receiveMessages(room2, ["Root", threadedOff("Root", "Msg2"), threadedOff("Root", "Msg3")]);
                assertUnread(room2, 3);
                receiveMessages(room2, [redactionOf("Msg2")]);
                assertUnread(room2, 2);
                goTo(room2);
                assertUnread(room2, 1);
                openThread("Root");
                assertRead(room2);
                goTo(room1);

                // When we receive a reaction to the redacted event
                receiveMessages(room2, [reactionTo("Msg2", "z")]);

                // Then the room is unread
                assertStillRead(room2);
            });
            // XXX: fails because the room is still unread after opening the thread (initially)
            it.skip("Editing a redacted message leaves the thread read", () => {
                // Given a message in a thread was redacted and everything is read
                goTo(room1);
                receiveMessages(room2, ["Root", threadedOff("Root", "Msg2"), threadedOff("Root", "Msg3")]);
                assertUnread(room2, 3);
                receiveMessages(room2, [redactionOf("Msg2")]);
                assertUnread(room2, 2);
                goTo(room2);
                assertUnread(room2, 1);
                openThread("Root");
                assertRead(room2);
                goTo(room1);

                // When we receive an edit of the redacted message
                receiveMessages(room2, [editOf("Msg2", "New Msg2")]);

                // Then the room is unread
                assertStillRead(room2);
            });
            // XXX: failed because flakes: https://github.com/vector-im/element-web/issues/26594
            it.skip("Reading a thread after a reaction to a redacted message marks the thread as read", () => {
                // Given a redacted message in a thread exists, but someone reacted to it before it was redacted
                goTo(room1);
                receiveMessages(room2, [
                    "Root",
                    threadedOff("Root", "Msg2"),
                    threadedOff("Root", "Msg3"),
                    reactionTo("Msg3", "x"),
                ]);
                assertUnread(room2, 3);
                receiveMessages(room2, [redactionOf("Msg3")]);
                assertUnread(room2, 2);

                // When we read the thread
                goTo(room2);
                openThread("Root");

                // Then the thread (and room) are read
                assertRead(room2);
                assertReadThread("Root");
            });
            // XXX: fails because the unread count stays at 1 instead of zero
            it.skip("Reading a thread containing a redacted, edited message marks the thread as read", () => {
                // Given a redacted message in a thread exists, but someone edited it before it was redacted
                goTo(room1);
                receiveMessages(room2, [
                    "Root",
                    threadedOff("Root", "Msg2"),
                    threadedOff("Root", "Msg3"),
                    editOf("Msg3", "Msg3 Edited"),
                ]);
                assertUnread(room2, 3);
                receiveMessages(room2, [redactionOf("Msg3")]);

                // When we read the thread
                goTo(room2);
                openThread("Root");

                // Then the thread (and room) are read
                assertRead(room2);
                assertReadThread("Root");
            });
            // XXX: fails because the read count drops to 1 but not to zero (this is a genuine stuck unread case)
            it.skip("Reading a reply to a redacted message marks the thread as read", () => {
                // Given a redacted message in a thread exists, but someone replied before it was redacted
                goTo(room1);
                receiveMessages(room2, [
                    "Root",
                    threadedOff("Root", "Msg2"),
                    threadedOff("Root", "Msg3"),
                    replyTo("Msg3", "Msg3Reply"),
                ]);
                assertUnread(room2, 4);
                receiveMessages(room2, [redactionOf("Msg3")]);

                // When we read the thread, creating a receipt that points at the edit
                goTo(room2);
                openThread("Root");

                // Then the thread (and room) are read
                assertRead(room2);
                assertReadThread("Root");
            });
            // XXX: fails because flakes saying 2 unread instead of 1
            it.skip("Reading a thread root when its only message has been redacted leaves the room read", () => {
                // Given we had a thread
                goTo(room1);
                receiveMessages(room2, ["Root", threadedOff("Root", "Msg2")]);
                assertUnread(room2, 2);

                // And then redacted the message that makes it a thread
                receiveMessages(room2, [redactionOf("Msg2")]);
                assertUnread(room2, 1);

                // When we read the main timeline
                goTo(room2);

                // Then the room is read
                assertRead(room2);
            });
            // XXX: fails because flakes with matrix-js-sdk#3798 (only when all other tests are enabled!)
            it.skip("A thread with a redacted unread is still read after restart", () => {
                // Given I sent and redacted a message in an otherwise-read thread
                goTo(room1);
                receiveMessages(room2, ["Root", threadedOff("Root", "ThreadMsg1"), threadedOff("Root", "ThreadMsg2")]);
                assertUnread(room2, 3);
                goTo(room2);
                openThread("Root");
                assertRead(room2);
                assertReadThread("Root");
                receiveMessages(room2, [threadedOff("Root", "Msg3")]);
                assertUnread(room2, 1);
                receiveMessages(room2, [redactionOf("Msg3")]);
                assertRead(room2);
                goTo(room2);
                assertReadThread("Root");
                goTo(room1);

                // When I restart
                saveAndReload();

                // Then the room and thread are still read
                assertRead(room2);
                goTo(room2);
                assertReadThread("Root");
            });
            // XXX: fails because it flakes
            it.skip("A thread with a read redaction is still read after restart", () => {
                // Given my receipt points at a redacted thread message
                goTo(room1);
                receiveMessages(room2, [
                    "Root",
                    threadedOff("Root", "ThreadMsg1"),
                    threadedOff("Root", "ThreadMsg2"),
                    "Root2",
                    threadedOff("Root2", "Root2->A"),
                ]);
                assertUnread(room2, 5);
                goTo(room2);
                assertUnreadThread("Root");
                openThread("Root");
                assertUnreadLessThan(room2, 4);
                openThread("Root2");
                assertRead(room2);
                closeThreadsPanel();
                goTo(room1);
                assertRead(room2);
                receiveMessages(room2, [redactionOf("ThreadMsg2")]);
                assertStillRead(room2);
                goTo(room2);
                assertReadThread("Root");

                // When I restart
                saveAndReload();

                // Then the room is still read
                assertRead(room2);
            });
            // XXX: fails for the same reason as "Reading a reply to a redacted message marks the thread as read"
            it.skip("A thread with an unread reply to a redacted message is still unread after restart", () => {
                // Given a redacted message in a thread exists, but someone replied before it was redacted
                goTo(room1);
                receiveMessages(room2, [
                    "Root",
                    threadedOff("Root", "Msg2"),
                    threadedOff("Root", "Msg3"),
                    replyTo("Msg3", "Msg3Reply"),
                ]);
                assertUnread(room2, 4);
                receiveMessages(room2, [redactionOf("Msg3")]);

                // And we have read all this
                goTo(room2);
                openThread("Root");
                assertRead(room2);
                assertReadThread("Root");

                // When I restart
                saveAndReload();

                // Then the room is still read
                assertRead(room2);
                assertReadThread("Root");
            });
            // XXX: fails for the same reason as "Reading a reply to a redacted message marks the thread as read
            it.skip("A thread with a read reply to a redacted message is still read after restart", () => {
                // Given a redacted message in a thread exists, but someone replied before it was redacted
                goTo(room1);
                receiveMessages(room2, [
                    "Root",
                    threadedOff("Root", "Msg2"),
                    threadedOff("Root", "Msg3"),
                    replyTo("Msg3", "Msg3Reply"),
                ]);
                assertUnread(room2, 4);
                receiveMessages(room2, [redactionOf("Msg3")]);

                // And I read it, so the room is read
                goTo(room2);
                openThread("Root");
                assertRead(room2);
                assertReadThread("Root");

                // When I restart
                saveAndReload();

                // Then the room is still read
                assertRead(room2);
                assertReadThread("Root");
            });
        });

        describe("thread roots", () => {
            it("Redacting a thread root after it was read leaves the room read", () => {
                // Given a thread exists and is read
                goTo(room1);
                receiveMessages(room2, ["Root", threadedOff("Root", "Msg2"), threadedOff("Root", "Msg3")]);
                assertUnread(room2, 3);
                goTo(room2);
                openThread("Root");
                assertRead(room2);
                assertReadThread("Root");

                // When someone redacts the thread root
                receiveMessages(room2, [redactionOf("Root")]);

                // Then the room is still read
                assertStillRead(room2);
            });
            // TODO: Can't open a thread on a redacted thread root
            it.skip("Redacting a thread root still allows us to read the thread", () => {
                // Given an unread thread exists
                goTo(room1);
                receiveMessages(room2, ["Root", threadedOff("Root", "Msg2"), threadedOff("Root", "Msg3")]);
                assertUnread(room2, 3);

                // When someone redacts the thread root
                receiveMessages(room2, [redactionOf("Root")]);

                // Then the room is still unread
                assertUnread(room2, 2);

                // And I can open the thread and read it
                goTo(room2);
                assertUnread(room2, 2);
                openThread("Root");
                assertRead(room2);
                assertReadThread("Root");
            });
            // TODO: Can't open a thread on a redacted thread root
            it.skip("Sending a threaded message onto a redacted thread root leaves the room unread", () => {
                // Given a thread exists, is read and its root is redacted
                goTo(room1);
                receiveMessages(room2, ["Root", threadedOff("Root", "Msg2"), threadedOff("Root", "Msg3")]);
                assertUnread(room2, 3);
                goTo(room2);
                openThread("Root");
                assertRead(room2);
                assertReadThread("Root");
                receiveMessages(room2, [redactionOf("Root")]);

                // When we receive a new message on it
                receiveMessages(room2, [threadedOff("Root", "Msg4")]);

                // Then the room and thread are unread
                assertUnread(room2, 1);
                goTo(room2);
                assertUnreadThread("Root");
            });
            it("Reacting to a redacted thread root leaves the room read", () => {
                // Given a thread exists, is read and the root was redacted
                goTo(room1);
                receiveMessages(room2, ["Root", threadedOff("Root", "Msg2"), threadedOff("Root", "Msg3")]);
                assertUnread(room2, 3);
                goTo(room2);
                openThread("Root");
                assertRead(room2);
                assertReadThread("Root");
                receiveMessages(room2, [redactionOf("Root")]);

                // When I react to the old root
                receiveMessages(room2, [reactionTo("Root", "y")]);

                // Then the room is still read
                assertRead(room2);
            });
            it("Editing a redacted thread root leaves the room read", () => {
                // Given a thread exists, is read and the root was redacted
                goTo(room1);
                receiveMessages(room2, ["Root", threadedOff("Root", "Msg2"), threadedOff("Root", "Msg3")]);
                assertUnread(room2, 3);
                goTo(room2);
                openThread("Root");
                assertRead(room2);
                assertReadThread("Root");
                receiveMessages(room2, [redactionOf("Root")]);

                // When I edit the old root
                receiveMessages(room2, [editOf("Root", "New Root")]);

                // Then the room is still read
                assertRead(room2);
            });
            it("Replying to a redacted thread root makes the room unread", () => {
                // Given a thread exists, is read and the root was redacted
                goTo(room1);
                receiveMessages(room2, ["Root", threadedOff("Root", "Msg2"), threadedOff("Root", "Msg3")]);
                assertUnread(room2, 3);
                goTo(room2);
                openThread("Root");
                assertRead(room2);
                assertReadThread("Root");
                receiveMessages(room2, [redactionOf("Root")]);

                // When I reply to the old root
                receiveMessages(room2, [replyTo("Root", "Reply!")]);

                // Then the room is unread
                assertUnread(room2, 1);
            });
            it("Reading a reply to a redacted thread root makes the room read", () => {
                // Given a thread exists, is read and the root was redacted, and
                // someone replied to it
                goTo(room1);
                receiveMessages(room2, ["Root", threadedOff("Root", "Msg2"), threadedOff("Root", "Msg3")]);
                assertUnread(room2, 3);
                goTo(room2);
                openThread("Root");
                assertRead(room2);
                assertReadThread("Root");
                receiveMessages(room2, [redactionOf("Root")]);
                assertStillRead(room2);
                receiveMessages(room2, [replyTo("Root", "Reply!")]);
                assertUnread(room2, 1);

                // When I read the room
                goTo(room2);

                // Then it becomes read
                assertRead(room2);
            });
        });
    });
});

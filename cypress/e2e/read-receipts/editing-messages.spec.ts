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

import type { MatrixClient } from "matrix-js-sdk/src/matrix";
import { HomeserverInstance } from "../../plugins/utils/homeserver";
import {
    assertRead,
    assertReadThread,
    assertUnread,
    assertUnreadThread,
    backToThreadsList,
    goTo,
    markAsRead,
    Message,
    MessageContentSpec,
    MessageFinder,
    openThread,
    saveAndReload,
    sendMessageAsClient,
} from "./read-receipts-utils";

describe("Read receipts", () => {
    const userName = "Mae";
    const botName = "Other User";
    const roomAlpha = "Room Alpha";
    const roomBeta = "Room Beta";

    let homeserver: HomeserverInstance;
    let betaRoomId: string;
    let alphaRoomId: string;
    let bot: MatrixClient | undefined;

    let messageFinder: MessageFinder;

    function editOf(originalMessage: string, newMessage: string): MessageContentSpec {
        return messageFinder.editOf(originalMessage, newMessage);
    }

    function replyTo(targetMessage: string, newMessage: string): MessageContentSpec {
        return messageFinder.replyTo(targetMessage, newMessage);
    }

    function threadedOff(rootMessage: string, newMessage: string): MessageContentSpec {
        return messageFinder.threadedOff(rootMessage, newMessage);
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

        // Create 2 rooms: Alpha & Beta. We join the bot to both of them
        cy.initTestUser(homeserver, userName)
            .then(() => {
                cy.createRoom({ name: roomAlpha }).then((createdRoomId) => {
                    alphaRoomId = createdRoomId;
                });
            })
            .then(() => {
                cy.createRoom({ name: roomBeta }).then((createdRoomId) => {
                    betaRoomId = createdRoomId;
                });
            })
            .then(() => {
                cy.getBot(homeserver, { displayName: botName }).then((botClient) => {
                    bot = botClient;
                });
            })
            .then(() => {
                // Invite the bot to both rooms
                cy.inviteUser(alphaRoomId, bot.getUserId());
                cy.viewRoomById(alphaRoomId);
                cy.findByText(botName + " joined the room").should("exist");

                cy.inviteUser(betaRoomId, bot.getUserId());
                cy.viewRoomById(betaRoomId);
                cy.findByText(botName + " joined the room").should("exist");
            });
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
        sendMessageAsClient(bot, room, messages);
    }

    const room1 = roomAlpha;
    const room2 = roomBeta;

    describe("editing messages", () => {
        describe("in the main timeline", () => {
            // TODO: this passes but we think this should fail, because we think edits should not cause unreads.
            // XXX: fails because we see a dot instead of an unread number - probably the server and client disagree
            it.skip("Editing a message makes a room unread", () => {
                // Given I am not looking at the room
                goTo(room1);

                receiveMessages(room2, ["Msg1"]);
                assertUnread(room2, 1);
                goTo(room2);
                assertRead(room2);
                goTo(room1);

                // When an edit appears in the room
                receiveMessages(room2, [editOf("Msg1", "Msg1 Edit1")]);

                // Then it becomes unread
                assertUnread(room2, 1);
            });
            // XXX: fails because we see a dot instead of an unread number - probably the server and client disagree
            it.skip("Reading an edit makes the room read", () => {
                // Given an edit is making the room unread
                goTo(room1);
                receiveMessages(room2, ["Msg1"]);
                assertUnread(room2, 1);

                goTo(room2);
                assertRead(room2);
                goTo(room1);

                receiveMessages(room2, [editOf("Msg1", "Msg1 Edit1")]);
                assertUnread(room2, 1);

                // When I read it
                goTo(room2);

                // Then the room becomes read and stays read
                assertRead(room2);
                goTo(room1);
                assertRead(room2);
            });
            it("Marking a room as read after an edit makes it read", () => {
                // Given an edit is making a room unread
                goTo(room2);
                receiveMessages(room2, ["Msg1"]);
                assertRead(room2);
                goTo(room1);
                receiveMessages(room2, [editOf("Msg1", "Msg1 Edit1")]);
                assertUnread(room2, 1);

                // When I mark it as read
                markAsRead(room2);

                // Then the room becomes read
                assertRead(room2);
            });
            // XXX: fails because we see a dot instead of an unread number - probably the server and client disagree
            it.skip("Editing a message after marking as read makes the room unread", () => {
                // Given the room is marked as read
                goTo(room1);
                receiveMessages(room2, ["Msg1"]);
                assertUnread(room2, 1);
                markAsRead(room2);
                assertRead(room2);

                // When a message is edited
                receiveMessages(room2, [editOf("Msg1", "Msg1 Edit1")]);

                // Then the room becomes unread
                assertUnread(room2, 1);
            });
            // XXX: fails because we see a dot instead of an unread number - probably the server and client disagree
            it.skip("Editing a reply after reading it makes the room unread", () => {
                // Given the room is all read
                goTo(room1);

                receiveMessages(room2, ["Msg1", replyTo("Msg1", "Reply1")]);
                assertUnread(room2, 2);

                goTo(room2);
                assertRead(room2);
                goTo(room1);

                // When a message is edited
                receiveMessages(room2, [editOf("Reply1", "Reply1 Edit1")]);

                // Then it becomes unread
                assertUnread(room2, 1);
            });
            // XXX: fails because we see a dot instead of an unread number - probably the server and client disagree
            it.skip("Editing a reply after marking as read makes the room unread", () => {
                // Given a reply is marked as read
                goTo(room1);
                receiveMessages(room2, ["Msg1", replyTo("Msg1", "Reply1")]);
                assertUnread(room2, 2);
                markAsRead(room2);
                assertRead(room2);

                // When the reply is edited
                receiveMessages(room2, [editOf("Reply1", "Reply1 Edit1")]);

                // Then the room becomes unread
                assertUnread(room2, 1);
            });
            // XXX: fails because we see a dot instead of an unread number - probably the server and client disagree
            it.skip("A room with an edit is still unread after restart", () => {
                // Given a message is marked as read
                goTo(room2);
                receiveMessages(room2, ["Msg1"]);
                assertRead(room2);
                goTo(room1);

                // When an edit appears in the room
                receiveMessages(room2, [editOf("Msg1", "Msg1 Edit1")]);

                // Then it becomes unread
                assertUnread(room2, 1);

                // And remains so after a reload
                saveAndReload();
                assertUnread(room2, 1);
            });
            it("An edited message becomes read if it happens while I am looking", () => {
                // Given a message is marked as read
                goTo(room2);
                receiveMessages(room2, ["Msg1"]);
                assertRead(room2);

                // When I see an edit appear in the room I am looking at
                receiveMessages(room2, [editOf("Msg1", "Msg1 Edit1")]);

                // Then it becomes read
                assertRead(room2);
            });
            it("A room where all edits are read is still read after restart", () => {
                // Given an edit made the room unread
                goTo(room2);
                receiveMessages(room2, ["Msg1"]);
                assertRead(room2);
                receiveMessages(room2, [editOf("Msg1", "Msg1 Edit1")]);
                assertUnread(room2, 1);

                // When I mark it as read
                markAsRead(room2);

                // Then the room becomes read
                assertRead(room2);

                // And remains so after a reload
                saveAndReload();
                assertRead(room2);
            });
        });

        describe("in threads", () => {
            // XXX: fails because we see a dot instead of an unread number - probably the server and client disagree
            it.skip("An edit of a threaded message makes the room unread", () => {
                // Given we have read the thread
                goTo(room1);
                receiveMessages(room2, ["Msg1", threadedOff("Msg1", "Resp1")]);
                assertUnread(room2, 2);
                goTo(room2);
                openThread("Msg1");
                assertRead(room2);
                backToThreadsList();
                goTo(room1);

                // When a message inside it is edited
                receiveMessages(room2, [editOf("Resp1", "Edit1")]);

                // Then the room and thread are unread
                assertUnread(room2, 1);
                goTo(room2);
                assertUnreadThread("Msg1");
            });
            // XXX: fails because we see a dot instead of an unread number - probably the server and client disagree
            it.skip("Reading an edit of a threaded message makes the room read", () => {
                // Given an edited thread message is making the room unread
                goTo(room1);
                receiveMessages(room2, ["Msg1", threadedOff("Msg1", "Resp1")]);
                assertUnread(room2, 2);
                goTo(room2);
                openThread("Msg1");
                assertRead(room2);
                backToThreadsList();
                goTo(room1);
                receiveMessages(room2, [editOf("Resp1", "Edit1")]);
                assertUnread(room2, 1);

                // When I read it
                goTo(room2);
                openThread("Msg1");

                // Then the room and thread are read
                assertRead(room2);
                assertReadThread("Msg1");
            });
            // XXX: fails because the room is still "bold" even though the notification counts all disappear
            it.skip("Marking a room as read after an edit in a thread makes it read", () => {
                // Given an edit in a thread is making the room unread
                goTo(room1);
                receiveMessages(room2, ["Msg1", threadedOff("Msg1", "Resp1"), editOf("Resp1", "Edit1")]);
                assertUnread(room2, 3); // TODO: the edit counts as a message!

                // When I mark the room as read
                markAsRead(room2);

                // Then it is read
                assertRead(room2);
            });
            // XXX: fails because the unread dot remains after marking as read
            it.skip("Editing a thread message after marking as read makes the room unread", () => {
                // Given a room is marked as read
                goTo(room1);
                receiveMessages(room2, ["Msg1", threadedOff("Msg1", "Resp1")]);
                assertUnread(room2, 2);
                markAsRead(room2);
                assertRead(room2);

                // When a message is edited
                receiveMessages(room2, [editOf("Resp1", "Edit1")]);

                // Then the room becomes unread
                assertUnread(room2, 1); // TODO: should this edit make us unread?
            });
            // XXX: fails because we see a dot instead of an unread number - probably the server and client disagree
            it.skip("A room with an edited threaded message is still unread after restart", () => {
                // Given an edit in a thread is making a room unread
                goTo(room1);
                receiveMessages(room2, ["Msg1", threadedOff("Msg1", "Resp1")]);
                markAsRead(room2);
                receiveMessages(room2, [editOf("Resp1", "Edit1")]);
                assertUnread(room2, 1);

                // When I restart
                saveAndReload();

                // Then is it still unread
                assertUnread(room2, 1);
            });
            it("A room where all threaded edits are read is still read after restart", () => {
                goTo(room2);
                receiveMessages(room2, ["Msg1", threadedOff("Msg1", "Resp1"), editOf("Resp1", "Edit1")]);
                assertUnread(room2, 2);
                openThread("Msg1");
                assertRead(room2);
                goTo(room1); // Make sure we are looking at room1 after reload
                assertRead(room2);

                saveAndReload();
                assertRead(room2);
            });
            // XXX: fails because we see a dot instead of an unread number - probably the server and client disagree
            it.skip("A room where all threaded edits are marked as read is still read after restart", () => {
                goTo(room1);
                receiveMessages(room2, ["Msg1", threadedOff("Msg1", "Resp1"), editOf("Resp1", "Edit1")]);
                assertUnread(room2, 3);
                markAsRead(room2);
                assertRead(room2);

                // When I restart
                saveAndReload();

                // It is still read
                assertRead(room2);
            });
        });

        describe("thread roots", () => {
            // XXX: fails because we see a dot instead of an unread number - probably the server and client disagree
            it.skip("An edit of a thread root makes the room unread", () => {
                // Given I have read a thread
                goTo(room1);
                receiveMessages(room2, ["Msg1", threadedOff("Msg1", "Resp1")]);
                assertUnread(room2, 2);
                goTo(room2);
                openThread("Msg1");
                backToThreadsList();
                assertRead(room2);
                goTo(room1);

                // When the thread root is edited
                receiveMessages(room2, [editOf("Msg1", "Edit1")]);

                // Then the room is unread
                assertUnread(room2, 1);

                // But the thread is read
                goTo(room2);
                assertRead(room2);
                assertReadThread("Edit1");
            });
            it("Reading an edit of a thread root makes the room read", () => {
                // Given a fully-read thread exists
                goTo(room2);
                receiveMessages(room2, ["Msg1", threadedOff("Msg1", "Resp1")]);
                openThread("Msg1");
                assertRead(room2);
                goTo(room1);
                assertRead(room2);

                // When the thread root is edited
                receiveMessages(room2, [editOf("Msg1", "Msg1 Edit1")]);

                // And I read that edit
                goTo(room2);

                // Then the room becomes read and stays read
                assertRead(room2);
                goTo(room1);
                assertRead(room2);
            });
            // XXX: fails because it shows a dot instead of unread count
            it.skip("Editing a thread root after reading makes the room unread", () => {
                // Given a fully-read thread exists
                goTo(room2);
                receiveMessages(room2, ["Msg1", threadedOff("Msg1", "Resp1")]);
                openThread("Msg1");
                assertRead(room2);
                goTo(room1);

                // When the thread root is edited
                receiveMessages(room2, [editOf("Msg1", "Msg1 Edit1")]);

                // Then the room becomes unread
                assertUnread(room2, 1);
            });
            // XXX: fails because the room has an unread dot after I marked it as read
            it.skip("Marking a room as read after an edit of a thread root makes it read", () => {
                // Given a fully-read thread exists
                goTo(room2);
                receiveMessages(room2, ["Msg1", threadedOff("Msg1", "Resp1")]);
                openThread("Msg1");
                assertRead(room2);
                goTo(room1);
                assertRead(room2);

                // When the thread root is edited
                receiveMessages(room2, [editOf("Msg1", "Msg1 Edit1")]);

                // And I mark the room as read
                markAsRead(room2);

                // Then the room becomes read and stays read
                assertRead(room2);
                goTo(room1);
                assertRead(room2);
            });
            // XXX: fails because the room has an unread dot after I marked it as read
            it.skip("Editing a thread root that is a reply after marking as read makes the room unread but not the thread", () => {
                // Given a thread based on a reply exists and is read because it is marked as read
                goTo(room1);
                receiveMessages(room2, ["Msg", replyTo("Msg", "Reply"), threadedOff("Reply", "InThread")]);
                assertUnread(room2, 3);
                markAsRead(room2);
                assertRead(room2);

                // When I edit the thread root
                receiveMessages(room1, [editOf("Reply", "Edited Reply")]);

                // Then the room is unread
                assertUnread(room2, 1);
                goTo(room2);

                // But the thread is still read (because the root is not part of the thread)
                assertReadThread("EditedReply");
            });
            // XXX: fails because the room has an unread dot after I marked it as read
            it.skip("Marking a room as read after an edit of a thread root that is a reply makes it read", () => {
                // Given a thread based on a reply exists and the reply has been edited
                goTo(room1);
                receiveMessages(room2, ["Msg", replyTo("Msg", "Reply"), threadedOff("Reply", "InThread")]);
                receiveMessages(room2, [editOf("Reply", "Edited Reply")]);
                assertUnread(room2, 3);

                // When I mark the room as read
                markAsRead(room2);

                // Then the room and thread are read
                assertRead(room2);
                goTo(room2);
                assertReadThread("Edited Reply");
            });
        });
    });
});

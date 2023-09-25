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
    assertStillRead,
    assertUnread,
    BotActionSpec,
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

    function threadedOff(rootMessage: string, newMessage: string): MessageContentSpec {
        return messageFinder.threadedOff(rootMessage, newMessage);
    }

    function reactionTo(targetMessage: string, reaction: string): BotActionSpec {
        return messageFinder.reactionTo(targetMessage, reaction);
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

    describe("reactions", () => {
        describe("in the main timeline", () => {
            it("Receiving a reaction to a message does not make a room unread", () => {
                goTo(room1);
                assertRead(room2);
                receiveMessages(room2, ["Msg1", "Msg2"]);
                assertUnread(room2, 2);

                // When I read the main timeline
                goTo(room2);
                assertRead(room2);

                goTo(room1);
                receiveMessages(room2, [reactionTo("Msg2", "🪿")]);
                assertRead(room2);
            });
            it("Reacting to a message after marking as read does not make the room unread", () => {
                goTo(room1);
                assertRead(room2);
                receiveMessages(room2, ["Msg1", "Msg2"]);
                assertUnread(room2, 2);

                markAsRead(room2);
                assertRead(room2);

                receiveMessages(room2, [reactionTo("Msg2", "🪿")]);
                assertRead(room2);
            });
            it("A room with an unread reaction is still read after restart", () => {
                goTo(room1);
                assertRead(room2);
                receiveMessages(room2, ["Msg1", "Msg2"]);
                assertUnread(room2, 2);

                markAsRead(room2);
                assertRead(room2);

                receiveMessages(room2, [reactionTo("Msg2", "🪿")]);
                assertRead(room2);

                saveAndReload();
                assertRead(room2);
            });
            it("A room where all reactions are read is still read after restart", () => {
                goTo(room1);
                assertRead(room2);
                receiveMessages(room2, ["Msg1", "Msg2", reactionTo("Msg2", "🪿")]);
                assertUnread(room2, 2);

                markAsRead(room2);
                assertRead(room2);

                saveAndReload();
                assertRead(room2);
            });
        });

        describe("in threads", () => {
            it("A reaction to a threaded message does not make the room unread", () => {
                // Given a thread exists and I have read it
                goTo(room1);
                assertRead(room2);
                receiveMessages(room2, ["Msg1", threadedOff("Msg1", "Reply1")]);
                assertUnread(room2, 2);
                goTo(room2);
                openThread("Msg1");
                assertRead(room2);
                goTo(room1);

                // When someone reacts to a thread message
                receiveMessages(room2, [reactionTo("Reply1", "🪿")]);

                // Then the room remains read
                assertStillRead(room2);
            });
            // XXX: fails because the room is still "bold" even though the notification counts all disappear
            it.skip("Marking a room as read after a reaction in a thread makes it read", () => {
                // Given a thread exists with a reaction
                goTo(room1);
                assertRead(room2);
                receiveMessages(room2, ["Msg1", threadedOff("Msg1", "Reply1"), reactionTo("Reply1", "🪿")]);
                assertUnread(room2, 2);

                // When I mark the room as read
                markAsRead(room2);

                // Then it becomes read
                assertRead(room2);
            });
            // XXX: fails because the room is still "bold" even though the notification counts all disappear
            it.skip("Reacting to a thread message after marking as read does not make the room unread", () => {
                // Given a thread exists and I have marked it as read
                goTo(room1);
                assertRead(room2);
                receiveMessages(room2, ["Msg1", threadedOff("Msg1", "Reply1"), reactionTo("Reply1", "🪿")]);
                assertUnread(room2, 2);
                markAsRead(room2);
                assertRead(room2);

                // When someone reacts to a thread message
                receiveMessages(room2, [reactionTo("Reply1", "🪿")]);

                // Then the room remains read
                assertStillRead(room2);
            });
            it.skip("A room with a reaction to a threaded message is still unread after restart", () => {
                // Given a thread exists and I have read it
                goTo(room1);
                assertRead(room2);
                receiveMessages(room2, ["Msg1", threadedOff("Msg1", "Reply1")]);
                assertUnread(room2, 2);
                goTo(room2);
                openThread("Msg1");
                assertRead(room2);
                goTo(room1);

                // And someone reacted to it, which doesn't stop it being read
                receiveMessages(room2, [reactionTo("Reply1", "🪿")]);
                assertStillRead(room2);

                // When I restart
                saveAndReload();

                // Then the room is still read
                assertRead(room2);
            });
            it("A room where all reactions in threads are read is still read after restart", () => {
                // Given multiple threads with reactions exist and are read
                goTo(room1);
                assertRead(room2);
                receiveMessages(room2, [
                    "Msg1",
                    threadedOff("Msg1", "Reply1a"),
                    reactionTo("Reply1a", "r"),
                    "Msg2",
                    threadedOff("Msg1", "Reply1b"),
                    threadedOff("Msg2", "Reply2a"),
                    reactionTo("Msg1", "e"),
                    threadedOff("Msg2", "Reply2b"),
                    reactionTo("Reply2a", "a"),
                    reactionTo("Reply2b", "c"),
                    reactionTo("Reply1b", "t"),
                ]);
                assertUnread(room2, 6);
                goTo(room2);
                openThread("Msg1");
                assertReadThread("Msg1");
                openThread("Msg2");
                assertReadThread("Msg2");
                assertRead(room2);
                goTo(room1);

                // When I restart
                saveAndReload();

                // Then the room is still read
                assertRead(room2);
                goTo(room2);
                assertReadThread("Msg1");
                assertReadThread("Msg2");
            });
        });

        describe("thread roots", () => {
            it("A reaction to a thread root does not make the room unread", () => {
                // Given a read thread root exists
                goTo(room1);
                assertRead(room2);
                receiveMessages(room2, ["Msg1", threadedOff("Msg1", "Reply1")]);
                assertUnread(room2, 2);
                goTo(room2);
                openThread("Msg1");
                assertRead(room2);

                // When someone reacts to it
                goTo(room1);
                receiveMessages(room2, [reactionTo("Msg1", "🪿")]);
                cy.wait(200);

                // Then the room is still read
                assertRead(room2);
            });
            it("Reading a reaction to a thread root leaves the room read", () => {
                // Given a read thread root exists
                goTo(room1);
                assertRead(room2);
                receiveMessages(room2, ["Msg1", threadedOff("Msg1", "Reply1")]);
                assertUnread(room2, 2);
                goTo(room2);
                openThread("Msg1");
                assertRead(room2);

                // And the reaction to it does not make us unread
                goTo(room1);
                receiveMessages(room2, [reactionTo("Msg1", "🪿")]);
                assertRead(room2);

                // When we read the reaction and go away again
                goTo(room2);
                openThread("Msg1");
                assertRead(room2);
                goTo(room1);
                cy.wait(200);

                // Then the room is still read
                assertRead(room2);
            });
            // XXX: fails because the room is still "bold" even though the notification counts all disappear
            it.skip("Reacting to a thread root after marking as read makes the room unread but not the thread", () => {
                // Given a thread root exists
                goTo(room1);
                assertRead(room2);
                receiveMessages(room2, ["Msg1", threadedOff("Msg1", "Reply1")]);
                assertUnread(room2, 2);

                // And we have marked the room as read
                markAsRead(room2);
                assertRead(room2);

                // When someone reacts to it
                receiveMessages(room2, [reactionTo("Msg1", "🪿")]);
                cy.wait(200);

                // Then the room is still read
                assertRead(room2);
            });
        });
    });
});

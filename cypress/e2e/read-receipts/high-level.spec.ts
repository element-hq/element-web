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

import type { MatrixClient, MatrixEvent } from "matrix-js-sdk/src/matrix";
import { HomeserverInstance } from "../../plugins/utils/homeserver";
import {
    assertRead,
    assertStillRead,
    assertUnread,
    customEvent,
    goTo,
    markAsRead,
    Message,
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

    /**
     * Map of message content -> event. Allows us to find e.g. edited or
     * redacted messages even if their content has changed or disappeared from
     * screen.
     */
    const messages = new Map<String, MatrixEvent>();

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
        messages.clear();

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

            // When we receive important messages
            receiveMessages(room2, [customEvent("org.custom.event", { body: "foobar" })]);

            // Then the room is still read
            assertStillRead(room2);

            // And when we receive more important ones
            receiveMessages(room2, ["Hello"]);

            // The room is unread again
            assertUnread(room2, 1);
        });
        it.skip("A receipt for the last unimportant event makes the room read, even if all are unimportant", () => {});
    });

    describe("Paging up", () => {
        it.skip("Paging up through old messages after a room is read leaves the room read", () => {});
        it.skip("Paging up through old messages of an unread room leaves the room unread", () => {});
        it.skip("Paging up to find old threads that were previously read leaves the room read", () => {});
        it.skip("?? Paging up to find old threads that were never read marks the room unread", () => {});
        it.skip("After marking room as read, paging up to find old threads that were never read leaves the room read", () => {});
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

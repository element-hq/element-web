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
    goTo,
    Message,
    MessageContentSpec,
    MessageFinder,
    ReadReceiptSetup,
    sendMessageAsClient,
} from "./read-receipts-utils";

describe("Read receipts", () => {
    const roomAlpha = "Room Alpha";
    const roomBeta = "Room Beta";

    let homeserver: HomeserverInstance;
    let messageFinder: MessageFinder;
    let testSetup: ReadReceiptSetup;

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
        testSetup = new ReadReceiptSetup(homeserver, "Mae", "Other User", roomAlpha, roomBeta);
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

    after(() => {
        cy.stopHomeserver(homeserver);
    });

    describe("messages with missing referents", () => {
        it.skip("A message in an unknown thread is not visible and the room is read", () => {
            // Given a thread existed and the room is read
            goTo(room1);
            receiveMessages(room2, ["Root1", threadedOff("Root1", "T1a")]);

            // When I restart, forgetting the thread root
            // And I receive a message on that thread
            // Then the message is invisible and the room remains read
        });
        it.skip("When a message's thread root appears later the thread appears and the room is unread", () => {});
        it.skip("An edit of an unknown message is not visible and the room is read", () => {});
        it.skip("When an edit's message appears later the edited version appears and the room is unread", () => {});
        it.skip("A reaction to an unknown message is not visible and the room is read", () => {});
        it.skip("When an reactions's message appears later it appears and the room is unread", () => {});
        // Harder: validate that we request the messages we are missing?
    });

    describe("receipts with missing events", () => {
        // Later: when we have order in receipts, we can change these tests to
        // make receipts still work, even when their message is not found.
        it.skip("A receipt for an unknown message does not change the state of an unread room", () => {});
        it.skip("A receipt for an unknown message does not change the state of a read room", () => {});
        it.skip("A threaded receipt for an unknown message does not change the state of an unread thread", () => {});
        it.skip("A threaded receipt for an unknown message does not change the state of a read thread", () => {});
        it.skip("A threaded receipt for an unknown thread does not change the state of an unread thread", () => {});
        it.skip("A threaded receipt for an unknown thread does not change the state of a read thread", () => {});
        it.skip("A threaded receipt for a message on main does not change the state of an unread room", () => {});
        it.skip("A threaded receipt for a message on main does not change the state of a read room", () => {});
        it.skip("A main receipt for a message on a thread does not change the state of an unread room", () => {});
        it.skip("A main receipt for a message on a thread does not change the state of a read room", () => {});
        it.skip("A threaded receipt for a thread root does not mark it as read", () => {});
        // Harder: validate that we request the messages we are missing?
    });
});

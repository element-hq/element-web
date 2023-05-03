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

/// <reference types="cypress" />

import type { MatrixClient, MatrixEvent } from "matrix-js-sdk/src/matrix";
import type { ISendEventResponse } from "matrix-js-sdk/src/@types/requests";
import type { ReceiptType } from "matrix-js-sdk/src/@types/read_receipts";
import { HomeserverInstance } from "../../plugins/utils/homeserver";

describe("Read receipts", () => {
    const userName = "Mae";
    const botName = "Other User";
    const selectedRoomName = "Selected Room";
    const otherRoomName = "Other Room";

    let homeserver: HomeserverInstance;
    let otherRoomId: string;
    let selectedRoomId: string;
    let bot: MatrixClient | undefined;

    const botSendMessage = (): Cypress.Chainable<ISendEventResponse> => {
        return cy.botSendMessage(bot, otherRoomId, "Message");
    };

    const fakeEventFromSent = (eventResponse: ISendEventResponse): MatrixEvent => {
        return {
            getRoomId: () => otherRoomId,
            getId: () => eventResponse.event_id,
            threadRootId: undefined,
            getTs: () => 1,
        } as any as MatrixEvent;
    };

    beforeEach(() => {
        /*
         * Create 2 rooms:
         *
         * - Selected room - this one is clicked in the UI
         * - Other room - this one contains the bot, which will send events so
         *                we can check its unread state.
         */
        cy.startHomeserver("default").then((data) => {
            homeserver = data;
            cy.initTestUser(homeserver, userName)
                .then(() => {
                    cy.createRoom({ name: selectedRoomName }).then((createdRoomId) => {
                        selectedRoomId = createdRoomId;
                    });
                })
                .then(() => {
                    cy.createRoom({ name: otherRoomName }).then((createdRoomId) => {
                        otherRoomId = createdRoomId;
                    });
                })
                .then(() => {
                    cy.getBot(homeserver, { displayName: botName }).then((botClient) => {
                        bot = botClient;
                    });
                })
                .then(() => {
                    // Invite the bot to Other room
                    cy.inviteUser(otherRoomId, bot.getUserId());
                    cy.visit("/#/room/" + otherRoomId);
                    cy.findByText(botName + " joined the room").should("exist");

                    // Then go into Selected room
                    cy.visit("/#/room/" + selectedRoomId);
                });
        });
    });

    afterEach(() => {
        cy.stopHomeserver(homeserver);
    });

    it(
        "Considers room read if there's a receipt for main even if an earlier unthreaded receipt exists #24629",
        {
            // When #24629 exists, the test fails the first time but passes later, so we disable retries
            // to be sure we are going to fail if the bug comes back.
            // Why does it pass the second time? I wish I knew. (andyb)
            retries: 0,
        },
        () => {
            // Details are in https://github.com/vector-im/element-web/issues/24629
            // This proves we've fixed one of the "stuck unreads" issues.

            // Given we sent 3 events on the main thread
            botSendMessage();
            botSendMessage().then((main2) => {
                botSendMessage().then((main3) => {
                    // (So the room starts off unread)
                    cy.findByLabelText(`${otherRoomName} 3 unread messages.`).should("exist");

                    // When we send a threaded receipt for the last event in main
                    // And an unthreaded receipt for an earlier event
                    cy.sendReadReceipt(fakeEventFromSent(main3));
                    cy.sendReadReceipt(fakeEventFromSent(main2), "m.read" as any as ReceiptType, true);

                    // (So the room has no unreads)
                    cy.findByLabelText(`${otherRoomName}`).should("exist");

                    // And we persuade the app to persist its state to indexeddb by reloading and waiting
                    cy.reload();
                    cy.findByLabelText(`${selectedRoomName}`).should("exist");

                    // And we reload again, fetching the persisted state FROM indexeddb
                    cy.reload();

                    // Then the room is read, because the persisted state correctly remembers both
                    // receipts. (In #24629, the unthreaded receipt overwrote the main thread one,
                    // meaning that the room still said it had unread messages.)
                    cy.findByLabelText(`${otherRoomName}`).should("exist");
                    cy.findByLabelText(`${otherRoomName} Unread messages.`).should("not.exist");
                });
            });
        },
    );
});

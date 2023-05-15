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

    const botSendMessage = (no = 1): Cypress.Chainable<ISendEventResponse> => {
        return cy.botSendMessage(bot, otherRoomId, `Message ${no}`);
    };

    const botSendThreadMessage = (threadId: string): Cypress.Chainable<ISendEventResponse> => {
        return cy.botSendThreadMessage(bot, otherRoomId, threadId, "Message");
    };

    const fakeEventFromSent = (eventResponse: ISendEventResponse, threadRootId: string | undefined): MatrixEvent => {
        return {
            getRoomId: () => otherRoomId,
            getId: () => eventResponse.event_id,
            threadRootId,
            getTs: () => 1,
        } as any as MatrixEvent;
    };

    /**
     * Send a threaded receipt marking the message referred to in
     * eventResponse as read. If threadRootEventResponse is supplied, the
     * receipt will have its event_id as the thread root ID for the receipt.
     */
    const sendThreadedReadReceipt = (
        eventResponse: ISendEventResponse,
        threadRootEventResponse: ISendEventResponse = undefined,
    ) => {
        cy.sendReadReceipt(fakeEventFromSent(eventResponse, threadRootEventResponse?.event_id));
    };

    /**
     * Send an unthreaded receipt marking the message referred to in
     * eventResponse as read.
     */
    const sendUnthreadedReadReceipt = (eventResponse: ISendEventResponse) => {
        cy.sendReadReceipt(fakeEventFromSent(eventResponse, undefined), "m.read" as any as ReceiptType, true);
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
        "With sync accumulator, considers main thread and unthreaded receipts #24629",
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
                    sendThreadedReadReceipt(main3);
                    sendUnthreadedReadReceipt(main2);

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

    it("Recognises unread messages on main thread after receiving a receipt for earlier ones", () => {
        // Given we sent 3 events on the main thread
        botSendMessage();
        botSendMessage().then((main2) => {
            botSendMessage().then(() => {
                // (The room starts off unread)
                cy.findByLabelText(`${otherRoomName} 3 unread messages.`).should("exist");

                // When we send a threaded receipt for the second-last event in main
                sendThreadedReadReceipt(main2);

                // Then the room has only one unread
                cy.findByLabelText(`${otherRoomName} 1 unread message.`).should("exist");
            });
        });
    });

    it("Considers room read if there is only a main thread and we have a main receipt", () => {
        // Given we sent 3 events on the main thread
        botSendMessage();
        botSendMessage().then(() => {
            botSendMessage().then((main3) => {
                // (The room starts off unread)
                cy.findByLabelText(`${otherRoomName} 3 unread messages.`).should("exist");

                // When we send a threaded receipt for the last event in main
                sendThreadedReadReceipt(main3);

                // Then the room has no unreads
                cy.findByLabelText(`${otherRoomName}`).should("exist");
            });
        });
    });

    it("Recognises unread messages on other thread after receiving a receipt for earlier ones", () => {
        // Given we sent 3 events on the main thread
        botSendMessage().then((main1) => {
            botSendThreadMessage(main1.event_id).then((thread1a) => {
                botSendThreadMessage(main1.event_id).then((thread1b) => {
                    // 1 unread on the main thread, 2 in the new thread
                    cy.findByLabelText(`${otherRoomName} 3 unread messages.`).should("exist");

                    // When we send receipts for main, and the second-last in the thread
                    sendThreadedReadReceipt(main1);
                    sendThreadedReadReceipt(thread1a, main1);

                    // Then the room has only one unread - the one in the thread
                    cy.findByLabelText(`${otherRoomName} 1 unread message.`).should("exist");
                });
            });
        });
    });

    it("Considers room read if there are receipts for main and other thread", () => {
        // Given we sent 3 events on the main thread
        botSendMessage().then((main1) => {
            botSendThreadMessage(main1.event_id).then((thread1a) => {
                botSendThreadMessage(main1.event_id).then((thread1b) => {
                    // 1 unread on the main thread, 2 in the new thread
                    cy.findByLabelText(`${otherRoomName} 3 unread messages.`).should("exist");

                    // When we send receipts for main, and the last in the thread
                    sendThreadedReadReceipt(main1);
                    sendThreadedReadReceipt(thread1b, main1);

                    // Then the room has no unreads
                    cy.findByLabelText(`${otherRoomName}`).should("exist");
                });
            });
        });
    });

    it("Recognises unread messages on a thread after receiving a unthreaded receipt for earlier ones", () => {
        // Given we sent 3 events on the main thread
        botSendMessage().then((main1) => {
            botSendThreadMessage(main1.event_id).then((thread1a) => {
                botSendThreadMessage(main1.event_id).then(() => {
                    // 1 unread on the main thread, 2 in the new thread
                    cy.findByLabelText(`${otherRoomName} 3 unread messages.`).should("exist");

                    // When we send an unthreaded receipt for the second-last in the thread
                    sendUnthreadedReadReceipt(thread1a);

                    // Then the room has only one unread - the one in the
                    // thread. The one in main is read because the unthreaded
                    // receipt is for a later event.
                    cy.findByLabelText(`${otherRoomName} 1 unread message.`).should("exist");
                });
            });
        });
    });

    it("Recognises unread messages on main after receiving a unthreaded receipt for a thread message", () => {
        // Given we sent 3 events on the main thread
        botSendMessage().then((main1) => {
            botSendThreadMessage(main1.event_id).then(() => {
                botSendThreadMessage(main1.event_id).then((thread1b) => {
                    botSendMessage().then(() => {
                        // 2 unreads on the main thread, 2 in the new thread
                        cy.findByLabelText(`${otherRoomName} 4 unread messages.`).should("exist");

                        // When we send an unthreaded receipt for the last in the thread
                        sendUnthreadedReadReceipt(thread1b);

                        // Then the room has only one unread - the one in the
                        // main thread, because it is later than the unthreaded
                        // receipt.
                        cy.findByLabelText(`${otherRoomName} 1 unread message.`).should("exist");
                    });
                });
            });
        });
    });

    /**
     * The idea of this test is to intercept the receipt / read read_markers requests and
     * assert that the correct ones are sent.
     * Prose playbook:
     * - Another user sends enough messages that the timeline becomes scrollable
     * - The current user looks at the room and jumps directly to the first unread message
     * - At this point, a receipt for the last message in the room and
     *   a fully read marker for the last visible message are expected to be sent
     * - Then the user jumps to the end of the timeline
     * - A fully read marker for the last message in the room is expected to be sent
     */
    it("Should send the correct receipts", () => {
        const uriEncodedOtherRoomId = encodeURIComponent(otherRoomId);

        cy.intercept({
            method: "POST",
            url: new RegExp(
                `http://localhost:\\d+/_matrix/client/r0/rooms/${uriEncodedOtherRoomId}/receipt/m\\.read/.+`,
            ),
        }).as("receiptRequest");

        const numberOfMessages = 20;
        const sendMessagePromises = [];

        for (let i = 1; i <= numberOfMessages; i++) {
            sendMessagePromises.push(botSendMessage(i));
        }

        cy.all(sendMessagePromises).then((sendMessageResponses) => {
            const lastMessageId = sendMessageResponses.at(-1).event_id;
            const uriEncodedLastMessageId = encodeURIComponent(lastMessageId);

            // wait until all messages have been received
            cy.findByLabelText(`${otherRoomName} ${sendMessagePromises.length} unread messages.`).should("exist");

            // switch to the room with the messages
            cy.visit("/#/room/" + otherRoomId);

            cy.wait("@receiptRequest").should((req) => {
                // assert the read receipt for the last message in the room
                expect(req.request.url).to.contain(uriEncodedLastMessageId);
                expect(req.request.body).to.deep.equal({
                    thread_id: "main",
                });
            });

            // the following code tests the fully read marker somewhere in the middle of the room

            cy.intercept({
                method: "POST",
                url: new RegExp(`http://localhost:\\d+/_matrix/client/r0/rooms/${uriEncodedOtherRoomId}/read_markers`),
            }).as("readMarkersRequest");

            cy.findByRole("button", { name: "Jump to first unread message." }).click();

            cy.wait("@readMarkersRequest").should((req) => {
                // since this is not pixel perfect,
                // the fully read marker should be +/- 1 around the last visible message
                expect(Array.from(Object.keys(req.request.body))).to.deep.equal(["m.fully_read"]);
                expect(req.request.body["m.fully_read"]).to.be.oneOf([
                    sendMessageResponses[11].event_id,
                    sendMessageResponses[12].event_id,
                    sendMessageResponses[13].event_id,
                ]);
            });

            // the following code tests the fully read marker at the bottom of the room

            cy.intercept({
                method: "POST",
                url: new RegExp(`http://localhost:\\d+/_matrix/client/r0/rooms/${uriEncodedOtherRoomId}/read_markers`),
            }).as("readMarkersRequest");

            cy.findByRole("button", { name: "Scroll to most recent messages" }).click();

            cy.wait("@readMarkersRequest").should((req) => {
                expect(req.request.body).to.deep.equal({
                    ["m.fully_read"]: sendMessageResponses.at(-1).event_id,
                });
            });
        });
    });
});

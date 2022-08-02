/*
Copyright 2022 The Matrix.org Foundation C.I.C.

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

import { MessageEvent } from "matrix-events-sdk";

import type { ISendEventResponse } from "matrix-js-sdk/src/@types/requests";
import type { EventType } from "matrix-js-sdk/src/@types/event";
import { SynapseInstance } from "../../plugins/synapsedocker";
import Chainable = Cypress.Chainable;

const sendEvent = (roomId: string): Chainable<ISendEventResponse> => {
    return cy.sendEvent(
        roomId,
        null,
        "m.room.message" as EventType,
        MessageEvent.from("Message").serialize().content,
    );
};

describe("Editing", () => {
    let synapse: SynapseInstance;

    beforeEach(() => {
        cy.startSynapse("default").then(data => {
            synapse = data;
            cy.initTestUser(synapse, "Edith").then(() => {
                cy.injectAxe();
                return cy.createRoom({ name: "Test room" }).as("roomId");
            });
        });
    });

    afterEach(() => {
        cy.stopSynapse(synapse);
    });

    it("should close the composer when clicking save after making a change and undoing it", () => {
        cy.get<string>("@roomId").then(roomId => {
            sendEvent(roomId);
            cy.visit("/#/room/" + roomId);
        });

        // Edit message
        cy.contains(".mx_RoomView_body .mx_EventTile .mx_EventTile_line", "Message").within(() => {
            cy.get('[aria-label="Edit"]').click({ force: true }); // Cypress has no ability to hover
            cy.checkA11y();
            cy.get(".mx_BasicMessageComposer_input").type("Foo{backspace}{backspace}{backspace}{enter}");
            cy.checkA11y();
        });
        cy.get(".mx_RoomView_body .mx_EventTile").contains(".mx_EventTile[data-scroll-tokens]", "Message");

        // Assert that the edit composer has gone away
        cy.get(".mx_EditMessageComposer").should("not.exist");
    });
});

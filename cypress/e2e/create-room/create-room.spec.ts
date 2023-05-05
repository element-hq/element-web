/*
Copyright 2022-2023 The Matrix.org Foundation C.I.C.

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

import { HomeserverInstance } from "../../plugins/utils/homeserver";
import Chainable = Cypress.Chainable;

function openCreateRoomDialog(): Chainable<JQuery<HTMLElement>> {
    cy.findByRole("button", { name: "Add room" }).click();
    cy.findByRole("menuitem", { name: "New room" }).click();
    return cy.get(".mx_CreateRoomDialog");
}

describe("Create Room", () => {
    let homeserver: HomeserverInstance;

    beforeEach(() => {
        cy.startHomeserver("default").then((data) => {
            homeserver = data;

            cy.initTestUser(homeserver, "Jim");
        });
    });

    afterEach(() => {
        cy.stopHomeserver(homeserver);
    });

    it("should allow us to create a public room with name, topic & address set", () => {
        const name = "Test room 1";
        const topic = "This room is dedicated to this test and this test only!";

        openCreateRoomDialog().within(() => {
            // Fill name & topic
            cy.findByRole("textbox", { name: "Name" }).type(name);
            cy.findByRole("textbox", { name: "Topic (optional)" }).type(topic);
            // Change room to public
            cy.findByRole("button", { name: "Room visibility" }).click();
            cy.findByRole("option", { name: "Public room" }).click();
            // Fill room address
            cy.findByRole("textbox", { name: "Room address" }).type("test-room-1");
            // Submit
            cy.findByRole("button", { name: "Create room" }).click();
        });

        cy.url().should("contain", "/#/room/#test-room-1:localhost");

        cy.get(".mx_RoomHeader").within(() => {
            cy.findByText(name);
            cy.findByText(topic);
        });
    });
});

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
    cy.findButton("Add room").click();
    cy.findMenuitem("New room").click();
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
            cy.findTextbox("Name").type(name);
            cy.findTextbox("Topic (optional)").type(topic);
            // Change room to public
            cy.findButton("Room visibility").click();
            cy.findOption("Public room").click();
            // Fill room address
            cy.findTextbox("Room address").type("test-room-1");
            // Submit
            cy.findButton("Create room").click();
        });

        cy.url().should("contain", "/#/room/#test-room-1:localhost");

        cy.get(".mx_RoomHeader").within(() => {
            cy.findByText(name);
            cy.findByText(topic);
        });
    });

    it("should create a room with a long room name, which is displayed with ellipsis", () => {
        let roomId: string;
        const LONG_ROOM_NAME =
            "Lorem ipsum dolor sit amet, consectetur adipisicing elit, sed do eiusmod tempor incididunt ut labore " +
            "et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut " +
            "aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum " +
            "dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui " +
            "officia deserunt mollit anim id est laborum.";

        cy.createRoom({ name: LONG_ROOM_NAME }).then((_roomId) => {
            roomId = _roomId;
            cy.visit("/#/room/" + roomId);
        });

        // Wait until the room name is set
        cy.get(".mx_RoomHeader_nametext").contains("Lorem ipsum");

        // Make sure size of buttons on RoomHeader (except .mx_RoomHeader_name) are specified
        // and the buttons are not compressed
        // TODO: use a same class name
        cy.get(".mx_RoomHeader_button").should("have.css", "height", "32px").should("have.css", "width", "32px");
        cy.get(".mx_HeaderButtons > .mx_RightPanel_headerButton")
            .should("have.css", "height", "32px")
            .should("have.css", "width", "32px");
        cy.get(".mx_RoomHeader").percySnapshotElement("Room header with a long room name");
    });
});

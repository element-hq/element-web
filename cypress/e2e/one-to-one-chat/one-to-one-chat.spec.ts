/*
Copyright 2023 Ahmad Kadri
Copyright 2023 Nordeck IT + Consulting GmbH.

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
import { Credentials } from "../../support/homeserver";

describe("1:1 chat room", () => {
    let homeserver: HomeserverInstance;
    let user2: Credentials;

    const username = "user1234";
    const password = "p4s5W0rD";

    beforeEach(() => {
        cy.startHomeserver("default").then((data) => {
            homeserver = data;

            cy.initTestUser(homeserver, "Jeff");
            cy.registerUser(homeserver, username, password).then((credential) => {
                user2 = credential;
                cy.visit(`/#/user/${user2.userId}?action=chat`);
            });
        });
    });

    afterEach(() => {
        cy.stopHomeserver(homeserver);
    });

    it("should open new 1:1 chat room after leaving the old one", () => {
        // leave 1:1 chat room
        cy.get(".mx_RoomHeader_nametext").within(() => {
            cy.findByText(username).click();
        });
        cy.findByRole("menuitem", { name: "Leave" }).click();
        cy.findByRole("button", { name: "Leave" }).click();

        // wait till the room was left
        cy.findByRole("group", { name: "Historical" }).within(() => {
            cy.get(".mx_RoomTile").within(() => {
                cy.findByText(username);
            });
        });

        // open new 1:1 chat room
        cy.visit(`/#/user/${user2.userId}?action=chat`);
        cy.get(".mx_RoomHeader_nametext").within(() => {
            cy.findByText(username);
        });
    });
});

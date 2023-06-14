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

import { HomeserverInstance } from "../../plugins/utils/homeserver";
import Chainable = Cypress.Chainable;

describe("Location sharing", () => {
    let homeserver: HomeserverInstance;

    const selectLocationShareTypeOption = (shareType: string): Chainable<JQuery> => {
        return cy.findByTestId(`share-location-option-${shareType}`);
    };

    const submitShareLocation = (): void => {
        cy.findByRole("button", { name: "Share location" }).click();
    };

    beforeEach(() => {
        cy.window().then((win) => {
            win.localStorage.setItem("mx_lhs_size", "0"); // Collapse left panel for these tests
        });
        cy.startHomeserver("default").then((data) => {
            homeserver = data;

            cy.initTestUser(homeserver, "Tom");
        });
    });

    afterEach(() => {
        cy.stopHomeserver(homeserver);
    });

    it("sends and displays pin drop location message successfully", () => {
        let roomId: string;
        cy.createRoom({}).then((_roomId) => {
            roomId = _roomId;
            cy.visit("/#/room/" + roomId);
        });

        cy.openMessageComposerOptions().within(() => {
            cy.findByRole("menuitem", { name: "Location" }).click();
        });

        selectLocationShareTypeOption("Pin").click();

        cy.get("#mx_LocationPicker_map").click("center");

        submitShareLocation();

        cy.get(".mx_RoomView_body .mx_EventTile .mx_MLocationBody", { timeout: 10000 }).should("exist").click();

        // clicking location tile opens maximised map
        cy.get(".mx_LocationViewDialog_wrapper").should("exist");

        cy.closeDialog();

        cy.get(".mx_Marker").should("exist");
    });
});

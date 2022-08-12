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

import { SynapseInstance } from "../../plugins/synapsedocker";

describe("User Onboarding (old user)", () => {
    let synapse: SynapseInstance;

    beforeEach(() => {
        cy.startSynapse("default").then(data => {
            synapse = data;
            cy.initTestUser(synapse, "Jane Doe");
            cy.window({ log: false }).then(win => {
                win.localStorage.setItem("mx_registration_time", "2");
            });
            cy.reload().then(() => {
                // wait for the app to load
                return cy.get(".mx_MatrixChat", { timeout: 15000 });
            });
        });
    });

    afterEach(() => {
        cy.visit("/#/home");
        cy.stopSynapse(synapse);
    });

    it("page and preference are hidden", () => {
        cy.get('.mx_UserOnboardingPage').should('not.exist');
        cy.get('.mx_UserOnboardingButton').should('not.exist');
        cy.openUserSettings("Preferences");
        cy.contains("Show shortcut to welcome page above the room list").should("not.exist");
    });
});

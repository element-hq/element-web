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

import { SynapseInstance } from "../../plugins/synapsedocker/index";

describe("Registration", () => {
    let synapseId;
    let synapsePort;

    beforeEach(() => {
        cy.task<SynapseInstance>("synapseStart", "consent").then(result => {
            synapseId = result.synapseId;
            synapsePort = result.port;
        });
        cy.visit("/#/register");
    });

    afterEach(() => {
        cy.task("synapseStop", synapseId);
    });

    it("registers an account and lands on the home screen", () => {
        cy.get(".mx_ServerPicker_change", { timeout: 15000 }).click();
        cy.get(".mx_ServerPickerDialog_otherHomeserver").type(`http://localhost:${synapsePort}`);
        cy.get(".mx_ServerPickerDialog_continue").click();
        // wait for the dialog to go away
        cy.get('.mx_ServerPickerDialog').should('not.exist');
        cy.get("#mx_RegistrationForm_username").type("alice");
        cy.get("#mx_RegistrationForm_password").type("totally a great password");
        cy.get("#mx_RegistrationForm_passwordConfirm").type("totally a great password");
        cy.get(".mx_Login_submit").click();
        cy.get(".mx_RegistrationEmailPromptDialog button.mx_Dialog_primary").click();
        cy.get(".mx_InteractiveAuthEntryComponents_termsPolicy input").click();
        cy.get(".mx_InteractiveAuthEntryComponents_termsSubmit").click();
        cy.url().should('contain', '/#/home');
    });
});

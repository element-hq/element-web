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

describe("Registration", () => {
    let homeserver: HomeserverInstance;

    beforeEach(() => {
        cy.stubDefaultServer();
        cy.visit("/#/register");
        cy.startHomeserver("consent").then((data) => {
            homeserver = data;
        });
    });

    afterEach(() => {
        cy.stopHomeserver(homeserver);
    });

    it("registers an account and lands on the home screen", () => {
        cy.injectAxe();

        cy.get(".mx_ServerPicker_change", { timeout: 15000 }).click();
        cy.get(".mx_ServerPickerDialog_continue").should("be.visible");
        // Only snapshot the server picker otherwise in the background `matrix.org` may or may not be available
        cy.get(".mx_Dialog").percySnapshotElement("Server Picker", { widths: [516] });
        cy.checkA11y();

        cy.get(".mx_ServerPickerDialog_otherHomeserver").type(homeserver.baseUrl);
        cy.get(".mx_ServerPickerDialog_continue").click();
        // wait for the dialog to go away
        cy.get(".mx_ServerPickerDialog").should("not.exist");

        cy.get("#mx_RegistrationForm_username").should("be.visible");
        // Hide the server text as it contains the randomly allocated Homeserver port
        const percyCSS = ".mx_ServerPicker_server { visibility: hidden !important; }";
        cy.percySnapshot("Registration", { percyCSS });
        cy.checkA11y();

        cy.get("#mx_RegistrationForm_username").type("alice");
        cy.get("#mx_RegistrationForm_password").type("totally a great password");
        cy.get("#mx_RegistrationForm_passwordConfirm").type("totally a great password");
        cy.get(".mx_Login_submit").click();

        cy.get(".mx_RegistrationEmailPromptDialog").should("be.visible");
        cy.percySnapshot("Registration email prompt", { percyCSS });
        cy.checkA11y();
        cy.get(".mx_RegistrationEmailPromptDialog button.mx_Dialog_primary").click();

        cy.get(".mx_InteractiveAuthEntryComponents_termsPolicy").should("be.visible");
        cy.percySnapshot("Registration terms prompt", { percyCSS });
        cy.checkA11y();

        cy.get(".mx_InteractiveAuthEntryComponents_termsPolicy input").click();
        cy.get(".mx_InteractiveAuthEntryComponents_termsSubmit").click();

        cy.get(".mx_UseCaseSelection_skip", { timeout: 30000 }).should("exist");
        cy.percySnapshot("Use-case selection screen");
        cy.checkA11y();
        cy.get(".mx_UseCaseSelection_skip .mx_AccessibleButton").click();

        cy.url().should("contain", "/#/home");

        cy.get('[aria-label="User menu"]').click();
        cy.get('[aria-label="Security & Privacy"]').click();
        cy.get(".mx_DevicesPanel_myDevice .mx_DevicesPanel_deviceTrust .mx_E2EIcon").should(
            "have.class",
            "mx_E2EIcon_verified",
        );
    });

    it("should require username to fulfil requirements and be available", () => {
        cy.get(".mx_ServerPicker_change", { timeout: 15000 }).click();
        cy.get(".mx_ServerPickerDialog_continue").should("be.visible");
        cy.get(".mx_ServerPickerDialog_otherHomeserver").type(homeserver.baseUrl);
        cy.get(".mx_ServerPickerDialog_continue").click();
        // wait for the dialog to go away
        cy.get(".mx_ServerPickerDialog").should("not.exist");

        cy.get("#mx_RegistrationForm_username").should("be.visible");

        cy.intercept("**/_matrix/client/*/register/available?username=_alice", {
            statusCode: 400,
            headers: {
                "Content-Type": "application/json",
            },
            body: {
                errcode: "M_INVALID_USERNAME",
                error: "User ID may not begin with _",
            },
        });
        cy.get("#mx_RegistrationForm_username").type("_alice");
        cy.get(".mx_Field_tooltip")
            .should("have.class", "mx_Tooltip_visible")
            .should("contain.text", "Some characters not allowed");

        cy.intercept("**/_matrix/client/*/register/available?username=bob", {
            statusCode: 400,
            headers: {
                "Content-Type": "application/json",
            },
            body: {
                errcode: "M_USER_IN_USE",
                error: "The desired username is already taken",
            },
        });
        cy.get("#mx_RegistrationForm_username").type("{selectAll}{backspace}bob");
        cy.get(".mx_Field_tooltip")
            .should("have.class", "mx_Tooltip_visible")
            .should("contain.text", "Someone already has that username");

        cy.get("#mx_RegistrationForm_username").type("{selectAll}{backspace}foobar");
        cy.get(".mx_Field_tooltip").should("not.have.class", "mx_Tooltip_visible");
    });
});

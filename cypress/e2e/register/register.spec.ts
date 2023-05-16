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

        cy.findByRole("button", { name: "Edit", timeout: 15000 }).click();
        cy.findByRole("button", { name: "Continue" }).should("be.visible");
        // Only snapshot the server picker otherwise in the background `matrix.org` may or may not be available
        cy.get(".mx_Dialog").percySnapshotElement("Server Picker", { widths: [516] });
        cy.checkA11y();

        cy.findByRole("textbox", { name: "Other homeserver" }).type(homeserver.baseUrl);
        cy.findByRole("button", { name: "Continue" }).click();
        // wait for the dialog to go away
        cy.get(".mx_ServerPickerDialog").should("not.exist");

        cy.findByRole("textbox", { name: "Username" }).should("be.visible");
        // Hide the server text as it contains the randomly allocated Homeserver port
        const percyCSS = ".mx_ServerPicker_server { visibility: hidden !important; }";
        cy.percySnapshot("Registration", { percyCSS });
        cy.checkA11y();

        cy.findByRole("textbox", { name: "Username" }).type("alice");
        cy.findByPlaceholderText("Password").type("totally a great password");
        cy.findByPlaceholderText("Confirm password").type("totally a great password");
        cy.findByRole("button", { name: "Register" }).click();

        cy.get(".mx_RegistrationEmailPromptDialog").should("be.visible");
        cy.percySnapshot("Registration email prompt", { percyCSS });
        cy.checkA11y();
        cy.get(".mx_RegistrationEmailPromptDialog").within(() => {
            cy.findByRole("button", { name: "Continue" }).click();
        });

        cy.get(".mx_InteractiveAuthEntryComponents_termsPolicy").should("be.visible");
        cy.percySnapshot("Registration terms prompt", { percyCSS });
        cy.checkA11y();

        cy.get(".mx_InteractiveAuthEntryComponents_termsPolicy").within(() => {
            cy.findByRole("checkbox").click(); // Click the checkbox before privacy policy anchor link
            cy.findByLabelText("Privacy Policy").should("be.visible");
        });

        cy.findByRole("button", { name: "Accept" }).click();

        cy.get(".mx_UseCaseSelection_skip", { timeout: 30000 }).should("exist");
        cy.percySnapshot("Use-case selection screen");
        cy.checkA11y();
        cy.findByRole("button", { name: "Skip" }).click();

        cy.url().should("contain", "/#/home");

        /*
         * Cross-signing checks
         */

        // check that the device considers itself verified
        cy.findByRole("button", { name: "User menu" }).click();
        cy.findByRole("menuitem", { name: "Security & Privacy" }).click();
        cy.get(".mx_DevicesPanel_myDevice .mx_DevicesPanel_deviceTrust .mx_E2EIcon").should(
            "have.class",
            "mx_E2EIcon_verified",
        );

        // check that cross-signing keys have been uploaded.
        const myUserId = "@alice:localhost";
        let myDeviceId: string;
        cy.window({ log: false })
            .then((win) => {
                const cli = win.mxMatrixClientPeg.get();
                const accessToken = cli.getAccessToken()!;
                myDeviceId = cli.getDeviceId();
                return cy.request({
                    method: "POST",
                    url: `${homeserver.baseUrl}/_matrix/client/v3/keys/query`,
                    headers: { Authorization: `Bearer ${accessToken}` },
                    body: { device_keys: { [myUserId]: [] } },
                });
            })
            .then((res) => {
                // there should be three cross-signing keys
                expect(res.body.master_keys[myUserId]).to.have.property("keys");
                expect(res.body.self_signing_keys[myUserId]).to.have.property("keys");
                expect(res.body.user_signing_keys[myUserId]).to.have.property("keys");

                // and the device should be signed by the self-signing key
                const selfSigningKeyId = Object.keys(res.body.self_signing_keys[myUserId].keys)[0];
                expect(res.body.device_keys[myUserId][myDeviceId]).to.exist;
                const myDeviceSignatures = res.body.device_keys[myUserId][myDeviceId].signatures[myUserId];
                expect(myDeviceSignatures[selfSigningKeyId]).to.exist;
            });
    });

    it("should require username to fulfil requirements and be available", () => {
        cy.findByRole("button", { name: "Edit", timeout: 15000 }).click();
        cy.findByRole("button", { name: "Continue" }).should("be.visible");
        cy.findByRole("textbox", { name: "Other homeserver" }).type(homeserver.baseUrl);
        cy.findByRole("button", { name: "Continue" }).click();
        // wait for the dialog to go away
        cy.get(".mx_ServerPickerDialog").should("not.exist");

        cy.findByRole("textbox", { name: "Username" }).should("be.visible");

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
        cy.findByRole("textbox", { name: "Username" }).type("_alice");
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
        cy.findByRole("textbox", { name: "Username" }).type("{selectAll}{backspace}bob");
        cy.get(".mx_Field_tooltip")
            .should("have.class", "mx_Tooltip_visible")
            .should("contain.text", "Someone already has that username");

        cy.findByRole("textbox", { name: "Username" }).type("{selectAll}{backspace}foobar");
        cy.get(".mx_Field_tooltip").should("not.have.class", "mx_Tooltip_visible");
    });
});

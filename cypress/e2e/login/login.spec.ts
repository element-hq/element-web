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

describe("Login", () => {
    let homeserver: HomeserverInstance;

    beforeEach(() => {
        cy.stubDefaultServer();
    });

    afterEach(() => {
        cy.stopHomeserver(homeserver);
    });

    describe("m.login.password", () => {
        const username = "user1234";
        const password = "p4s5W0rD";

        beforeEach(() => {
            cy.startHomeserver("consent").then((data) => {
                homeserver = data;
                cy.registerUser(homeserver, username, password);
                cy.visit("/#/login");
            });
        });

        it("logs in with an existing account and lands on the home screen", () => {
            cy.injectAxe();

            cy.get("#mx_LoginForm_username", { timeout: 15000 }).should("be.visible");
            cy.percySnapshot("Login");
            cy.checkA11y();

            cy.get(".mx_ServerPicker_change").click();
            cy.get(".mx_ServerPickerDialog_otherHomeserver").type(homeserver.baseUrl);
            cy.get(".mx_ServerPickerDialog_continue").click();
            // wait for the dialog to go away
            cy.get(".mx_ServerPickerDialog").should("not.exist");

            cy.get("#mx_LoginForm_username").type(username);
            cy.get("#mx_LoginForm_password").type(password);
            cy.get(".mx_Login_submit").click();

            cy.url().should("contain", "/#/home", { timeout: 30000 });
        });
    });

    describe("logout", () => {
        beforeEach(() => {
            cy.startHomeserver("consent").then((data) => {
                homeserver = data;
                cy.initTestUser(homeserver, "Erin");
            });
        });

        it("should go to login page on logout", () => {
            cy.get('[aria-label="User menu"]').click();

            // give a change for the outstanding requests queue to settle before logging out
            cy.wait(2000);

            cy.get(".mx_UserMenu_contextMenu").within(() => {
                cy.get(".mx_UserMenu_iconSignOut").click();
            });

            cy.url().should("contain", "/#/login");
        });

        it("should respect logout_redirect_url", () => {
            cy.tweakConfig({
                // We redirect to decoder-ring because it's a predictable page that isn't Element itself.
                // We could use example.org, matrix.org, or something else, however this puts dependency of external
                // infrastructure on our tests. In the same vein, we don't really want to figure out how to ship a
                // `test-landing.html` page when running with an uncontrolled Element (via `yarn start`).
                // Using the decoder-ring is just as fine, and we can search for strategic names.
                logout_redirect_url: "/decoder-ring/",
            });

            cy.get('[aria-label="User menu"]').click();

            // give a change for the outstanding requests queue to settle before logging out
            cy.wait(2000);

            cy.get(".mx_UserMenu_contextMenu").within(() => {
                cy.get(".mx_UserMenu_iconSignOut").click();
            });

            cy.url().should("contains", "decoder-ring");
        });
    });
});

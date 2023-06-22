/*
Copyright 2023 The Matrix.org Foundation C.I.C.

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

import { HomeserverInstance } from "../../plugins/utils/homeserver";
import { logIntoElement } from "./utils";

describe("Complete security", () => {
    let homeserver: HomeserverInstance;

    beforeEach(() => {
        cy.startHomeserver("default").then((data) => {
            homeserver = data;
        });
        // visit the login page of the app, to load the matrix sdk
        cy.visit("/#/login");

        // wait for the page to load
        cy.window({ log: false }).should("have.property", "matrixcs");
    });

    afterEach(() => {
        cy.stopHomeserver(homeserver);
    });

    it("should go straight to the welcome screen if we have no signed device", () => {
        const username = Cypress._.uniqueId("user_");
        const password = "supersecret";
        cy.registerUser(homeserver, username, password, "Jeff");
        logIntoElement(homeserver.baseUrl, username, password);
        cy.findByText("Welcome Jeff");
    });

    // see also "Verify device during login with SAS" in `verifiction.spec.ts`.
});

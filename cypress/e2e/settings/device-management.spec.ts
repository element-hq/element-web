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
import type { UserCredentials } from "../../support/login";

describe("Device manager", () => {
    let homeserver: HomeserverInstance | undefined;
    let user: UserCredentials | undefined;

    beforeEach(() => {
        cy.startHomeserver("default").then((data) => {
            homeserver = data;

            cy.initTestUser(homeserver, "Alice")
                .then((credentials) => {
                    user = credentials;
                })
                .then(() => {
                    // create some extra sessions to manage
                    return cy.loginUser(homeserver, user.username, user.password);
                })
                .then(() => {
                    return cy.loginUser(homeserver, user.username, user.password);
                });
        });
    });

    afterEach(() => {
        cy.stopHomeserver(homeserver!);
    });

    it("should display sessions", () => {
        cy.openUserSettings("Sessions");
        cy.findByText("Current session").should("exist");

        cy.findByTestId("current-session-section").within(() => {
            cy.findByText("Unverified session").should("exist");

            // current session details opened
            cy.findByRole("button", { name: "Show details" }).click();
            cy.findByText("Session details").should("exist");

            // close current session details
            cy.findByRole("button", { name: "Hide details" }).click();
            cy.findByText("Session details").should("not.exist");
        });

        cy.findByTestId("security-recommendations-section").within(() => {
            cy.findByText("Security recommendations").should("exist");
            cy.findByRole("button", { name: "View all (3)" }).click();
        });

        /**
         * Other sessions section
         */
        cy.findByText("Other sessions").should("exist");
        // filter applied after clicking through from security recommendations
        cy.findByLabelText("Filter devices").should("have.text", "Show: Unverified");
        cy.get(".mx_FilteredDeviceList_list").within(() => {
            cy.get(".mx_FilteredDeviceList_listItem").should("have.length", 3);

            // select two sessions
            cy.get(".mx_FilteredDeviceList_listItem")
                .first()
                .within(() => {
                    // force click as the input element itself is not visible (its size is zero)
                    cy.findByRole("checkbox").click({ force: true });
                });
            cy.get(".mx_FilteredDeviceList_listItem")
                .last()
                .within(() => {
                    // force click as the input element itself is not visible (its size is zero)
                    cy.findByRole("checkbox").click({ force: true });
                });
        });
        // sign out from list selection action buttons
        cy.findByRole("button", { name: "Sign out" }).click();
        cy.get(".mx_Dialog .mx_QuestionDialog").within(() => {
            cy.findByRole("button", { name: "Sign out" }).click();
        });
        // list updated after sign out
        cy.get(".mx_FilteredDeviceList_list").find(".mx_FilteredDeviceList_listItem").should("have.length", 1);
        // security recommendation count updated
        cy.findByRole("button", { name: "View all (1)" });

        const sessionName = `Alice's device`;
        // open the first session
        cy.get(".mx_FilteredDeviceList_list .mx_FilteredDeviceList_listItem")
            .first()
            .within(() => {
                cy.findByRole("button", { name: "Show details" }).click();

                cy.findByText("Session details").should("exist");

                cy.findByRole("button", { name: "Rename" }).click();
                cy.findByTestId("device-rename-input").type(sessionName);
                cy.findByRole("button", { name: "Save" }).click();
                // there should be a spinner while device updates
                cy.get(".mx_Spinner").should("exist");
                // wait for spinner to complete
                cy.get(".mx_Spinner").should("not.exist");

                // session name updated in details
                cy.get(".mx_DeviceDetailHeading h4").within(() => {
                    cy.findByText(sessionName);
                });
                // and main list item
                cy.get(".mx_DeviceTile h4").within(() => {
                    cy.findByText(sessionName);
                });

                // sign out using the device details sign out
                cy.findByRole("button", { name: "Sign out of this session" }).click();
            });
        // confirm the signout
        cy.get(".mx_Dialog .mx_QuestionDialog").within(() => {
            cy.findByRole("button", { name: "Sign out" }).click();
        });

        // no other sessions or security recommendations sections when only one session
        cy.findByText("Other sessions").should("not.exist");
        cy.findByTestId("security-recommendations-section").should("not.exist");
    });
});

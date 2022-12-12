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
import type { UserCredentials } from "../../support/login";

describe("Device manager", () => {
    let synapse: SynapseInstance | undefined;
    let user: UserCredentials | undefined;

    beforeEach(() => {
        cy.enableLabsFeature("feature_new_device_manager");
        cy.startSynapse("default").then((data) => {
            synapse = data;

            cy.initTestUser(synapse, "Alice")
                .then((credentials) => {
                    user = credentials;
                })
                .then(() => {
                    // create some extra sessions to manage
                    return cy.loginUser(synapse, user.username, user.password);
                })
                .then(() => {
                    return cy.loginUser(synapse, user.username, user.password);
                });
        });
    });

    afterEach(() => {
        cy.stopSynapse(synapse!);
    });

    it("should display sessions", () => {
        cy.openUserSettings("Sessions");
        cy.contains("Current session").should("exist");

        cy.get('[data-testid="current-session-section"]').within(() => {
            cy.contains("Unverified session").should("exist");
        });

        // current session details opened
        cy.get('[data-testid="current-session-toggle-details"]').click();
        cy.contains("Session details").should("exist");

        // close current session details
        cy.get('[data-testid="current-session-toggle-details"]').click();
        cy.contains("Session details").should("not.exist");

        cy.get('[data-testid="security-recommendations-section"]').within(() => {
            cy.contains("Security recommendations").should("exist");
            cy.get('[data-testid="unverified-devices-cta"]').should("have.text", "View all (3)").click();
        });

        /**
         * Other sessions section
         */
        cy.contains("Other sessions").should("exist");
        // filter applied after clicking through from security recommendations
        cy.get('[aria-label="Filter devices"]').should("have.text", "Show: Unverified");
        cy.get(".mx_FilteredDeviceList_list").find(".mx_FilteredDeviceList_listItem").should("have.length", 3);

        // select two sessions
        cy.get(".mx_FilteredDeviceList_list .mx_FilteredDeviceList_listItem .mx_Checkbox").first().click();
        cy.get(".mx_FilteredDeviceList_list .mx_FilteredDeviceList_listItem .mx_Checkbox").last().click();
        // sign out from list selection action buttons
        cy.get('[data-testid="sign-out-selection-cta"]').click();
        cy.get('[data-testid="dialog-primary-button"]').click();
        // list updated after sign out
        cy.get(".mx_FilteredDeviceList_list").find(".mx_FilteredDeviceList_listItem").should("have.length", 1);
        // security recommendation count updated
        cy.get('[data-testid="unverified-devices-cta"]').should("have.text", "View all (1)");

        const sessionName = `Alice's device`;
        // open the first session
        cy.get(".mx_FilteredDeviceList_list .mx_FilteredDeviceList_listItem")
            .first()
            .within(() => {
                cy.get('[aria-label="Show details"]').click();

                cy.contains("Session details").should("exist");

                cy.get('[data-testid="device-heading-rename-cta"]').click();
                cy.get('[data-testid="device-rename-input"]').type(sessionName);
                cy.get('[data-testid="device-rename-submit-cta"]').click();
                // there should be a spinner while device updates
                cy.get(".mx_Spinner").should("exist");
                // wait for spinner to complete
                cy.get(".mx_Spinner").should("not.exist");

                // session name updated in details
                cy.get(".mx_DeviceDetailHeading h3").should("have.text", sessionName);
                // and main list item
                cy.get(".mx_DeviceTile h4").should("have.text", sessionName);

                // sign out using the device details sign out
                cy.get('[data-testid="device-detail-sign-out-cta"]').click();
            });
        // confirm the signout
        cy.get('[data-testid="dialog-primary-button"]').click();

        // no other sessions or security recommendations sections when only one session
        cy.contains("Other sessions").should("not.exist");
        cy.get('[data-testid="security-recommendations-section"]').should("not.exist");
    });
});

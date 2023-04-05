/*
Copyright 2023 Suguru Hirahara

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

const USER_NAME = "Alice";

describe("Set integration manager", () => {
    let homeserver: HomeserverInstance;

    beforeEach(() => {
        cy.startHomeserver("default").then((data) => {
            homeserver = data;
            cy.initTestUser(homeserver, USER_NAME);
        });
    });

    afterEach(() => {
        cy.stopHomeserver(homeserver);
    });

    it("should be correctly rendered", () => {
        cy.openUserSettings("General");

        cy.get(".mx_SetIntegrationManager").within(() => {
            // Assert the toggle switch is enabled by default
            cy.get(".mx_ToggleSwitch_enabled").should("exist");

            // Assert space between "Manage integrations" and the integration server address is set to 4px;
            cy.get(".mx_SetIntegrationManager_heading_manager").should("have.css", "column-gap", "4px");

            cy.get(".mx_SetIntegrationManager_heading_manager").within(() => {
                cy.get(".mx_SettingsTab_heading").should("have.text", "Manage integrations");

                // Assert the headings' inline end margin values are set to zero in favor of the column-gap declaration
                cy.get(".mx_SettingsTab_heading").should("have.css", "margin-inline-end", "0px");
                cy.get(".mx_SettingsTab_subheading").should("have.css", "margin-inline-end", "0px");
            });
        });

        cy.get(".mx_SetIntegrationManager").percySnapshotElement("'Manage integrations' on General settings tab", {
            widths: [692], // actual width of mx_SetIntegrationManager
        });
    });
});

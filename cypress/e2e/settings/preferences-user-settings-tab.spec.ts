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

describe("Preferences user settings tab", () => {
    let homeserver: HomeserverInstance;

    beforeEach(() => {
        cy.startHomeserver("default").then((data) => {
            homeserver = data;
            cy.initTestUser(homeserver, "Bob");
        });
    });

    afterEach(() => {
        cy.stopHomeserver(homeserver);
    });

    it("should be rendered properly", () => {
        cy.openUserSettings("Preferences");

        cy.findByTestId("mx_PreferencesUserSettingsTab").within(() => {
            // Assert that the top heading is rendered
            cy.contains("Preferences").should("be.visible");
        });

        cy.findByTestId("mx_PreferencesUserSettingsTab").percySnapshotElement("User settings tab - Preferences", {
            // Emulate TabbedView's actual min and max widths
            // 580: '.mx_UserSettingsDialog .mx_TabbedView' min-width
            // 796: 1036 (mx_TabbedView_tabsOnLeft actual width) - 240 (mx_TabbedView_tabPanel margin-right)
            widths: [580, 796],
        });
    });
});

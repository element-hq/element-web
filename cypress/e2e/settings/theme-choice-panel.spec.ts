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
import { SettingLevel } from "../../../src/settings/SettingLevel";

const USER_NAME = "Hanako";

describe("Theme Choice Panel", () => {
    let homeserver: HomeserverInstance;

    beforeEach(() => {
        cy.startHomeserver("default").then((data) => {
            homeserver = data;
            cy.initTestUser(homeserver, USER_NAME);
        });

        // Disable the default theme for consistency in case ThemeWatcher automatically chooses it
        cy.setSettingValue("use_system_theme", null, SettingLevel.DEVICE, false);
    });

    afterEach(() => {
        cy.stopHomeserver(homeserver);
    });

    it("should be rendered with the light theme selected", () => {
        cy.openUserSettings("Appearance")
            .get(".mx_ThemeChoicePanel")
            .within(() => {
                cy.findByTestId("checkbox-use-system-theme").within(() => {
                    cy.findByText("Match system theme").should("be.visible");

                    // Assert that 'Match system theme' is not checked
                    // Note that mx_Checkbox_checkmark exists and is hidden by CSS if it is not checked
                    cy.get(".mx_Checkbox_checkmark").should("not.be.visible");
                });

                cy.get(".mx_ThemeSelectors").within(() => {
                    cy.get(".mx_ThemeSelector_light").should("exist");
                    cy.get(".mx_ThemeSelector_dark").should("exist");

                    // Assert that the light theme is selected
                    cy.get(".mx_ThemeSelector_light.mx_StyledRadioButton_enabled").should("exist");

                    // Assert that the buttons for the light and dark theme are not enabled
                    cy.get(".mx_ThemeSelector_light.mx_StyledRadioButton_disabled").should("not.exist");
                    cy.get(".mx_ThemeSelector_dark.mx_StyledRadioButton_disabled").should("not.exist");
                });

                // Assert that the checkbox for the high contrast theme is rendered
                cy.findByLabelText("Use high contrast").should("exist");
            });
    });

    it(
        "should disable the labels for themes and the checkbox for the high contrast theme if the checkbox for " +
            "the system theme is clicked",
        () => {
            cy.openUserSettings("Appearance")
                .get(".mx_ThemeChoicePanel")
                .findByLabelText("Match system theme")
                .click({ force: true }); // force click because the size of the checkbox is zero

            cy.get(".mx_ThemeChoicePanel").within(() => {
                // Assert that the labels for the light theme and dark theme are disabled
                cy.get(".mx_ThemeSelector_light.mx_StyledRadioButton_disabled").should("exist");
                cy.get(".mx_ThemeSelector_dark.mx_StyledRadioButton_disabled").should("exist");

                // Assert that there does not exist a label for an enabled theme
                cy.get("label.mx_StyledRadioButton_enabled").should("not.exist");

                // Assert that the checkbox and label to enable the the high contrast theme should not exist
                cy.findByLabelText("Use high contrast").should("not.exist");
            });
        },
    );

    it("should not render the checkbox and the label for the high contrast theme if the dark theme is selected", () => {
        cy.openUserSettings("Appearance");

        // Assert that the checkbox and the label to enable the high contrast theme should exist
        cy.findByLabelText("Use high contrast").should("exist");

        // Enable the dark theme
        cy.get(".mx_ThemeSelector_dark").click();

        // Assert that the checkbox and the label should not exist
        cy.findByLabelText("Use high contrast").should("not.exist");
    });

    it("should support enabling the high contast theme", () => {
        cy.createRoom({ name: "Test Room" }).viewRoomByName("Test Room");

        cy.get(".mx_GenericEventListSummary").within(() => {
            // Assert that $primary-content is applied to GELS summary on the light theme
            // $primary-content on the light theme = #17191c = rgb(23, 25, 28)
            cy.get(".mx_TextualEvent.mx_GenericEventListSummary_summary")
                .should("have.css", "color", "rgb(23, 25, 28)")
                .should("have.css", "opacity", "0.5");
        });

        cy.openUserSettings("Appearance")
            .get(".mx_ThemeChoicePanel")
            .findByLabelText("Use high contrast")
            .click({ force: true }); // force click because the size of the checkbox is zero

        cy.closeDialog();

        cy.get(".mx_GenericEventListSummary").within(() => {
            // Assert that $secondary-content is specified for GELS summary on the high contrast theme
            // $secondary-content on the high contrast theme = #5e6266 = rgb(94, 98, 102)
            cy.get(".mx_TextualEvent.mx_GenericEventListSummary_summary")
                .should("have.css", "color", "rgb(94, 98, 102)")
                .should("have.css", "opacity", "1");
        });
    });
});

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

describe("Appearance user settings tab", () => {
    let homeserver: HomeserverInstance;

    beforeEach(() => {
        cy.startHomeserver("default").then((data) => {
            homeserver = data;
            cy.initTestUser(homeserver, "Hanako");
        });
    });

    afterEach(() => {
        cy.stopHomeserver(homeserver);
    });

    it("should be rendered properly", () => {
        cy.openUserSettings("Appearance");

        cy.findByTestId("mx_AppearanceUserSettingsTab").within(() => {
            cy.get("h2").should("have.text", "Customise your appearance").should("be.visible");
        });

        cy.findByTestId("mx_AppearanceUserSettingsTab").percySnapshotElement(
            "User settings tab - Appearance (advanced options collapsed)",
            {
                // Emulate TabbedView's actual min and max widths
                // 580: '.mx_UserSettingsDialog .mx_TabbedView' min-width
                // 796: 1036 (mx_TabbedView_tabsOnLeft actual width) - 240 (mx_TabbedView_tabPanel margin-right)
                widths: [580, 796],
            },
        );

        // Click "Show advanced" link button
        cy.findByRole("button", { name: "Show advanced" }).click();

        // Assert that "Hide advanced" link button is rendered
        cy.findByRole("button", { name: "Hide advanced" }).should("exist");

        cy.findByTestId("mx_AppearanceUserSettingsTab").percySnapshotElement(
            "User settings tab - Appearance (advanced options expanded)",
            {
                // Emulate TabbedView's actual min and max widths
                // 580: '.mx_UserSettingsDialog .mx_TabbedView' min-width
                // 796: 1036 (mx_TabbedView_tabsOnLeft actual width) - 240 (mx_TabbedView_tabPanel margin-right)
                widths: [580, 796],
            },
        );
    });

    it("should support switching layouts", () => {
        // Create and view a room first
        cy.createRoom({ name: "Test Room" }).viewRoomByName("Test Room");

        cy.openUserSettings("Appearance");

        cy.get(".mx_LayoutSwitcher_RadioButtons").within(() => {
            // Assert that the layout selected by default is "Modern"
            cy.get(".mx_LayoutSwitcher_RadioButton_selected .mx_StyledRadioButton_enabled").within(() => {
                cy.findByLabelText("Modern").should("exist");
            });
        });

        // Assert that the room layout is set to group (modern) layout
        cy.get(".mx_RoomView_body[data-layout='group']").should("exist");

        cy.get(".mx_LayoutSwitcher_RadioButtons").within(() => {
            // Select the first layout
            cy.get(".mx_LayoutSwitcher_RadioButton").first().click();

            // Assert that the layout selected is "IRC (Experimental)"
            cy.get(".mx_LayoutSwitcher_RadioButton_selected .mx_StyledRadioButton_enabled").within(() => {
                cy.findByLabelText("IRC (Experimental)").should("exist");
            });
        });

        // Assert that the room layout is set to IRC layout
        cy.get(".mx_RoomView_body[data-layout='irc']").should("exist");

        cy.get(".mx_LayoutSwitcher_RadioButtons").within(() => {
            // Select the last layout
            cy.get(".mx_LayoutSwitcher_RadioButton").last().click();

            // Assert that the layout selected is "Message bubbles"
            cy.get(".mx_LayoutSwitcher_RadioButton_selected .mx_StyledRadioButton_enabled").within(() => {
                cy.findByLabelText("Message bubbles").should("exist");
            });
        });

        // Assert that the room layout is set to bubble layout
        cy.get(".mx_RoomView_body[data-layout='bubble']").should("exist");
    });

    it("should support changing font size by clicking the font slider", () => {
        cy.openUserSettings("Appearance");

        cy.findByTestId("mx_AppearanceUserSettingsTab").within(() => {
            cy.get(".mx_FontScalingPanel_fontSlider").within(() => {
                cy.findByLabelText("Font size").should("exist");
            });

            cy.get(".mx_FontScalingPanel_fontSlider").within(() => {
                // Click the left position of the slider
                cy.get("input").realClick({ position: "left" });

                // Assert that the smallest font size is selected
                cy.get("input[value='13']").should("exist");
                cy.get("output .mx_Slider_selection_label").findByText("13");
            });

            cy.get(".mx_FontScalingPanel_fontSlider").percySnapshotElement("Font size slider - smallest (13)", {
                widths: [486], // actual size (content-box, including inline padding)
            });

            cy.get(".mx_FontScalingPanel_fontSlider").within(() => {
                // Click the right position of the slider
                cy.get("input").realClick({ position: "right" });

                // Assert that the largest font size is selected
                cy.get("input[value='18']").should("exist");
                cy.get("output .mx_Slider_selection_label").findByText("18");
            });

            cy.get(".mx_FontScalingPanel_fontSlider").percySnapshotElement("Font size slider - largest (18)", {
                widths: [486],
            });
        });
    });

    it("should disable font size slider when custom font size is used", () => {
        cy.openUserSettings("Appearance");

        cy.findByTestId("mx_FontScalingPanel").within(() => {
            cy.findByLabelText("Use custom size").click({ force: true }); // force click as checkbox size is zero

            // Assert that the font slider is disabled
            cy.get(".mx_FontScalingPanel_fontSlider input[disabled]").should("exist");
        });
    });

    it("should support enabling compact group (modern) layout", () => {
        // Create and view a room first
        cy.createRoom({ name: "Test Room" }).viewRoomByName("Test Room");

        cy.openUserSettings("Appearance");

        // Click "Show advanced" link button
        cy.findByRole("button", { name: "Show advanced" }).click();

        // force click as checkbox size is zero
        cy.findByLabelText("Use a more compact 'Modern' layout").click({ force: true });

        // Assert that the room layout is set to compact group (modern) layout
        cy.get("#matrixchat .mx_MatrixChat_wrapper.mx_MatrixChat_useCompactLayout").should("exist");
    });

    it("should disable compact group (modern) layout option on IRC layout and bubble layout", () => {
        const checkDisabled = () => {
            cy.findByLabelText("Use a more compact 'Modern' layout").should("be.disabled");
        };

        cy.openUserSettings("Appearance");

        // Click "Show advanced" link button
        cy.findByRole("button", { name: "Show advanced" }).click();

        // Enable IRC layout
        cy.get(".mx_LayoutSwitcher_RadioButtons").within(() => {
            // Select the first layout
            cy.get(".mx_LayoutSwitcher_RadioButton").first().click();

            // Assert that the layout selected is "IRC (Experimental)"
            cy.get(".mx_LayoutSwitcher_RadioButton_selected .mx_StyledRadioButton_enabled").within(() => {
                cy.findByLabelText("IRC (Experimental)").should("exist");
            });
        });

        checkDisabled();

        // Enable bubble layout
        cy.get(".mx_LayoutSwitcher_RadioButtons").within(() => {
            // Select the first layout
            cy.get(".mx_LayoutSwitcher_RadioButton").last().click();

            // Assert that the layout selected is "IRC (Experimental)"
            cy.get(".mx_LayoutSwitcher_RadioButton_selected .mx_StyledRadioButton_enabled").within(() => {
                cy.findByLabelText("Message bubbles").should("exist");
            });
        });

        checkDisabled();
    });

    it("should support enabling system font", () => {
        cy.openUserSettings("Appearance");

        // Click "Show advanced" link button
        cy.findByRole("button", { name: "Show advanced" }).click();

        // force click as checkbox size is zero
        cy.findByLabelText("Use a system font").click({ force: true });

        // Assert that the font-family value was removed
        cy.get("body").should("have.css", "font-family", '""');
    });

    describe("Theme Choice Panel", () => {
        beforeEach(() => {
            // Disable the default theme for consistency in case ThemeWatcher automatically chooses it
            cy.setSettingValue("use_system_theme", null, SettingLevel.DEVICE, false);
        });

        it("should be rendered with the light theme selected", () => {
            cy.openUserSettings("Appearance")
                .findByTestId("mx_ThemeChoicePanel")
                .within(() => {
                    cy.findByTestId("checkbox-use-system-theme").within(() => {
                        cy.findByText("Match system theme").should("be.visible");

                        // Assert that 'Match system theme' is not checked
                        // Note that mx_Checkbox_checkmark exists and is hidden by CSS if it is not checked
                        cy.get(".mx_Checkbox_checkmark").should("not.be.visible");
                    });

                    cy.findByTestId("theme-choice-panel-selectors").within(() => {
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
                    .findByTestId("mx_ThemeChoicePanel")
                    .findByLabelText("Match system theme")
                    .click({ force: true }); // force click because the size of the checkbox is zero

                cy.findByTestId("mx_ThemeChoicePanel").within(() => {
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

        it(
            "should not render the checkbox and the label for the high contrast theme " +
                "if the dark theme is selected",
            () => {
                cy.openUserSettings("Appearance");

                // Assert that the checkbox and the label to enable the high contrast theme should exist
                cy.findByLabelText("Use high contrast").should("exist");

                // Enable the dark theme
                cy.get(".mx_ThemeSelector_dark").click();

                // Assert that the checkbox and the label should not exist
                cy.findByLabelText("Use high contrast").should("not.exist");
            },
        );

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
                .findByTestId("mx_ThemeChoicePanel")
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
});

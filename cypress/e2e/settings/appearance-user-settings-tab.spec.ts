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

        cy.get(".mx_SettingsTab.mx_AppearanceUserSettingsTab").within(() => {
            // Assert that the top heading is rendered
            cy.findByTestId("appearance").should("have.text", "Customise your appearance").should("be.visible");
        });

        cy.get(".mx_SettingsTab.mx_AppearanceUserSettingsTab").percySnapshotElement(
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

        cy.get(".mx_SettingsTab.mx_AppearanceUserSettingsTab").percySnapshotElement(
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

        cy.get(".mx_AppearanceUserSettingsTab .mx_LayoutSwitcher_RadioButtons").within(() => {
            // Assert that the layout selected by default is "Modern"
            cy.get(".mx_LayoutSwitcher_RadioButton_selected .mx_StyledRadioButton_enabled").within(() => {
                cy.findByLabelText("Modern").should("exist");
            });
        });

        // Assert that the room layout is set to group (modern) layout
        cy.get(".mx_RoomView_body[data-layout='group']").should("exist");

        cy.get(".mx_AppearanceUserSettingsTab .mx_LayoutSwitcher_RadioButtons").within(() => {
            // Select the first layout
            cy.get(".mx_LayoutSwitcher_RadioButton").first().click();

            // Assert that the layout selected is "IRC (Experimental)"
            cy.get(".mx_LayoutSwitcher_RadioButton_selected .mx_StyledRadioButton_enabled").within(() => {
                cy.findByLabelText("IRC (Experimental)").should("exist");
            });
        });

        // Assert that the room layout is set to IRC layout
        cy.get(".mx_RoomView_body[data-layout='irc']").should("exist");

        cy.get(".mx_AppearanceUserSettingsTab .mx_LayoutSwitcher_RadioButtons").within(() => {
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

        cy.get(".mx_SettingsTab.mx_AppearanceUserSettingsTab").within(() => {
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

        cy.get(".mx_FontScalingPanel").within(() => {
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

        cy.get(".mx_AppearanceUserSettingsTab_Advanced").within(() => {
            // force click as checkbox size is zero
            cy.findByLabelText("Use a more compact 'Modern' layout").click({ force: true });
        });

        // Assert that the room layout is set to compact group (modern) layout
        cy.get("#matrixchat .mx_MatrixChat_wrapper.mx_MatrixChat_useCompactLayout").should("exist");
    });

    it("should disable compact group (modern) layout option on IRC layout and bubble layout", () => {
        const checkDisabled = () => {
            cy.get(".mx_AppearanceUserSettingsTab_Advanced").within(() => {
                cy.get(".mx_Checkbox")
                    .first()
                    .within(() => {
                        cy.get("input[type='checkbox'][disabled]").should("exist");
                    });
            });
        };

        cy.openUserSettings("Appearance");

        // Click "Show advanced" link button
        cy.findByRole("button", { name: "Show advanced" }).click();

        // Enable IRC layout
        cy.get(".mx_AppearanceUserSettingsTab .mx_LayoutSwitcher_RadioButtons").within(() => {
            // Select the first layout
            cy.get(".mx_LayoutSwitcher_RadioButton").first().click();

            // Assert that the layout selected is "IRC (Experimental)"
            cy.get(".mx_LayoutSwitcher_RadioButton_selected .mx_StyledRadioButton_enabled").within(() => {
                cy.findByLabelText("IRC (Experimental)").should("exist");
            });
        });

        checkDisabled();

        // Enable bubble layout
        cy.get(".mx_AppearanceUserSettingsTab .mx_LayoutSwitcher_RadioButtons").within(() => {
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

        cy.get(".mx_AppearanceUserSettingsTab_Advanced").within(() => {
            // force click as checkbox size is zero
            cy.findByLabelText("Use a system font").click({ force: true });
        });

        // Assert that the font-family value was removed
        cy.get("body").should("have.css", "font-family", '""');
    });
});

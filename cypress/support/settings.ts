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

import Chainable = Cypress.Chainable;

declare global {
    // eslint-disable-next-line @typescript-eslint/no-namespace
    namespace Cypress {
        interface Chainable {
            /**
             * Open the top left user menu, returning a handle to the resulting context menu.
             */
            openUserMenu(): Chainable<JQuery<HTMLElement>>;

            /**
             * Open user settings (via user menu), returning a handle to the resulting dialog.
             * @param tab the name of the tab to switch to after opening, optional.
             */
            openUserSettings(tab?: string): Chainable<JQuery<HTMLElement>>;

            /**
             * Open room settings (via room header menu), returning a handle to the resulting dialog.
             * @param tab the name of the tab to switch to after opening, optional.
             */
            openRoomSettings(tab?: string): Chainable<JQuery<HTMLElement>>;

            /**
             * Switch settings tab to the one by the given name, ideally call this in the context of the dialog.
             * @param tab the name of the tab to switch to.
             */
            switchTab(tab: string): Chainable<JQuery<HTMLElement>>;

            /**
             * Close dialog, ideally call this in the context of the dialog.
             */
            closeDialog(): Chainable<JQuery<HTMLElement>>;

            /**
             * Join the given beta, the `Labs` tab must already be opened,
             * ideally call this in the context of the dialog.
             * @param name the name of the beta to join.
             */
            joinBeta(name: string): Chainable<JQuery<HTMLElement>>;

            /**
             * Leave the given beta, the `Labs` tab must already be opened,
             * ideally call this in the context of the dialog.
             * @param name the name of the beta to leave.
             */
            leaveBeta(name: string): Chainable<JQuery<HTMLElement>>;
        }
    }
}

Cypress.Commands.add("openUserMenu", (): Chainable<JQuery<HTMLElement>> => {
    cy.get('[aria-label="User menu"]').click();
    return cy.get(".mx_ContextualMenu");
});

Cypress.Commands.add("openUserSettings", (tab?: string): Chainable<JQuery<HTMLElement>> => {
    cy.openUserMenu().within(() => {
        cy.get('[aria-label="All settings"]').click();
    });
    return cy.get(".mx_UserSettingsDialog").within(() => {
        if (tab) {
            cy.switchTab(tab);
        }
    });
});

Cypress.Commands.add("openRoomSettings", (tab?: string): Chainable<JQuery<HTMLElement>> => {
    cy.get(".mx_RoomHeader_name").click();
    cy.get(".mx_RoomTile_contextMenu").within(() => {
        cy.get('[aria-label="Settings"]').click();
    });
    return cy.get(".mx_RoomSettingsDialog").within(() => {
        if (tab) {
            cy.switchTab(tab);
        }
    });
});

Cypress.Commands.add("switchTab", (tab: string): Chainable<JQuery<HTMLElement>> => {
    return cy.get(".mx_TabbedView_tabLabels").within(() => {
        cy.get(".mx_TabbedView_tabLabel").contains(tab).click();
    });
});

Cypress.Commands.add("closeDialog", (): Chainable<JQuery<HTMLElement>> => {
    return cy.get('[aria-label="Close dialog"]').click();
});

Cypress.Commands.add("joinBeta", (name: string): Chainable<JQuery<HTMLElement>> => {
    return cy.get(".mx_BetaCard_title").contains(name).closest(".mx_BetaCard").within(() => {
        return cy.get(".mx_BetaCard_buttons").contains("Join the beta").click();
    });
});

Cypress.Commands.add("leaveBeta", (name: string): Chainable<JQuery<HTMLElement>> => {
    return cy.get(".mx_BetaCard_title").contains(name).closest(".mx_BetaCard").within(() => {
        return cy.get(".mx_BetaCard_buttons").contains("Leave the beta").click();
    });
});

// Needed to make this file a module
export { };

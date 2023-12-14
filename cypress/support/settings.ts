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
import Loggable = Cypress.Loggable;
import Timeoutable = Cypress.Timeoutable;
import Withinable = Cypress.Withinable;
import Shadow = Cypress.Shadow;
import type { SettingLevel } from "../../src/settings/SettingLevel";
import ApplicationWindow = Cypress.ApplicationWindow;

export enum Filter {
    People = "people",
    PublicRooms = "public_rooms",
}

declare global {
    // eslint-disable-next-line @typescript-eslint/no-namespace
    namespace Cypress {
        interface Chainable {
            /**
             * Returns the SettingsStore
             */
            getSettingsStore(): Chainable<ApplicationWindow["mxSettingsStore"] | undefined>;
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
             * Switch settings tab to the one by the given name, ideally call this in the context of the dialog.
             * @param tab the name of the tab to switch to.
             */
            switchTab(tab: string): Chainable<JQuery<HTMLElement>>;

            /**
             * Close dialog, ideally call this in the context of the dialog.
             */
            closeDialog(): Chainable<JQuery<HTMLElement>>;

            /**
             * Sets the value for a setting. The room ID is optional if the
             * setting is not being set for a particular room, otherwise it
             * should be supplied. The value may be null to indicate that the
             * level should no longer have an override.
             * @param {string} settingName The name of the setting to change.
             * @param {String} roomId The room ID to change the value in, may be
             * null.
             * @param {SettingLevel} level The level to change the value at.
             * @param {*} value The new value of the setting, may be null.
             * @return {Promise} Resolves when the setting has been changed.
             */
            setSettingValue(settingName: string, roomId: string, level: SettingLevel, value: any): Chainable<void>;

            /**
             * Opens the spotlight dialog
             */
            openSpotlightDialog(
                options?: Partial<Loggable & Timeoutable & Withinable & Shadow>,
            ): Chainable<JQuery<HTMLElement>>;
            spotlightDialog(
                options?: Partial<Loggable & Timeoutable & Withinable & Shadow>,
            ): Chainable<JQuery<HTMLElement>>;
            spotlightFilter(
                filter: Filter | null,
                options?: Partial<Loggable & Timeoutable & Withinable & Shadow>,
            ): Chainable<JQuery<HTMLElement>>;
            spotlightSearch(
                options?: Partial<Loggable & Timeoutable & Withinable & Shadow>,
            ): Chainable<JQuery<HTMLElement>>;
            spotlightResults(
                options?: Partial<Loggable & Timeoutable & Withinable & Shadow>,
            ): Chainable<JQuery<HTMLElement>>;
        }
    }
}

Cypress.Commands.add("getSettingsStore", (): Chainable<ApplicationWindow["mxSettingsStore"]> => {
    return cy.window({ log: false }).then((win) => win.mxSettingsStore);
});

Cypress.Commands.add(
    "setSettingValue",
    (name: string, roomId: string, level: SettingLevel, value: any): Chainable<void> => {
        return cy.getSettingsStore().then((store: ApplicationWindow["mxSettingsStore"]) => {
            return cy.wrap(store.setValue(name, roomId, level, value));
        });
    },
);

Cypress.Commands.add("openUserMenu", (): Chainable<JQuery<HTMLElement>> => {
    cy.findByRole("button", { name: "User menu" }).click();
    return cy.get(".mx_ContextualMenu");
});

Cypress.Commands.add("openUserSettings", (tab?: string): Chainable<JQuery<HTMLElement>> => {
    cy.openUserMenu().within(() => {
        cy.findByRole("menuitem", { name: "All settings" }).click();
    });
    return cy.get(".mx_UserSettingsDialog").within(() => {
        if (tab) {
            cy.switchTab(tab);
        }
    });
});

Cypress.Commands.add("switchTab", (tab: string): Chainable<JQuery<HTMLElement>> => {
    return cy.get(".mx_TabbedView_tabLabels").within(() => {
        cy.contains(".mx_TabbedView_tabLabel", tab).click();
    });
});

Cypress.Commands.add("closeDialog", (): Chainable<JQuery<HTMLElement>> => {
    return cy.findByRole("button", { name: "Close dialog" }).click();
});

Cypress.Commands.add(
    "openSpotlightDialog",
    (options?: Partial<Loggable & Timeoutable & Withinable & Shadow>): Chainable<JQuery<HTMLElement>> => {
        cy.get(".mx_RoomSearch_spotlightTrigger", options).click({ force: true });
        return cy.spotlightDialog(options);
    },
);

Cypress.Commands.add(
    "spotlightDialog",
    (options?: Partial<Loggable & Timeoutable & Withinable & Shadow>): Chainable<JQuery<HTMLElement>> => {
        return cy.get('[role=dialog][aria-label="Search Dialog"]', options);
    },
);

Cypress.Commands.add(
    "spotlightFilter",
    (
        filter: Filter | null,
        options?: Partial<Loggable & Timeoutable & Withinable & Shadow>,
    ): Chainable<JQuery<HTMLElement>> => {
        let selector: string;
        switch (filter) {
            case Filter.People:
                selector = "#mx_SpotlightDialog_button_startChat";
                break;
            case Filter.PublicRooms:
                selector = "#mx_SpotlightDialog_button_explorePublicRooms";
                break;
            default:
                selector = ".mx_SpotlightDialog_filter";
                break;
        }
        return cy.get(selector, options).click();
    },
);

Cypress.Commands.add(
    "spotlightSearch",
    (options?: Partial<Loggable & Timeoutable & Withinable & Shadow>): Chainable<JQuery<HTMLElement>> => {
        return cy.get(".mx_SpotlightDialog_searchBox", options).findByRole("textbox", { name: "Search" });
    },
);

Cypress.Commands.add(
    "spotlightResults",
    (options?: Partial<Loggable & Timeoutable & Withinable & Shadow>): Chainable<JQuery<HTMLElement>> => {
        return cy.get(".mx_SpotlightDialog_section.mx_SpotlightDialog_results .mx_SpotlightDialog_option", options);
    },
);

// Needed to make this file a module
export {};

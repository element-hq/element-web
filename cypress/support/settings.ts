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
import type { SettingLevel } from "../../src/settings/SettingLevel";
import type SettingsStore from "../../src/settings/SettingsStore";

declare global {
    // eslint-disable-next-line @typescript-eslint/no-namespace
    namespace Cypress {
        interface Chainable {
            /**
             * Returns the SettingsStore
             */
            getSettingsStore(): Chainable<typeof SettingsStore | undefined>; // XXX: Importing SettingsStore causes a bunch of type lint errors
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
             * Gets the value of a setting. The room ID is optional if the
             * setting is not to be applied to any particular room, otherwise it
             * should be supplied.
             * @param {string} settingName The name of the setting to read the
             * value of.
             * @param {String} roomId The room ID to read the setting value in,
             * may be null.
             * @param {boolean} excludeDefault True to disable using the default
             * value.
             * @return {*} The value, or null if not found
             */
            getSettingValue<T>(settingName: string, roomId?: string, excludeDefault?: boolean): Chainable<T>;
        }
    }
}

Cypress.Commands.add("getSettingsStore", (): Chainable<typeof SettingsStore> => {
    return cy.window({ log: false }).then((win) => win.mxSettingsStore);
});

Cypress.Commands.add(
    "setSettingValue",
    (name: string, roomId: string, level: SettingLevel, value: any): Chainable<void> => {
        return cy.getSettingsStore().then((store: typeof SettingsStore) => {
            return cy.wrap(store.setValue(name, roomId, level, value));
        });
    },
);

// eslint-disable-next-line max-len
Cypress.Commands.add(
    "getSettingValue",
    <T = any>(name: string, roomId?: string, excludeDefault?: boolean): Chainable<T> => {
        return cy.getSettingsStore().then((store: typeof SettingsStore) => {
            return store.getValue(name, roomId, excludeDefault);
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

Cypress.Commands.add("openRoomSettings", (tab?: string): Chainable<JQuery<HTMLElement>> => {
    cy.findByRole("button", { name: "Room options" }).click();
    cy.get(".mx_RoomTile_contextMenu").within(() => {
        cy.findByRole("menuitem", { name: "Settings" }).click();
    });
    return cy.get(".mx_RoomSettingsDialog").within(() => {
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

Cypress.Commands.add("joinBeta", (name: string): Chainable<JQuery<HTMLElement>> => {
    return cy
        .contains(".mx_BetaCard_title", name)
        .closest(".mx_BetaCard")
        .within(() => {
            return cy.get(".mx_BetaCard_buttons").findByRole("button", { name: "Join the beta" }).click();
        });
});

Cypress.Commands.add("leaveBeta", (name: string): Chainable<JQuery<HTMLElement>> => {
    return cy
        .contains(".mx_BetaCard_title", name)
        .closest(".mx_BetaCard")
        .within(() => {
            return cy.get(".mx_BetaCard_buttons").findByRole("button", { name: "Leave the beta" }).click();
        });
});

// Needed to make this file a module
export {};

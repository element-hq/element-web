/*
Copyright 2023 The Matrix.org Foundation C.I.C.

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
             * Finds an element with the role "button".
             *
             * @param name - accessible name of the element to find
             */
            findButton(name: string): Chainable<JQuery>;
            /**
             * Finds an element with the role "textbox".
             *
             * @param name - accessible name of the element to find
             */
            findTextbox(name: string): Chainable<JQuery>;
            /**
             * Finds an element with the role "option".
             *
             * @param name - accessible name of the element to find
             */
            findOption(name: string): Chainable<JQuery>;
            /**
             * Finds an element with the role "menuitem".
             *
             * @param name - accessible name of the element to find
             */
            findMenuitem(name: string): Chainable<JQuery>;
        }
    }
}

Cypress.Commands.add("findButton", (name: string): Chainable<JQuery> => {
    return cy.findByRole("button", { name });
});

Cypress.Commands.add("findTextbox", (name: string): Chainable<JQuery> => {
    return cy.findByRole("textbox", { name });
});

Cypress.Commands.add("findOption", (name: string): Chainable<JQuery> => {
    return cy.findByRole("option", { name });
});

Cypress.Commands.add("findMenuitem", (name: string): Chainable<JQuery> => {
    return cy.findByRole("menuitem", { name });
});

// Needed to make this file a module
export {};

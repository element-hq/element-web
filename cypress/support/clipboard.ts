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

// Mock the clipboard, as only Electron gives the app permission to the clipboard API by default
// Virtual clipboard
let copyText: string;

declare global {
    // eslint-disable-next-line @typescript-eslint/no-namespace
    namespace Cypress {
        interface Chainable {
            /**
             * Mock the clipboard on the current window, ready for calling `getClipboardText`.
             * Irreversible, refresh the window to restore mock.
             */
            mockClipboard(): Chainable<AUTWindow>;
            /**
             * Read text from the mocked clipboard.
             * @return {string} the clipboard text
             */
            getClipboardText(): Chainable<string>;
        }
    }
}

Cypress.Commands.add("mockClipboard", () => {
    cy.window({ log: false }).then((win) => {
        win.navigator.clipboard.writeText = (text) => {
            copyText = text;
            return Promise.resolve();
        };
    });
});

Cypress.Commands.add("getClipboardText", (): Chainable<string> => {
    return cy.wrap(copyText);
});

// Needed to make this file a module
export {};

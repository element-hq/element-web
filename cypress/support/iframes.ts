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
             * Gets you into the `body` of the selectable iframe. Best to call
             * `within({}, () => { ... })` on the returned Chainable to access
             * further elements.
             * @param selector The jquery selector to find the frame with.
             */
            accessIframe(selector: string): Chainable<JQuery<HTMLElement>>;
        }
    }
}

// Inspired by https://www.cypress.io/blog/2020/02/12/working-with-iframes-in-cypress/
Cypress.Commands.add("accessIframe", (selector: string): Chainable<JQuery<HTMLElement>> => {
    return (
        cy
            .get(selector)
            .its("0.contentDocument.body")
            .should("not.be.empty")
            // Cypress loses types in the mess of wrapping, so force cast
            .then(cy.wrap) as Chainable<JQuery<HTMLElement>>
    );
});

// Needed to make this file a module
export {};

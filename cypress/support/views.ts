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
             * Opens the given room by name. The room must be visible in the
             * room list.
             * @param name The room name to find and click on/open.
             */
            viewRoomByName(name: string): Chainable<JQuery<HTMLElement>>;
        }
    }
}

Cypress.Commands.add("viewRoomByName", (name: string): Chainable<JQuery<HTMLElement>> => {
    return cy.get(`.mx_RoomTile[aria-label="${name}"]`).click();
});

// Needed to make this file a module
export { };

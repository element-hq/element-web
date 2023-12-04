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
             * room list, but the room list may be folded horizontally, and the
             * room may contain unread messages.
             *
             * @param name The exact room name to find and click on/open.
             */
            viewRoomByName(name: string): Chainable<JQuery<HTMLElement>>;

            /**
             * Opens the given room by room ID.
             *
             * This works by browsing to `/#/room/${id}`, so it will also work for room aliases.
             *
             * @param id
             */
            viewRoomById(id: string): void;
        }
    }
}

Cypress.Commands.add("viewRoomByName", (name: string): Chainable<JQuery<HTMLElement>> => {
    // We look for the room inside the room list, which is a tree called Rooms.
    //
    // There are 3 cases:
    // - the room list is folded:
    //     then the aria-label on the room tile is the name (with nothing extra)
    // - the room list is unfolder and the room has messages:
    //     then the aria-label contains the unread count, but the title of the
    //     div inside the titleContainer equals the room name
    // - the room list is unfolded and the room has no messages:
    //     then the aria-label is the name and so is the title of a div
    //
    // So by matching EITHER title=name OR aria-label=name we find this exact
    // room in all three cases.
    return cy.findByRole("tree", { name: "Rooms" }).find(`[title="${name}"],[aria-label="${name}"]`).first().click();
});

Cypress.Commands.add("viewRoomById", (id: string): void => {
    cy.visit(`/#/room/${id}`);
});

// Needed to make this file a module
export {};

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
            // Scroll to the top of the timeline
            scrollToTop(): void;
            // Find the event tile matching the given sender & body
            findEventTile(sender: string, body: string): Chainable<JQuery>;
        }
    }
}

export interface Message {
    sender: string;
    body: string;
    encrypted: boolean;
    continuation: boolean;
}

Cypress.Commands.add("scrollToTop", (): void => {
    cy.get(".mx_RoomView_timeline .mx_ScrollPanel")
        .scrollTo("top", { duration: 100 })
        .then((ref) => {
            if (ref.scrollTop() > 0) {
                return cy.scrollToTop();
            }
        });
});

Cypress.Commands.add("findEventTile", (sender: string, body: string): Chainable<JQuery> => {
    // We can't just use a bunch of `.contains` here due to continuations meaning that the events don't
    // have their own rendered sender displayname so we have to walk the list to keep track of the sender.
    return cy.get(".mx_RoomView_MessageList .mx_EventTile").then((refs) => {
        let latestSender: string;
        for (let i = 0; i < refs.length; i++) {
            const ref = refs.eq(i);
            const displayName = ref.find(".mx_DisambiguatedProfile_displayName");
            if (displayName) {
                latestSender = displayName.text();
            }

            if (latestSender === sender && ref.find(".mx_EventTile_body").text() === body) {
                return ref;
            }
        }
    });
});

// Needed to make this file a module
export {};

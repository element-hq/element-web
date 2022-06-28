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

import { MatrixClient } from "../../global";
import { SynapseInstance } from "../../plugins/synapsedocker";
import Chainable = Cypress.Chainable;
import Loggable = Cypress.Loggable;
import Timeoutable = Cypress.Timeoutable;
import Withinable = Cypress.Withinable;
import Shadow = Cypress.Shadow;

export enum Filter {
    People = "people",
    PublicRooms = "public_rooms"
}

declare global {
    // eslint-disable-next-line @typescript-eslint/no-namespace
    namespace Cypress {
        interface Chainable {
            /**
             * Opens the spotlight dialog
             */
            openSpotlightDialog(
                options?: Partial<Loggable & Timeoutable & Withinable & Shadow>
            ): Chainable<JQuery<HTMLElement>>;
            spotlightDialog(
                options?: Partial<Loggable & Timeoutable & Withinable & Shadow>
            ): Chainable<JQuery<HTMLElement>>;
            spotlightFilter(
                filter: Filter | null,
                options?: Partial<Loggable & Timeoutable & Withinable & Shadow>
            ): Chainable<JQuery<HTMLElement>>;
            spotlightSearch(
                options?: Partial<Loggable & Timeoutable & Withinable & Shadow>
            ): Chainable<JQuery<HTMLElement>>;
            spotlightResults(
                options?: Partial<Loggable & Timeoutable & Withinable & Shadow>
            ): Chainable<JQuery<HTMLElement>>;
            roomHeaderName(
                options?: Partial<Loggable & Timeoutable & Withinable & Shadow>
            ): Chainable<JQuery<HTMLElement>>;
        }
    }
}

Cypress.Commands.add("openSpotlightDialog", (
    options?: Partial<Loggable & Timeoutable & Withinable & Shadow>,
): Chainable<JQuery<HTMLElement>> => {
    cy.get('.mx_RoomSearch_spotlightTrigger', options).click({ force: true });
    return cy.spotlightDialog(options);
});

Cypress.Commands.add("spotlightDialog", (
    options?: Partial<Loggable & Timeoutable & Withinable & Shadow>,
): Chainable<JQuery<HTMLElement>> => {
    return cy.get('[role=dialog][aria-label="Search Dialog"]', options);
});

Cypress.Commands.add("spotlightFilter", (
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
});

Cypress.Commands.add("spotlightSearch", (
    options?: Partial<Loggable & Timeoutable & Withinable & Shadow>,
): Chainable<JQuery<HTMLElement>> => {
    return cy.get(".mx_SpotlightDialog_searchBox input", options);
});

Cypress.Commands.add("spotlightResults", (
    options?: Partial<Loggable & Timeoutable & Withinable & Shadow>,
): Chainable<JQuery<HTMLElement>> => {
    return cy.get(".mx_SpotlightDialog_section.mx_SpotlightDialog_results .mx_SpotlightDialog_option", options);
});

Cypress.Commands.add("roomHeaderName", (
    options?: Partial<Loggable & Timeoutable & Withinable & Shadow>,
): Chainable<JQuery<HTMLElement>> => {
    return cy.get(".mx_RoomHeader_nametext", options);
});

describe("Spotlight", () => {
    let synapse: SynapseInstance;

    const bot1Name = "BotBob";
    let bot1: MatrixClient;

    const bot2Name = "ByteBot";
    let bot2: MatrixClient;

    const room1Name = "247";
    let room1Id: string;

    const room2Name = "Lounge";
    let room2Id: string;

    beforeEach(() => {
        cy.startSynapse("default").then(data => {
            synapse = data;
            cy.initTestUser(synapse, "Jim").then(() =>
                cy.getBot(synapse, bot1Name).then(_bot1 => {
                    bot1 = _bot1;
                }),
            ).then(() =>
                cy.getBot(synapse, bot2Name).then(_bot2 => {
                    // eslint-disable-next-line @typescript-eslint/no-unused-vars
                    bot2 = _bot2;
                }),
            ).then(() =>
                cy.window({ log: false }).then(({ matrixcs: { Visibility } }) => {
                    cy.createRoom({ name: room1Name, visibility: Visibility.Public }).then(_room1Id => {
                        room1Id = _room1Id;
                        cy.inviteUser(room1Id, bot1.getUserId());
                        cy.visit("/#/room/" + room1Id);
                    });
                    bot2.createRoom({ name: room2Name, visibility: Visibility.Public })
                        .then(({ room_id: _room2Id }) => {
                            room2Id = _room2Id;
                            bot2.invite(room2Id, bot1.getUserId());
                        });
                }),
            ).then(() =>
                cy.get('.mx_RoomSublist_skeletonUI').should('not.exist'),
            );
        });
    });

    afterEach(() => {
        cy.stopSynapse(synapse);
    });

    it("should be able to add and remove filters via keyboard", () => {
        cy.openSpotlightDialog().within(() => {
            cy.spotlightSearch().type("{downArrow}");
            cy.get("#mx_SpotlightDialog_button_explorePublicRooms").should("have.attr", "aria-selected", "true");
            cy.spotlightSearch().type("{enter}");
            cy.get(".mx_SpotlightDialog_filter").should("contain", "Public rooms");
            cy.spotlightSearch().type("{backspace}");
            cy.get(".mx_SpotlightDialog_filter").should("not.exist");

            cy.spotlightSearch().type("{downArrow}");
            cy.spotlightSearch().type("{downArrow}");
            cy.get("#mx_SpotlightDialog_button_startChat").should("have.attr", "aria-selected", "true");
            cy.spotlightSearch().type("{enter}");
            cy.get(".mx_SpotlightDialog_filter").should("contain", "People");
            cy.spotlightSearch().type("{backspace}");
            cy.get(".mx_SpotlightDialog_filter").should("not.exist");
        });
    });

    it("should find joined rooms", () => {
        cy.openSpotlightDialog().within(() => {
            cy.spotlightSearch().clear().type(room1Name);
            cy.spotlightResults().should("have.length", 1);
            cy.spotlightResults().eq(0).should("contain", room1Name);
            cy.spotlightResults().eq(0).click();
            cy.url().should("contain", room1Id);
        }).then(() => {
            cy.roomHeaderName().should("contain", room1Name);
        });
    });

    it("should find known public rooms", () => {
        cy.openSpotlightDialog().within(() => {
            cy.spotlightFilter(Filter.PublicRooms);
            cy.spotlightSearch().clear().type(room1Name);
            cy.spotlightResults().should("have.length", 1);
            cy.spotlightResults().eq(0).should("contain", room1Name);
            cy.spotlightResults().eq(0).click();
            cy.url().should("contain", room1Id);
        }).then(() => {
            cy.roomHeaderName().should("contain", room1Name);
        });
    });

    it("should find unknown public rooms", () => {
        cy.openSpotlightDialog().within(() => {
            cy.spotlightFilter(Filter.PublicRooms);
            cy.spotlightSearch().clear().type(room2Name);
            cy.spotlightResults().should("have.length", 1);
            cy.spotlightResults().eq(0).should("contain", room2Name);
            cy.spotlightResults().eq(0).click();
            cy.url().should("contain", room2Id);
        }).then(() => {
            cy.get(".mx_RoomPreviewBar_actions .mx_AccessibleButton").click();
            cy.roomHeaderName().should("contain", room2Name);
        });
    });

    // TODO: We currently can’t test finding rooms on other homeservers/other protocols
    // We obviously don’t have federation or bridges in cypress tests
    /*
    const room3Name = "Matrix HQ";
    const room3Id = "#matrix:matrix.org";

    it("should find unknown public rooms on other homeservers", () => {
        cy.openSpotlightDialog().within(() => {
            cy.spotlightFilter(Filter.PublicRooms);
            cy.spotlightSearch().clear().type(room3Name);
            cy.get("[aria-haspopup=true][role=button]").click();
        }).then(() => {
            cy.contains(".mx_GenericDropdownMenu_Option--header", "matrix.org")
                .next("[role=menuitemradio]")
                .click();
            cy.wait(3_600_000);
        }).then(() => cy.spotlightDialog().within(() => {
            cy.spotlightResults().should("have.length", 1);
            cy.spotlightResults().eq(0).should("contain", room3Name);
            cy.spotlightResults().eq(0).should("contain", room3Id);
        }));
    });
    */
    it("should find known people", () => {
        cy.openSpotlightDialog().within(() => {
            cy.spotlightFilter(Filter.People);
            cy.spotlightSearch().clear().type(bot1Name);
            cy.spotlightResults().should("have.length", 1);
            cy.spotlightResults().eq(0).should("contain", bot1Name);
            cy.spotlightResults().eq(0).click();
        }).then(() => {
            cy.roomHeaderName().should("contain", bot1Name);
        });
    });

    it("should find unknown people", () => {
        cy.openSpotlightDialog().within(() => {
            cy.spotlightFilter(Filter.People);
            cy.spotlightSearch().clear().type(bot2Name);
            cy.spotlightResults().should("have.length", 1);
            cy.spotlightResults().eq(0).should("contain", bot2Name);
            cy.spotlightResults().eq(0).click();
        }).then(() => {
            cy.roomHeaderName().should("contain", bot2Name);
        });
    });

    it("should allow opening group chat dialog", () => {
        cy.openSpotlightDialog().within(() => {
            cy.spotlightFilter(Filter.People);
            cy.spotlightSearch().clear().type(bot2Name);
            cy.spotlightResults().should("have.length", 1);
            cy.spotlightResults().eq(0).should("contain", bot2Name);
            cy.get(".mx_SpotlightDialog_startGroupChat").should("contain", "Start a group chat");
            cy.get(".mx_SpotlightDialog_startGroupChat").click();
        }).then(() => {
            cy.get('[role=dialog]').should("contain", "Direct Messages");
        });
    });

    it("should be able to navigate results via keyboard", () => {
        cy.openSpotlightDialog().within(() => {
            cy.spotlightFilter(Filter.People);
            cy.spotlightSearch().clear().type("b");
            // our debouncing logic only starts the search after a short timeout,
            // so we wait a few milliseconds.
            cy.wait(300);
            cy.get(".mx_Spinner").should("not.exist").then(() => {
                cy.spotlightResults().should("have.length", 2).then(() => {
                    cy.spotlightResults().eq(0)
                        .should("have.attr", "aria-selected", "true");
                    cy.spotlightResults().eq(1)
                        .should("have.attr", "aria-selected", "false");
                });
                cy.spotlightSearch().type("{downArrow}").then(() => {
                    cy.spotlightResults().eq(0)
                        .should("have.attr", "aria-selected", "false");
                    cy.spotlightResults().eq(1)
                        .should("have.attr", "aria-selected", "true");
                });
                cy.spotlightSearch().type("{downArrow}").then(() => {
                    cy.spotlightResults().eq(0)
                        .should("have.attr", "aria-selected", "false");
                    cy.spotlightResults().eq(1)
                        .should("have.attr", "aria-selected", "false");
                });
                cy.spotlightSearch().type("{upArrow}").then(() => {
                    cy.spotlightResults().eq(0)
                        .should("have.attr", "aria-selected", "false");
                    cy.spotlightResults().eq(1)
                        .should("have.attr", "aria-selected", "true");
                });
                cy.spotlightSearch().type("{upArrow}").then(() => {
                    cy.spotlightResults().eq(0)
                        .should("have.attr", "aria-selected", "true");
                    cy.spotlightResults().eq(1)
                        .should("have.attr", "aria-selected", "false");
                });
            });
        });
    });
});

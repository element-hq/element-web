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
import { HomeserverInstance } from "../../plugins/utils/homeserver";
import Chainable = Cypress.Chainable;
import Loggable = Cypress.Loggable;
import Timeoutable = Cypress.Timeoutable;
import Withinable = Cypress.Withinable;
import Shadow = Cypress.Shadow;

enum Filter {
    People = "people",
    PublicRooms = "public_rooms",
}

declare global {
    // eslint-disable-next-line @typescript-eslint/no-namespace
    namespace Cypress {
        interface Chainable {
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
            roomHeaderName(
                options?: Partial<Loggable & Timeoutable & Withinable & Shadow>,
            ): Chainable<JQuery<HTMLElement>>;
            startDM(name: string): Chainable<void>;
        }
    }
}

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

Cypress.Commands.add(
    "roomHeaderName",
    (options?: Partial<Loggable & Timeoutable & Withinable & Shadow>): Chainable<JQuery<HTMLElement>> => {
        return cy.get(".mx_RoomHeader_nametext", options);
    },
);

Cypress.Commands.add("startDM", (name: string) => {
    cy.openSpotlightDialog().within(() => {
        cy.spotlightFilter(Filter.People);
        cy.spotlightSearch().clear().type(name);
        cy.wait(1000); // wait for the dialog code to settle
        cy.get(".mx_Spinner").should("not.exist");
        cy.spotlightResults().should("have.length", 1);
        cy.spotlightResults().eq(0).should("contain", name);
        cy.spotlightResults().eq(0).click();
    });
    // send first message to start DM
    cy.findByRole("textbox", { name: "Send a message…" }).should("have.focus").type("Hey!{enter}");
    // The DM room is created at this point, this can take a little bit of time
    cy.get(".mx_EventTile_body", { timeout: 30000 }).findByText("Hey!");
    cy.findByRole("group", { name: "People" }).findByText(name);
});

describe("Spotlight", () => {
    let homeserver: HomeserverInstance;

    const bot1Name = "BotBob";
    let bot1: MatrixClient;

    const bot2Name = "ByteBot";
    let bot2: MatrixClient;

    const room1Name = "247";
    let room1Id: string;

    const room2Name = "Lounge";
    let room2Id: string;

    const room3Name = "Public";
    let room3Id: string;

    beforeEach(() => {
        cy.startHomeserver("default").then((data) => {
            homeserver = data;
            cy.initTestUser(homeserver, "Jim")
                .then(() =>
                    cy.getBot(homeserver, { displayName: bot1Name }).then((_bot1) => {
                        bot1 = _bot1;
                    }),
                )
                .then(() =>
                    cy.getBot(homeserver, { displayName: bot2Name }).then((_bot2) => {
                        // eslint-disable-next-line @typescript-eslint/no-unused-vars
                        bot2 = _bot2;
                    }),
                )
                .then(() =>
                    cy.window({ log: false }).then(({ matrixcs: { Visibility } }) => {
                        cy.createRoom({ name: room1Name, visibility: Visibility.Public }).then(async (_room1Id) => {
                            room1Id = _room1Id;
                            await bot1.joinRoom(room1Id);
                        });
                        bot2.createRoom({ name: room2Name, visibility: Visibility.Public }).then(
                            ({ room_id: _room2Id }) => {
                                room2Id = _room2Id;
                                bot2.invite(room2Id, bot1.getUserId());
                            },
                        );
                        bot2.createRoom({
                            name: room3Name,
                            visibility: Visibility.Public,
                            initial_state: [
                                {
                                    type: "m.room.history_visibility",
                                    state_key: "",
                                    content: {
                                        history_visibility: "world_readable",
                                    },
                                },
                            ],
                        }).then(({ room_id: _room3Id }) => {
                            room3Id = _room3Id;
                            bot2.invite(room3Id, bot1.getUserId());
                        });
                    }),
                )
                .then(() => {
                    cy.visit("/#/room/" + room1Id);
                    cy.get(".mx_RoomSublist_skeletonUI").should("not.exist");
                });
        });
        // wait for the room to have the right name
        cy.get(".mx_RoomHeader").within(() => {
            cy.findByText(room1Name);
        });
    });

    afterEach(() => {
        cy.visit("/#/home");
        cy.stopHomeserver(homeserver);
    });

    it("should be able to add and remove filters via keyboard", () => {
        cy.openSpotlightDialog().within(() => {
            cy.wait(1000); // wait for the dialog to settle, otherwise our keypresses might race with an update

            // initially, publicrooms should be highlighted (because there are no other suggestions)
            cy.get("#mx_SpotlightDialog_button_explorePublicRooms").should("have.attr", "aria-selected", "true");

            // hitting enter should enable the publicrooms filter
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
        cy.openSpotlightDialog()
            .within(() => {
                cy.spotlightSearch().clear().type(room1Name);
                cy.spotlightResults().should("have.length", 1);
                cy.spotlightResults().eq(0).should("contain", room1Name);
                cy.spotlightResults().eq(0).click();
                cy.url().should("contain", room1Id);
            })
            .then(() => {
                cy.roomHeaderName().should("contain", room1Name);
            });
    });

    it("should find known public rooms", () => {
        cy.openSpotlightDialog()
            .within(() => {
                cy.spotlightFilter(Filter.PublicRooms);
                cy.spotlightSearch().clear().type(room1Name);
                cy.spotlightResults().should("have.length", 1);
                cy.spotlightResults().eq(0).should("contain", room1Name);
                cy.spotlightResults().eq(0).should("contain", "View");
                cy.spotlightResults().eq(0).click();
                cy.url().should("contain", room1Id);
            })
            .then(() => {
                cy.roomHeaderName().should("contain", room1Name);
            });
    });

    it("should find unknown public rooms", () => {
        cy.openSpotlightDialog()
            .within(() => {
                cy.spotlightFilter(Filter.PublicRooms);
                cy.spotlightSearch().clear().type(room2Name);
                cy.spotlightResults().should("have.length", 1);
                cy.spotlightResults().eq(0).should("contain", room2Name);
                cy.spotlightResults().eq(0).should("contain", "Join");
                cy.spotlightResults().eq(0).click();
                cy.url().should("contain", room2Id);
            })
            .then(() => {
                cy.get(".mx_RoomView_MessageList").should("have.length", 1);
                cy.roomHeaderName().should("contain", room2Name);
            });
    });

    it("should find unknown public world readable rooms", () => {
        cy.openSpotlightDialog()
            .within(() => {
                cy.spotlightFilter(Filter.PublicRooms);
                cy.spotlightSearch().clear().type(room3Name);
                cy.spotlightResults().should("have.length", 1);
                cy.spotlightResults().eq(0).should("contain", room3Name);
                cy.spotlightResults().eq(0).should("contain", "View");
                cy.spotlightResults().eq(0).click();
                cy.url().should("contain", room3Id);
            })
            .then(() => {
                cy.findByRole("button", { name: "Join the discussion" }).click();
                cy.roomHeaderName().should("contain", room3Name);
            });
    });

    // TODO: We currently can’t test finding rooms on other homeservers/other protocols
    // We obviously don’t have federation or bridges in cypress tests
    it.skip("should find unknown public rooms on other homeservers", () => {
        cy.openSpotlightDialog()
            .within(() => {
                cy.spotlightFilter(Filter.PublicRooms);
                cy.spotlightSearch().clear().type(room3Name);
                cy.get("[aria-haspopup=true][role=button]").click();
            })
            .then(() => {
                cy.contains(".mx_GenericDropdownMenu_Option--header", "matrix.org")
                    .next("[role=menuitemradio]")
                    .click();
                cy.wait(3_600_000);
            })
            .then(() =>
                cy.spotlightDialog().within(() => {
                    cy.spotlightResults().should("have.length", 1);
                    cy.spotlightResults().eq(0).should("contain", room3Name);
                    cy.spotlightResults().eq(0).should("contain", room3Id);
                }),
            );
    });

    it("should find known people", () => {
        cy.openSpotlightDialog()
            .within(() => {
                cy.spotlightFilter(Filter.People);
                cy.spotlightSearch().clear().type(bot1Name);
                cy.spotlightResults().should("have.length", 1);
                cy.spotlightResults().eq(0).should("contain", bot1Name);
                cy.spotlightResults().eq(0).click();
            })
            .then(() => {
                cy.roomHeaderName().should("contain", bot1Name);
            });
    });

    it("should find unknown people", () => {
        cy.openSpotlightDialog()
            .within(() => {
                cy.spotlightFilter(Filter.People);
                cy.spotlightSearch().clear().type(bot2Name);
                cy.spotlightResults().should("have.length", 1);
                cy.spotlightResults().eq(0).should("contain", bot2Name);
                cy.spotlightResults().eq(0).click();
            })
            .then(() => {
                cy.roomHeaderName().should("contain", bot2Name);
            });
    });

    it("should find group DMs by usernames or user ids", () => {
        // First we want to share a room with both bots to ensure we’ve got their usernames cached
        cy.inviteUser(room1Id, bot2.getUserId());

        // Starting a DM with ByteBot (will be turned into a group dm later)
        cy.openSpotlightDialog().within(() => {
            cy.spotlightFilter(Filter.People);
            cy.spotlightSearch().clear().type(bot2Name);
            cy.spotlightResults().should("have.length", 1);
            cy.spotlightResults().eq(0).should("contain", bot2Name);
            cy.spotlightResults().eq(0).click();
        });

        // Send first message to actually start DM
        cy.roomHeaderName().should("contain", bot2Name);
        cy.findByRole("textbox", { name: "Send a message…" }).type("Hey!{enter}");

        // Assert DM exists by checking for the first message and the room being in the room list
        cy.contains(".mx_EventTile_body", "Hey!", { timeout: 30000 });
        cy.findByRole("group", { name: "People" }).should("contain", bot2Name);

        // Invite BotBob into existing DM with ByteBot
        cy.getDmRooms(bot2.getUserId())
            .should("have.length", 1)
            .then((dmRooms) => cy.getClient().then((client) => client.getRoom(dmRooms[0])))
            .then((groupDm) => {
                cy.inviteUser(groupDm.roomId, bot1.getUserId());
                cy.roomHeaderName().should(($element) => expect($element.get(0).innerText).contains(groupDm.name));
                cy.findByRole("group", { name: "People" }).should(($element) =>
                    expect($element.get(0).innerText).contains(groupDm.name),
                );

                // Search for BotBob by id, should return group DM and user
                cy.openSpotlightDialog().within(() => {
                    cy.spotlightFilter(Filter.People);
                    cy.spotlightSearch().clear().type(bot1.getUserId());
                    cy.wait(1000); // wait for the dialog code to settle
                    cy.spotlightResults().should("have.length", 2);
                    cy.contains(
                        ".mx_SpotlightDialog_section.mx_SpotlightDialog_results .mx_SpotlightDialog_option",
                        groupDm.name,
                    );
                });

                // Search for ByteBot by id, should return group DM and user
                cy.openSpotlightDialog().within(() => {
                    cy.spotlightFilter(Filter.People);
                    cy.spotlightSearch().clear().type(bot2.getUserId());
                    cy.wait(1000); // wait for the dialog code to settle
                    cy.spotlightResults().should("have.length", 2);
                    cy.contains(
                        ".mx_SpotlightDialog_section.mx_SpotlightDialog_results .mx_SpotlightDialog_option",
                        groupDm.name,
                    );
                });
            });
    });

    // Test against https://github.com/vector-im/element-web/issues/22851
    it("should show each person result only once", () => {
        cy.openSpotlightDialog().within(() => {
            cy.spotlightFilter(Filter.People);

            // 2 rounds of search to simulate the bug conditions. Specifically, the first search
            // should have 1 result (not 2) and the second search should also have 1 result (instead
            // of the super buggy 3 described by https://github.com/vector-im/element-web/issues/22851)
            //
            // We search for user ID to trigger the profile lookup within the dialog.
            for (let i = 0; i < 2; i++) {
                cy.log("Iteration: " + i);
                cy.spotlightSearch().clear().type(bot1.getUserId());
                cy.wait(1000); // wait for the dialog code to settle
                cy.spotlightResults().should("have.length", 1);
                cy.spotlightResults().eq(0).should("contain", bot1.getUserId());
            }
        });
    });

    it("should allow opening group chat dialog", () => {
        cy.openSpotlightDialog()
            .within(() => {
                cy.spotlightFilter(Filter.People);
                cy.spotlightSearch().clear().type(bot2Name);
                cy.wait(3000); // wait for the dialog code to settle
                cy.spotlightResults().should("have.length", 1);
                cy.spotlightResults().eq(0).should("contain", bot2Name);
                cy.get(".mx_SpotlightDialog_startGroupChat").should("contain", "Start a group chat");
                cy.get(".mx_SpotlightDialog_startGroupChat").click();
            })
            .then(() => {
                cy.findByRole("dialog").should("contain", "Direct Messages");
            });
    });

    it("should close spotlight after starting a DM", () => {
        cy.startDM(bot1Name);
        cy.get(".mx_SpotlightDialog").should("have.length", 0);
    });

    it("should show the same user only once", () => {
        cy.startDM(bot1Name);
        cy.visit("/#/home");

        cy.openSpotlightDialog().within(() => {
            cy.spotlightFilter(Filter.People);
            cy.spotlightSearch().clear().type(bot1Name);
            cy.wait(3000); // wait for the dialog code to settle
            cy.get(".mx_Spinner").should("not.exist");
            cy.spotlightResults().should("have.length", 1);
        });
    });

    it("should be able to navigate results via keyboard", () => {
        cy.openSpotlightDialog().within(() => {
            cy.spotlightFilter(Filter.People);
            cy.spotlightSearch().clear().type("b");
            // our debouncing logic only starts the search after a short timeout,
            // so we wait a few milliseconds.
            cy.wait(1000);
            cy.get(".mx_Spinner")
                .should("not.exist")
                .then(() => {
                    cy.spotlightResults()
                        .should("have.length", 2)
                        .then(() => {
                            cy.spotlightResults().eq(0).should("have.attr", "aria-selected", "true");
                            cy.spotlightResults().eq(1).should("have.attr", "aria-selected", "false");
                        });
                    cy.spotlightSearch()
                        .type("{downArrow}")
                        .then(() => {
                            cy.spotlightResults().eq(0).should("have.attr", "aria-selected", "false");
                            cy.spotlightResults().eq(1).should("have.attr", "aria-selected", "true");
                        });
                    cy.spotlightSearch()
                        .type("{downArrow}")
                        .then(() => {
                            cy.spotlightResults().eq(0).should("have.attr", "aria-selected", "false");
                            cy.spotlightResults().eq(1).should("have.attr", "aria-selected", "false");
                        });
                    cy.spotlightSearch()
                        .type("{upArrow}")
                        .then(() => {
                            cy.spotlightResults().eq(0).should("have.attr", "aria-selected", "false");
                            cy.spotlightResults().eq(1).should("have.attr", "aria-selected", "true");
                        });
                    cy.spotlightSearch()
                        .type("{upArrow}")
                        .then(() => {
                            cy.spotlightResults().eq(0).should("have.attr", "aria-selected", "true");
                            cy.spotlightResults().eq(1).should("have.attr", "aria-selected", "false");
                        });
                });
        });
    });
});

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

import { HomeserverInstance } from "../../plugins/utils/homeserver";
import { MatrixClient } from "../../global";
import Chainable = Cypress.Chainable;

interface Charly {
    client: MatrixClient;
    displayName: string;
}

describe("Lazy Loading", () => {
    let homeserver: HomeserverInstance;
    let bob: MatrixClient;
    const charlies: Charly[] = [];

    beforeEach(() => {
        cy.window().then((win) => {
            win.localStorage.setItem("mx_lhs_size", "0"); // Collapse left panel for these tests
        });

        cy.startHomeserver("default").then((data) => {
            homeserver = data;

            cy.initTestUser(homeserver, "Alice");

            cy.getBot(homeserver, {
                displayName: "Bob",
                startClient: false,
                autoAcceptInvites: false,
            }).then((_bob) => {
                bob = _bob;
            });

            for (let i = 1; i <= 10; i++) {
                const displayName = `Charly #${i}`;
                cy.getBot(homeserver, {
                    displayName,
                    startClient: false,
                    autoAcceptInvites: false,
                }).then((client) => {
                    charlies[i - 1] = { displayName, client };
                });
            }
        });
    });

    afterEach(() => {
        cy.stopHomeserver(homeserver);
    });

    const name = "Lazy Loading Test";
    const alias = "#lltest:localhost";
    const charlyMsg1 = "hi bob!";
    const charlyMsg2 = "how's it going??";

    function setupRoomWithBobAliceAndCharlies(charlies: Charly[]) {
        cy.window({ log: false }).then((win) => {
            return cy
                .wrap(
                    bob
                        .createRoom({
                            name,
                            room_alias_name: "lltest",
                            visibility: win.matrixcs.Visibility.Public,
                        })
                        .then((r) => r.room_id),
                    { log: false },
                )
                .as("roomId");
        });

        cy.get<string>("@roomId").then(async (roomId) => {
            for (const charly of charlies) {
                await charly.client.joinRoom(alias);
            }

            for (const charly of charlies) {
                cy.botSendMessage(charly.client, roomId, charlyMsg1);
            }
            for (const charly of charlies) {
                cy.botSendMessage(charly.client, roomId, charlyMsg2);
            }

            for (let i = 20; i >= 1; --i) {
                cy.botSendMessage(bob, roomId, `I will only say this ${i} time(s)!`);
            }
        });

        cy.joinRoom(alias);
        cy.viewRoomByName(name);
    }

    function checkPaginatedDisplayNames(charlies: Charly[]) {
        cy.scrollToTop();
        for (const charly of charlies) {
            cy.findEventTile(charly.displayName, charlyMsg1).should("exist");
            cy.findEventTile(charly.displayName, charlyMsg2).should("exist");
        }
    }

    function openMemberlist(): void {
        cy.get(".mx_RoomHeader").within(() => {
            cy.findByRole("button", { name: "Room info" }).click();
        });

        cy.get(".mx_RoomSummaryCard").within(() => {
            cy.findByRole("button", { name: /People \d/ }).click(); // \d represents the number of the room members
        });
    }

    function getMemberInMemberlist(name: string): Chainable<JQuery> {
        return cy.contains(".mx_MemberList .mx_EntityTile_name", name);
    }

    function checkMemberList(charlies: Charly[]) {
        getMemberInMemberlist("Alice").should("exist");
        getMemberInMemberlist("Bob").should("exist");
        charlies.forEach((charly) => {
            getMemberInMemberlist(charly.displayName).should("exist");
        });
    }

    function checkMemberListLacksCharlies(charlies: Charly[]) {
        charlies.forEach((charly) => {
            getMemberInMemberlist(charly.displayName).should("not.exist");
        });
    }

    function joinCharliesWhileAliceIsOffline(charlies: Charly[]) {
        cy.goOffline();

        cy.get<string>("@roomId").then(async (roomId) => {
            for (const charly of charlies) {
                await charly.client.joinRoom(alias);
            }
            for (let i = 20; i >= 1; --i) {
                cy.botSendMessage(charlies[0].client, roomId, "where is charly?");
            }
        });

        cy.goOnline();
        cy.wait(1000); // Ideally we'd await a /sync here but intercepts step on each other from going offline/online
    }

    it("should handle lazy loading properly even when offline", () => {
        const charly1to5 = charlies.slice(0, 5);
        const charly6to10 = charlies.slice(5);

        // Set up room with alice, bob & charlies 1-5
        setupRoomWithBobAliceAndCharlies(charly1to5);
        // Alice should see 2 messages from every charly with the correct display name
        checkPaginatedDisplayNames(charly1to5);

        openMemberlist();
        checkMemberList(charly1to5);
        joinCharliesWhileAliceIsOffline(charly6to10);
        checkMemberList(charly6to10);

        cy.get<string>("@roomId").then(async (roomId) => {
            for (const charly of charlies) {
                await charly.client.leave(roomId);
            }
        });

        checkMemberListLacksCharlies(charlies);
    });
});

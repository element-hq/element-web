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
import { HomeserverInstance } from "../../plugins/utils/homeserver";

describe("Presence tests", () => {
    let homeserver: HomeserverInstance;

    beforeEach(() => {
        cy.startHomeserver("default").then((data) => {
            homeserver = data;
        });
    });

    afterEach(() => {
        cy.stopHomeserver(homeserver);
    });

    it("renders unreachable presence state correctly", () => {
        cy.initTestUser(homeserver, "Janet");
        cy.getBot(homeserver, { displayName: "Bob" }).then((bob) => {
            cy.intercept("GET", "**/sync*", (req) => {
                req.continue((res) => {
                    res.body.presence = {
                        events: [
                            {
                                type: "m.presence",
                                sender: bob.getUserId(),
                                content: {
                                    presence: "io.element.unreachable",
                                    currently_active: false,
                                },
                            },
                        ],
                    };
                });
            });
            cy.createRoom({ name: "My Room", invite: [bob.getUserId()] }).then((roomId) => {
                cy.viewRoomById(roomId);
            });
            cy.findByRole("button", { name: "Room info" }).click();
            cy.get(".mx_RightPanel").within(() => {
                cy.contains("People").click();
            });
            cy.get(".mx_EntityTile_unreachable")
                .should("contain.text", "Bob")
                .should("contain.text", "User's server unreachable");
        });
    });
});

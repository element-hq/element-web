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

describe("Pills", () => {
    let homeserver: HomeserverInstance;

    beforeEach(() => {
        cy.startHomeserver("default").then((data) => {
            homeserver = data;

            cy.initTestUser(homeserver, "Sally");
        });
    });

    afterEach(() => {
        cy.stopHomeserver(homeserver);
    });

    it("should navigate clicks internally to the app", () => {
        const messageRoom = "Send Messages Here";
        const targetLocalpart = "aliasssssssssssss";
        cy.createRoom({
            name: "Target",
            room_alias_name: targetLocalpart,
        }).as("targetRoomId");
        cy.createRoom({
            name: messageRoom,
        }).as("messageRoomId");
        cy.all([cy.get<string>("@targetRoomId"), cy.get<string>("@messageRoomId")]).then(
            ([targetRoomId, messageRoomId]) => {
                // discard the target room ID - we don't need it
                cy.viewRoomByName(messageRoom);
                cy.url().should("contain", `/#/room/${messageRoomId}`);

                // send a message using the built-in room mention functionality (autocomplete)
                cy.findByRole("textbox", { name: "Send a message…" }).type(
                    `Hello world! Join here: #${targetLocalpart.substring(0, 3)}`,
                );
                cy.get(".mx_Autocomplete_Completion_title").click();
                cy.findByRole("button", { name: "Send message" }).click();

                // find the pill in the timeline and click it
                cy.get(".mx_EventTile_body .mx_Pill").click();

                const localUrl = `/#/room/#${targetLocalpart}:`;
                // verify we landed at a sane place
                cy.url().should("contain", localUrl);

                cy.wait(250); // let the room list settle

                // go back to the message room and try to click on the pill text, as a user would
                cy.viewRoomByName(messageRoom);
                cy.get(".mx_EventTile_body .mx_Pill .mx_Pill_text")
                    .should("have.css", "pointer-events", "none")
                    .click({ force: true }); // force is to ensure we bypass pointer-events
                cy.url().should("contain", localUrl);
            },
        );
    });
});

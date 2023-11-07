/*
Copyright 2022-2023 The Matrix.org Foundation C.I.C.

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
import { waitForRoom } from "../utils";
import { Filter } from "../../support/settings";

describe("Create Knock Room", () => {
    let homeserver: HomeserverInstance;

    beforeEach(() => {
        cy.enableLabsFeature("feature_ask_to_join");

        cy.startHomeserver("default").then((data) => {
            homeserver = data;

            cy.initTestUser(homeserver, "Alice");
        });
    });

    afterEach(() => {
        cy.stopHomeserver(homeserver);
    });

    it("should create a knock room", () => {
        cy.openCreateRoomDialog().within(() => {
            cy.findByRole("textbox", { name: "Name" }).type("Cybersecurity");
            cy.findByRole("button", { name: "Room visibility" }).click();
            cy.findByRole("option", { name: "Ask to join" }).click();

            cy.findByRole("button", { name: "Create room" }).click();
        });

        cy.get(".mx_LegacyRoomHeader").within(() => {
            cy.findByText("Cybersecurity");
        });

        cy.hash().then((urlHash) => {
            const roomId = urlHash.replace("#/room/", "");

            // Room should have a knock join rule
            cy.window().then(async (win) => {
                await waitForRoom(win, win.mxMatrixClientPeg.get(), roomId, (room) => {
                    const events = room.getLiveTimeline().getEvents();
                    return events.some(
                        (e) => e.getType() === "m.room.join_rules" && e.getContent().join_rule === "knock",
                    );
                });
            });
        });
    });

    it("should create a room and change a join rule to knock", () => {
        cy.openCreateRoomDialog().within(() => {
            cy.findByRole("textbox", { name: "Name" }).type("Cybersecurity");

            cy.findByRole("button", { name: "Create room" }).click();
        });

        cy.get(".mx_LegacyRoomHeader").within(() => {
            cy.findByText("Cybersecurity");
        });

        cy.hash().then((urlHash) => {
            const roomId = urlHash.replace("#/room/", "");

            cy.openRoomSettings("Security & Privacy");

            cy.findByRole("group", { name: "Access" }).within(() => {
                cy.findByRole("radio", { name: "Private (invite only)" }).should("be.checked");
                cy.findByRole("radio", { name: "Ask to join" }).check({ force: true });
            });

            // Room should have a knock join rule
            cy.window().then(async (win) => {
                await waitForRoom(win, win.mxMatrixClientPeg.get(), roomId, (room) => {
                    const events = room.getLiveTimeline().getEvents();
                    return events.some(
                        (e) => e.getType() === "m.room.join_rules" && e.getContent().join_rule === "knock",
                    );
                });
            });
        });
    });

    it("should create a public knock room", () => {
        cy.openCreateRoomDialog().within(() => {
            cy.findByRole("textbox", { name: "Name" }).type("Cybersecurity");
            cy.findByRole("button", { name: "Room visibility" }).click();
            cy.findByRole("option", { name: "Ask to join" }).click();
            cy.findByRole("checkbox", { name: "Make this room visible in the public room directory." }).click({
                force: true,
            });

            cy.findByRole("button", { name: "Create room" }).click();
        });

        cy.get(".mx_LegacyRoomHeader").within(() => {
            cy.findByText("Cybersecurity");
        });

        cy.hash().then((urlHash) => {
            const roomId = urlHash.replace("#/room/", "");

            // Room should have a knock join rule
            cy.window().then(async (win) => {
                await waitForRoom(win, win.mxMatrixClientPeg.get(), roomId, (room) => {
                    const events = room.getLiveTimeline().getEvents();
                    return events.some(
                        (e) => e.getType() === "m.room.join_rules" && e.getContent().join_rule === "knock",
                    );
                });
            });
        });

        cy.openSpotlightDialog().within(() => {
            cy.spotlightFilter(Filter.PublicRooms);
            cy.spotlightResults().eq(0).should("contain", "Cybersecurity");
        });
    });
});

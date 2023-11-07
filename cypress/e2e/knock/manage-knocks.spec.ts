/*
Copyright 2023 Mikhail Aheichyk
Copyright 2023 Nordeck IT + Consulting GmbH.

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

import type { MatrixClient } from "matrix-js-sdk/src/matrix";
import { HomeserverInstance } from "../../plugins/utils/homeserver";
import { waitForRoom } from "../utils";

describe("Manage Knocks", () => {
    let homeserver: HomeserverInstance;
    let bot: MatrixClient;
    let roomId: string;

    beforeEach(() => {
        cy.enableLabsFeature("feature_ask_to_join");

        cy.startHomeserver("default").then((data) => {
            homeserver = data;

            cy.initTestUser(homeserver, "Alice");

            cy.createRoom({
                name: "Cybersecurity",
                initial_state: [
                    {
                        type: "m.room.join_rules",
                        content: {
                            join_rule: "knock",
                        },
                        state_key: "",
                    },
                ],
            }).then((newRoomId) => {
                roomId = newRoomId;
                cy.viewRoomById(newRoomId);
            });

            cy.getBot(homeserver, { displayName: "Bob" }).then(async (_bot) => {
                bot = _bot;
            });
        });
    });

    afterEach(() => {
        cy.stopHomeserver(homeserver);
    });

    it("should approve knock using bar", () => {
        bot.knockRoom(roomId);

        cy.get(".mx_RoomKnocksBar").within(() => {
            cy.findByRole("heading", { name: "Asking to join" });
            cy.findByText(/^Bob/);
            cy.findByRole("button", { name: "Approve" }).click();
        });

        cy.get(".mx_RoomKnocksBar").should("not.exist");

        cy.findByText("Alice invited Bob");
    });

    it("should deny knock using bar", () => {
        bot.knockRoom(roomId);

        cy.get(".mx_RoomKnocksBar").within(() => {
            cy.findByRole("heading", { name: "Asking to join" });
            cy.findByText(/^Bob/);
            cy.findByRole("button", { name: "Deny" }).click();
        });

        cy.get(".mx_RoomKnocksBar").should("not.exist");

        // Should receive Bob's "m.room.member" with "leave" membership when access is denied
        cy.window().then(async (win) => {
            await waitForRoom(win, win.mxMatrixClientPeg.get(), roomId, (room) => {
                const events = room.getLiveTimeline().getEvents();
                return events.some(
                    (e) =>
                        e.getType() === "m.room.member" &&
                        e.getContent()?.membership === "leave" &&
                        e.getContent()?.displayname === "Bob",
                );
            });
        });
    });

    it("should approve knock using people tab", () => {
        bot.knockRoom(roomId, { reason: "Hello, can I join?" });

        cy.openRoomSettings("People");

        cy.findByRole("group", { name: "Asking to join" }).within(() => {
            cy.findByText(/^Bob/);
            cy.findByText("Hello, can I join?");
            cy.findByRole("button", { name: "Approve" }).click();

            cy.findByText(/^Bob/).should("not.exist");
        });

        cy.findByText("Alice invited Bob");
    });

    it("should deny knock using people tab", () => {
        bot.knockRoom(roomId, { reason: "Hello, can I join?" });

        cy.openRoomSettings("People");

        cy.findByRole("group", { name: "Asking to join" }).within(() => {
            cy.findByText(/^Bob/);
            cy.findByText("Hello, can I join?");
            cy.findByRole("button", { name: "Deny" }).click();

            cy.findByText(/^Bob/).should("not.exist");
        });

        // Should receive Bob's "m.room.member" with "leave" membership when access is denied
        cy.window().then(async (win) => {
            await waitForRoom(win, win.mxMatrixClientPeg.get(), roomId, (room) => {
                const events = room.getLiveTimeline().getEvents();
                return events.some(
                    (e) =>
                        e.getType() === "m.room.member" &&
                        e.getContent()?.membership === "leave" &&
                        e.getContent()?.displayname === "Bob",
                );
            });
        });
    });
});

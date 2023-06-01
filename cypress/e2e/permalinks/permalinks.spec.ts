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

import { ISendEventResponse } from "matrix-js-sdk/src/matrix";

import { HomeserverInstance } from "../../plugins/utils/homeserver";
import type { CypressBot } from "../../support/bot";

const room1Name = "Room 1";
const room2Name = "Room 2";
const unknownRoomAlias = "#unknownroom:example.com";
const permalinkPrefix = "https://matrix.to/#/";

const getPill = (label: string) => {
    return cy.contains(".mx_Pill_text", new RegExp("^" + label + "$", "g"));
};

describe("permalinks", () => {
    beforeEach(() => {
        cy.startHomeserver("default")
            .as("homeserver")
            .then((homeserver: HomeserverInstance) => {
                cy.initTestUser(homeserver, "Alice");

                cy.createRoom({ name: room1Name }).as("room1Id");
                cy.createRoom({ name: room2Name }).as("room2Id");

                cy.getBot(homeserver, { displayName: "Bob" }).as("bob");
                cy.getBot(homeserver, { displayName: "Charlotte" }).as("charlotte");
                cy.getBot(homeserver, { displayName: "Danielle" }).as("danielle");
            });
    });

    afterEach(() => {
        cy.get<HomeserverInstance>("@homeserver").then((homeserver: HomeserverInstance) => {
            cy.stopHomeserver(homeserver);
        });
    });

    it("shoud render permalinks as expected", () => {
        let danielle: CypressBot;

        cy.get<CypressBot>("@danielle").then((d) => {
            danielle = d;
        });

        cy.viewRoomByName(room1Name);

        cy.all([
            cy.getClient(),
            cy.get<string>("@room1Id"),
            cy.get<string>("@room2Id"),
            cy.get<CypressBot>("@bob"),
            cy.get<CypressBot>("@charlotte"),
        ]).then(([client, room1Id, room2Id, bob, charlotte]) => {
            cy.inviteUser(room1Id, bob.getUserId());
            cy.botJoinRoom(bob, room1Id);
            cy.inviteUser(room2Id, charlotte.getUserId());
            cy.botJoinRoom(charlotte, room2Id);

            cy.botSendMessage(client, room1Id, "At room mention: @room");

            cy.botSendMessage(client, room1Id, `Permalink to Room 2: ${permalinkPrefix}${room2Id}`);
            cy.botSendMessage(
                client,
                room1Id,
                `Permalink to an unknown room alias: ${permalinkPrefix}${unknownRoomAlias}`,
            );

            cy.botSendMessage(bob, room1Id, "Hello").then((result: ISendEventResponse) => {
                cy.botSendMessage(
                    client,
                    room1Id,
                    `Permalink to a message in the same room: ${permalinkPrefix}${room1Id}/${result.event_id}`,
                );
            });
            cy.botSendMessage(charlotte, room2Id, "Hello").then((result: ISendEventResponse) => {
                cy.botSendMessage(
                    client,
                    room1Id,
                    `Permalink to a message in another room: ${permalinkPrefix}${room2Id}/${result.event_id}`,
                );
            });
            cy.botSendMessage(client, room1Id, `Permalink to an uknonwn message: ${permalinkPrefix}${room1Id}/$abc123`);

            cy.botSendMessage(client, room1Id, `Permalink to a user in the room: ${permalinkPrefix}${bob.getUserId()}`);
            cy.botSendMessage(
                client,
                room1Id,
                `Permalink to a user in another room: ${permalinkPrefix}${charlotte.getUserId()}`,
            );
            cy.botSendMessage(
                client,
                room1Id,
                `Permalink to a user with whom alice doesn't share a room: ${permalinkPrefix}${danielle.getUserId()}`,
            );
        });

        cy.get(".mx_RoomView_timeline").within(() => {
            getPill("@room");

            getPill(room2Name);
            getPill(unknownRoomAlias);

            getPill("Message from Bob");
            getPill(`Message in ${room2Name}`);
            getPill("Message");

            getPill("Bob");
            getPill("Charlotte");
            // This is the permalink to Danielle's profile. It should only display the MXID
            // because the profile is unknown (not sharing any room with Danielle).
            getPill(danielle.getSafeUserId());
        });

        // Exclude various components from the snapshot, for consistency
        const percyCSS =
            ".mx_cryptoEvent, " +
            ".mx_NewRoomIntro, " +
            ".mx_MessageTimestamp, " +
            ".mx_RoomView_myReadMarker, " +
            ".mx_GenericEventListSummary { visibility: hidden !important; }";

        cy.get(".mx_RoomView_timeline").percySnapshotElement("Permalink rendering", { percyCSS });
    });
});

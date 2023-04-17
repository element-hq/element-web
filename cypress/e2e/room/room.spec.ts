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

import { EventType } from "matrix-js-sdk/src/@types/event";

import { HomeserverInstance } from "../../plugins/utils/homeserver";
import { MatrixClient } from "../../global";

describe("Room Directory", () => {
    let homeserver: HomeserverInstance;

    beforeEach(() => {
        cy.startHomeserver("default").then((data) => {
            homeserver = data;

            cy.initTestUser(homeserver, "Alice");
        });
    });

    afterEach(() => {
        cy.stopHomeserver(homeserver);
    });

    it("should switch between existing dm rooms without a loader", () => {
        let bobClient: MatrixClient;
        let charlieClient: MatrixClient;
        cy.getBot(homeserver, {
            displayName: "Bob",
        }).then((bob) => {
            bobClient = bob;
        });

        cy.getBot(homeserver, {
            displayName: "Charlie",
        }).then((charlie) => {
            charlieClient = charlie;
        });

        // create dms with bob and charlie
        cy.getClient().then(async (cli) => {
            const bobRoom = await cli.createRoom({ is_direct: true });
            const charlieRoom = await cli.createRoom({ is_direct: true });
            await cli.invite(bobRoom.room_id, bobClient.getUserId());
            await cli.invite(charlieRoom.room_id, charlieClient.getUserId());
            await cli.setAccountData("m.direct" as EventType, {
                [bobClient.getUserId()]: [bobRoom.room_id],
                [charlieClient.getUserId()]: [charlieRoom.room_id],
            });
        });

        cy.wait(250); // let the room list settle

        cy.viewRoomByName("Bob");

        // short timeout because loader is only visible for short period
        // we want to make sure it is never displayed when switching these rooms
        cy.get(".mx_RoomPreviewBar_spinnerTitle", { timeout: 1 }).should("not.exist");
        // confirm the room was loaded
        cy.findByText("Bob joined the room").should("exist");

        cy.viewRoomByName("Charlie");
        cy.get(".mx_RoomPreviewBar_spinnerTitle", { timeout: 1 }).should("not.exist");
        // confirm the room was loaded
        cy.findByText("Charlie joined the room").should("exist");
    });
});

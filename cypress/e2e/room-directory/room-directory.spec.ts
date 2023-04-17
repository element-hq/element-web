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

describe("Room Directory", () => {
    let homeserver: HomeserverInstance;

    beforeEach(() => {
        cy.startHomeserver("default").then((data) => {
            homeserver = data;

            cy.initTestUser(homeserver, "Ray");
            cy.getBot(homeserver, { displayName: "Paul" }).as("bot");
        });
    });

    afterEach(() => {
        cy.stopHomeserver(homeserver);
    });

    it("should allow admin to add alias & publish room to directory", () => {
        cy.window({ log: false }).then((win) => {
            cy.createRoom({
                name: "Gaming",
                preset: win.matrixcs.Preset.PublicChat,
            }).as("roomId");
        });

        cy.viewRoomByName("Gaming");
        cy.openRoomSettings();

        // First add a local address `gaming`
        cy.contains(".mx_SettingsFieldset", "Local Addresses").within(() => {
            cy.findByRole("textbox").type("gaming");
            cy.findByRole("button", { name: "Add" }).click();
            cy.findByText("#gaming:localhost").should("have.class", "mx_EditableItem_item").should("exist");
        });

        // Publish into the public rooms directory
        cy.contains(".mx_SettingsFieldset", "Published Addresses").within(() => {
            cy.get("#canonicalAlias").find(":selected").findByText("#gaming:localhost");
            cy.findByLabelText("Publish this room to the public in localhost's room directory?")
                .click()
                .should("have.attr", "aria-checked", "true");
        });

        cy.closeDialog();

        cy.all([cy.get<MatrixClient>("@bot"), cy.get<string>("@roomId")]).then(async ([bot, roomId]) => {
            const resp = await bot.publicRooms({});
            expect(resp.total_room_count_estimate).to.equal(1);
            expect(resp.chunk).to.have.length(1);
            expect(resp.chunk[0].room_id).to.equal(roomId);
        });
    });

    it("should allow finding published rooms in directory", () => {
        const name = "This is a public room";
        cy.all([cy.window({ log: false }), cy.get<MatrixClient>("@bot")]).then(([win, bot]) => {
            bot.createRoom({
                visibility: win.matrixcs.Visibility.Public,
                name,
                room_alias_name: "test1234",
            });
        });

        cy.findByRole("button", { name: "Explore rooms" }).click();

        cy.get(".mx_SpotlightDialog").within(() => {
            cy.findByRole("textbox", { name: "Search" }).type("Unknown Room");
            cy.findByText("If you can't find the room you're looking for, ask for an invite or create a new room.")
                .should("have.class", "mx_SpotlightDialog_otherSearches_messageSearchText")
                .should("exist");
        });
        cy.get(".mx_SpotlightDialog_wrapper").percySnapshotElement("Room Directory - filtered no results");

        cy.get(".mx_SpotlightDialog").within(() => {
            cy.findByRole("textbox", { name: "Search" }).type("{selectAll}{backspace}test1234");
            cy.findByText(name).should("have.class", "mx_SpotlightDialog_result_publicRoomName").should("exist");
        });

        // Disabled because flaky - see https://github.com/vector-im/element-web/issues/24881
        //cy.get(".mx_SpotlightDialog_wrapper").percySnapshotElement("Room Directory - filtered one result");

        cy.get(".mx_SpotlightDialog .mx_SpotlightDialog_option").findByRole("button", { name: "Join" }).click();

        cy.url().should("contain", `/#/room/#test1234:localhost`);
    });
});

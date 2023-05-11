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
import Chainable = Cypress.Chainable;

const ROOM_NAME = "Test room";
const ROOM_NAME_LONG =
    "Lorem ipsum dolor sit amet, consectetur adipisicing elit, sed do eiusmod tempor incididunt ut labore " +
    "et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut " +
    "aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum " +
    "dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui " +
    "officia deserunt mollit anim id est laborum.";
const SPACE_NAME = "Test space";
const NAME = "Alice";
const ROOM_ADDRESS_LONG =
    "loremIpsumDolorSitAmetConsecteturAdipisicingElitSedDoEiusmodTemporIncididuntUtLaboreEtDoloreMagnaAliqua";

const getMemberTileByName = (name: string): Chainable<JQuery<HTMLElement>> => {
    return cy.get(`.mx_EntityTile, [title="${name}"]`);
};

const viewRoomSummaryByName = (name: string): Chainable<JQuery<HTMLElement>> => {
    cy.viewRoomByName(name);
    cy.findByRole("button", { name: "Room info" }).click();
    return checkRoomSummaryCard(name);
};

const checkRoomSummaryCard = (name: string): Chainable<JQuery<HTMLElement>> => {
    cy.get(".mx_RoomSummaryCard").should("have.length", 1);
    return cy.get(".mx_BaseCard_header").should("contain", name);
};

describe("RightPanel", () => {
    let homeserver: HomeserverInstance;

    beforeEach(() => {
        cy.startHomeserver("default").then((data) => {
            homeserver = data;
            cy.initTestUser(homeserver, NAME).then(() =>
                cy.window({ log: false }).then(() => {
                    cy.createRoom({ name: ROOM_NAME });
                    cy.createSpace({ name: SPACE_NAME });
                }),
            );
        });
    });

    afterEach(() => {
        cy.stopHomeserver(homeserver);
    });

    describe("in rooms", () => {
        it("should handle long room address and long room name", () => {
            cy.createRoom({ name: ROOM_NAME_LONG });
            viewRoomSummaryByName(ROOM_NAME_LONG);

            cy.openRoomSettings();

            // Set a local room address
            cy.contains(".mx_SettingsFieldset", "Local Addresses").within(() => {
                cy.findByRole("textbox").type(ROOM_ADDRESS_LONG);
                cy.findByRole("button", { name: "Add" }).click();
                cy.findByText(`#${ROOM_ADDRESS_LONG}:localhost`)
                    .should("have.class", "mx_EditableItem_item")
                    .should("exist");
            });

            cy.closeDialog();

            // Close and reopen the right panel to render the room address
            cy.findByRole("button", { name: "Room info" }).click();
            cy.get(".mx_RightPanel").should("not.exist");
            cy.findByRole("button", { name: "Room info" }).click();

            cy.get(".mx_RightPanel").percySnapshotElement("RoomSummaryCard - with a room name and a local address", {
                widths: [264], // Emulate the UI. The value is based on minWidth specified on MainSplit.tsx
            });
        });

        it("should handle clicking add widgets", () => {
            viewRoomSummaryByName(ROOM_NAME);

            cy.findByRole("button", { name: "Add widgets, bridges & bots" }).click();
            cy.get(".mx_IntegrationManager").should("have.length", 1);
        });

        it("should handle viewing export chat", () => {
            viewRoomSummaryByName(ROOM_NAME);

            cy.findByRole("button", { name: "Export chat" }).click();
            cy.get(".mx_ExportDialog").should("have.length", 1);
        });

        it("should handle viewing share room", () => {
            viewRoomSummaryByName(ROOM_NAME);

            cy.findByRole("button", { name: "Share room" }).click();
            cy.get(".mx_ShareDialog").should("have.length", 1);
        });

        it("should handle viewing room settings", () => {
            viewRoomSummaryByName(ROOM_NAME);

            cy.findByRole("button", { name: "Room settings" }).click();
            cy.get(".mx_RoomSettingsDialog").should("have.length", 1);
            cy.get(".mx_Dialog_title").within(() => {
                cy.findByText("Room Settings - " + ROOM_NAME).should("exist");
            });
        });

        it("should handle viewing files", () => {
            viewRoomSummaryByName(ROOM_NAME);

            cy.findByRole("button", { name: "Files" }).click();
            cy.get(".mx_FilePanel").should("have.length", 1);
            cy.get(".mx_FilePanel_empty").should("have.length", 1);

            cy.findByRole("button", { name: "Room information" }).click();
            checkRoomSummaryCard(ROOM_NAME);
        });

        it("should handle viewing room member", () => {
            viewRoomSummaryByName(ROOM_NAME);

            // \d represents the number of the room members inside mx_BaseCard_Button_sublabel
            cy.findByRole("button", { name: /People \d/ }).click();
            cy.get(".mx_MemberList").should("have.length", 1);

            getMemberTileByName(NAME).click();
            cy.get(".mx_UserInfo").should("have.length", 1);
            cy.get(".mx_UserInfo_profile").within(() => {
                cy.findByText(NAME);
            });

            cy.findByRole("button", { name: "Room members" }).click();
            cy.get(".mx_MemberList").should("have.length", 1);

            cy.findByRole("button", { name: "Room information" }).click();
            checkRoomSummaryCard(ROOM_NAME);
        });
    });

    describe("in spaces", () => {
        it("should handle viewing space member", () => {
            cy.viewSpaceHomeByName(SPACE_NAME);

            cy.get(".mx_RoomInfoLine_private").within(() => {
                // \d represents the number of the space members
                cy.findByRole("button", { name: /\d member/ }).click();
            });
            cy.get(".mx_MemberList").should("have.length", 1);
            cy.get(".mx_RightPanel_scopeHeader").within(() => {
                cy.findByText(SPACE_NAME);
            });

            getMemberTileByName(NAME).click();
            cy.get(".mx_UserInfo").should("have.length", 1);
            cy.get(".mx_UserInfo_profile").within(() => {
                cy.findByText(NAME);
            });
            cy.get(".mx_RightPanel_scopeHeader").within(() => {
                cy.findByText(SPACE_NAME);
            });

            cy.findByRole("button", { name: "Back" }).click();
            cy.get(".mx_MemberList").should("have.length", 1);
        });
    });
});

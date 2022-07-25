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

import { SynapseInstance } from "../../plugins/synapsedocker";
import Chainable = Cypress.Chainable;

const ROOM_NAME = "Test room";
const SPACE_NAME = "Test space";
const NAME = "Alice";

const getMemberTileByName = (name: string): Chainable<JQuery<HTMLElement>> => {
    return cy.get(`.mx_EntityTile, [title="${name}"]`);
};

const goBack = (): Chainable<JQuery<HTMLElement>> => {
    return cy.get(".mx_BaseCard_back").click();
};

const viewRoomSummaryByName = (name: string): Chainable<JQuery<HTMLElement>> => {
    cy.viewRoomByName(name);
    cy.get(".mx_RightPanel_roomSummaryButton").click();
    return checkRoomSummaryCard(name);
};

const checkRoomSummaryCard = (name: string): Chainable<JQuery<HTMLElement>> => {
    cy.get(".mx_RoomSummaryCard").should("have.length", 1);
    return cy.get(".mx_BaseCard_header").should("contain", name);
};

describe("RightPanel", () => {
    let synapse: SynapseInstance;

    beforeEach(() => {
        cy.startSynapse("default").then(data => {
            synapse = data;
            cy.initTestUser(synapse, NAME).then(() =>
                cy.window({ log: false }).then(() => {
                    cy.createRoom({ name: ROOM_NAME });
                    cy.createSpace({ name: SPACE_NAME });
                }),
            );
        });
    });

    afterEach(() => {
        cy.stopSynapse(synapse);
    });

    describe("in rooms", () => {
        it("should handle clicking add widgets", () => {
            viewRoomSummaryByName(ROOM_NAME);

            cy.get(".mx_RoomSummaryCard_appsGroup .mx_AccessibleButton").click();
            cy.get(".mx_IntegrationManager").should("have.length", 1);
        });

        it("should handle viewing export chat", () => {
            viewRoomSummaryByName(ROOM_NAME);

            cy.get(".mx_RoomSummaryCard_icon_export").click();
            cy.get(".mx_ExportDialog").should("have.length", 1);
        });

        it("should handle viewing share room", () => {
            viewRoomSummaryByName(ROOM_NAME);

            cy.get(".mx_RoomSummaryCard_icon_share").click();
            cy.get(".mx_ShareDialog").should("have.length", 1);
        });

        it("should handle viewing room settings", () => {
            viewRoomSummaryByName(ROOM_NAME);

            cy.get(".mx_RoomSummaryCard_icon_settings").click();
            cy.get(".mx_RoomSettingsDialog").should("have.length", 1);
            cy.get(".mx_Dialog_title").should("contain", ROOM_NAME);
        });

        it("should handle viewing files", () => {
            viewRoomSummaryByName(ROOM_NAME);

            cy.get(".mx_RoomSummaryCard_icon_files").click();
            cy.get(".mx_FilePanel").should("have.length", 1);
            cy.get(".mx_FilePanel_empty").should("have.length", 1);

            goBack();
            checkRoomSummaryCard(ROOM_NAME);
        });

        it("should handle viewing room member", () => {
            viewRoomSummaryByName(ROOM_NAME);

            cy.get(".mx_RoomSummaryCard_icon_people").click();
            cy.get(".mx_MemberList").should("have.length", 1);

            getMemberTileByName(NAME).click();
            cy.get(".mx_UserInfo").should("have.length", 1);
            cy.get(".mx_UserInfo_profile").should("contain", NAME);

            goBack();
            cy.get(".mx_MemberList").should("have.length", 1);

            goBack();
            checkRoomSummaryCard(ROOM_NAME);
        });
    });

    describe("in spaces", () => {
        it("should handle viewing space member", () => {
            cy.viewSpaceHomeByName(SPACE_NAME);
            cy.get(".mx_RoomInfoLine_members").click();
            cy.get(".mx_MemberList").should("have.length", 1);
            cy.get(".mx_RightPanel_scopeHeader").should("contain", SPACE_NAME);

            getMemberTileByName(NAME).click();
            cy.get(".mx_UserInfo").should("have.length", 1);
            cy.get(".mx_UserInfo_profile").should("contain", NAME);
            cy.get(".mx_RightPanel_scopeHeader").should("contain", SPACE_NAME);

            goBack();
            cy.get(".mx_MemberList").should("have.length", 1);
        });
    });
});

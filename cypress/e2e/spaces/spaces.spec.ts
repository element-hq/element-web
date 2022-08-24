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

import type { MatrixClient } from "matrix-js-sdk/src/client";
import type { ICreateRoomOpts } from "matrix-js-sdk/src/@types/requests";
import { SynapseInstance } from "../../plugins/synapsedocker";
import Chainable = Cypress.Chainable;
import { UserCredentials } from "../../support/login";

function openSpaceCreateMenu(): Chainable<JQuery> {
    cy.get(".mx_SpaceButton_new").click();
    return cy.get(".mx_SpaceCreateMenu_wrapper .mx_ContextualMenu");
}

function openSpaceContextMenu(spaceName: string): Chainable<JQuery> {
    cy.getSpacePanelButton(spaceName).rightclick();
    return cy.get(".mx_SpacePanel_contextMenu");
}

function spaceCreateOptions(spaceName: string): ICreateRoomOpts {
    return {
        creation_content: {
            type: "m.space",
        },
        initial_state: [{
            type: "m.room.name",
            content: {
                name: spaceName,
            },
        }],
    };
}

function spaceChildInitialState(roomId: string): ICreateRoomOpts["initial_state"]["0"] {
    return {
        type: "m.space.child",
        state_key: roomId,
        content: {
            via: [roomId.split(":")[1]],
        },
    };
}

describe("Spaces", () => {
    let synapse: SynapseInstance;
    let user: UserCredentials;

    beforeEach(() => {
        cy.startSynapse("default").then(data => {
            synapse = data;

            cy.initTestUser(synapse, "Sue").then(_user => {
                user = _user;
                cy.mockClipboard();
            });
        });
    });

    afterEach(() => {
        cy.stopSynapse(synapse);
    });

    it("should allow user to create public space", () => {
        openSpaceCreateMenu().within(() => {
            cy.get(".mx_SpaceCreateMenuType_public").click();
            cy.get('.mx_SpaceBasicSettings_avatarContainer input[type="file"]')
                .selectFile("cypress/fixtures/riot.png", { force: true });
            cy.get('input[label="Name"]').type("Let's have a Riot");
            cy.get('input[label="Address"]').should("have.value", "lets-have-a-riot");
            cy.get('textarea[label="Description"]').type("This is a space to reminisce Riot.im!");
            cy.get(".mx_AccessibleButton").contains("Create").click();
        });

        // Create the default General & Random rooms, as well as a custom "Jokes" room
        cy.get('input[label="Room name"][value="General"]').should("exist");
        cy.get('input[label="Room name"][value="Random"]').should("exist");
        cy.get('input[placeholder="Support"]').type("Jokes");
        cy.get(".mx_AccessibleButton").contains("Continue").click();

        // Copy matrix.to link
        cy.get(".mx_SpacePublicShare_shareButton").focus().realClick();
        cy.getClipboardText().should("eq", "https://matrix.to/#/#lets-have-a-riot:localhost");

        // Go to space home
        cy.get(".mx_AccessibleButton").contains("Go to my first room").click();

        // Assert rooms exist in the room list
        cy.get(".mx_RoomList").contains(".mx_RoomTile", "General").should("exist");
        cy.get(".mx_RoomList").contains(".mx_RoomTile", "Random").should("exist");
        cy.get(".mx_RoomList").contains(".mx_RoomTile", "Jokes").should("exist");
    });

    it("should allow user to create private space", () => {
        openSpaceCreateMenu().within(() => {
            cy.get(".mx_SpaceCreateMenuType_private").click();
            cy.get('.mx_SpaceBasicSettings_avatarContainer input[type="file"]')
                .selectFile("cypress/fixtures/riot.png", { force: true });
            cy.get('input[label="Name"]').type("This is not a Riot");
            cy.get('input[label="Address"]').should("not.exist");
            cy.get('textarea[label="Description"]').type("This is a private space of mourning Riot.im...");
            cy.get(".mx_AccessibleButton").contains("Create").click();
        });

        cy.get(".mx_SpaceRoomView_privateScope_meAndMyTeammatesButton").click();

        // Create the default General & Random rooms, as well as a custom "Projects" room
        cy.get('input[label="Room name"][value="General"]').should("exist");
        cy.get('input[label="Room name"][value="Random"]').should("exist");
        cy.get('input[placeholder="Support"]').type("Projects");
        cy.get(".mx_AccessibleButton").contains("Continue").click();

        cy.get(".mx_SpaceRoomView").should("contain", "Invite your teammates");
        cy.get(".mx_AccessibleButton").contains("Skip for now").click();

        // Assert rooms exist in the room list
        cy.get(".mx_RoomList").contains(".mx_RoomTile", "General").should("exist");
        cy.get(".mx_RoomList").contains(".mx_RoomTile", "Random").should("exist");
        cy.get(".mx_RoomList").contains(".mx_RoomTile", "Projects").should("exist");

        // Assert rooms exist in the space explorer
        cy.get(".mx_SpaceHierarchy_list").contains(".mx_SpaceHierarchy_roomTile", "General").should("exist");
        cy.get(".mx_SpaceHierarchy_list").contains(".mx_SpaceHierarchy_roomTile", "Random").should("exist");
        cy.get(".mx_SpaceHierarchy_list").contains(".mx_SpaceHierarchy_roomTile", "Projects").should("exist");
    });

    it("should allow user to create just-me space", () => {
        cy.createRoom({
            name: "Sample Room",
        });

        openSpaceCreateMenu().within(() => {
            cy.get(".mx_SpaceCreateMenuType_private").click();
            cy.get('.mx_SpaceBasicSettings_avatarContainer input[type="file"]')
                .selectFile("cypress/fixtures/riot.png", { force: true });
            cy.get('input[label="Address"]').should("not.exist");
            cy.get('textarea[label="Description"]').type("This is a personal space to mourn Riot.im...");
            cy.get('input[label="Name"]').type("This is my Riot{enter}");
        });

        cy.get(".mx_SpaceRoomView_privateScope_justMeButton").click();

        cy.get(".mx_AddExistingToSpace_entry").click();
        cy.get(".mx_AccessibleButton").contains("Add").click();

        cy.get(".mx_RoomList").contains(".mx_RoomTile", "Sample Room").should("exist");
        cy.get(".mx_SpaceHierarchy_list").contains(".mx_SpaceHierarchy_roomTile", "Sample Room").should("exist");
    });

    it("should allow user to invite another to a space", () => {
        let bot: MatrixClient;
        cy.getBot(synapse, { displayName: "BotBob" }).then(_bot => {
            bot = _bot;
        });

        cy.createSpace({
            visibility: "public" as any,
            room_alias_name: "space",
        }).as("spaceId");

        openSpaceContextMenu("#space:localhost").within(() => {
            cy.get('.mx_SpacePanel_contextMenu_inviteButton[aria-label="Invite"]').click();
        });

        cy.get(".mx_SpacePublicShare").within(() => {
            // Copy link first
            cy.get(".mx_SpacePublicShare_shareButton").focus().realClick();
            cy.getClipboardText().should("eq", "https://matrix.to/#/#space:localhost");
            // Start Matrix invite flow
            cy.get(".mx_SpacePublicShare_inviteButton").click();
        });

        cy.get(".mx_InviteDialog_other").within(() => {
            cy.get('input[type="text"]').type(bot.getUserId());
            cy.get(".mx_AccessibleButton").contains("Invite").click();
        });

        cy.get(".mx_InviteDialog_other").should("not.exist");
    });

    it("should show space invites at the top of the space panel", () => {
        cy.createSpace({
            name: "My Space",
        });
        cy.getSpacePanelButton("My Space").should("exist");

        cy.getBot(synapse, { displayName: "BotBob" }).then({ timeout: 10000 }, async bot => {
            const { room_id: roomId } = await bot.createRoom(spaceCreateOptions("Space Space"));
            await bot.invite(roomId, user.userId);
        });
        // Assert that `Space Space` is above `My Space` due to it being an invite
        cy.getSpacePanelButton("Space Space").should("exist")
            .parent().next().find('.mx_SpaceButton[aria-label="My Space"]').should("exist");
    });

    it("should include rooms in space home", () => {
        cy.createRoom({
            name: "Music",
        }).as("roomId1");
        cy.createRoom({
            name: "Gaming",
        }).as("roomId2");

        const spaceName = "Spacey Mc. Space Space";
        cy.all([
            cy.get<string>("@roomId1"),
            cy.get<string>("@roomId2"),
        ]).then(([roomId1, roomId2]) => {
            cy.createSpace({
                name: spaceName,
                initial_state: [
                    spaceChildInitialState(roomId1),
                    spaceChildInitialState(roomId2),
                ],
            }).as("spaceId");
        });

        cy.get("@spaceId").then(() => {
            cy.viewSpaceHomeByName(spaceName);
        });
        cy.get(".mx_SpaceRoomView .mx_SpaceHierarchy_list").within(() => {
            cy.contains(".mx_SpaceHierarchy_roomTile", "Music").should("exist");
            cy.contains(".mx_SpaceHierarchy_roomTile", "Gaming").should("exist");
        });
    });

    it("should render subspaces in the space panel only when expanded", () => {
        cy.injectAxe();

        cy.createSpace({
            name: "Child Space",
            initial_state: [],
        }).then(spaceId => {
            cy.createSpace({
                name: "Root Space",
                initial_state: [
                    spaceChildInitialState(spaceId),
                ],
            }).as("spaceId");
        });
        cy.get('.mx_SpacePanel .mx_SpaceButton[aria-label="Root Space"]').should("exist");
        cy.get('.mx_SpacePanel .mx_SpaceButton[aria-label="Child Space"]').should("not.exist");

        const axeOptions = {
            rules: {
                // Disable this check as it triggers on nested roving tab index elements which are in practice fine
                'nested-interactive': {
                    enabled: false,
                },
            },
        };
        cy.checkA11y(undefined, axeOptions);
        cy.get(".mx_SpacePanel").percySnapshotElement("Space panel collapsed", { widths: [68] });

        cy.get(".mx_SpaceButton_toggleCollapse").click({ force: true });
        cy.get(".mx_SpacePanel:not(.collapsed)").should("exist");

        cy.contains(".mx_SpaceItem", "Root Space").should("exist")
            .contains(".mx_SpaceItem", "Child Space").should("exist");

        cy.checkA11y(undefined, axeOptions);
        cy.get(".mx_SpacePanel").percySnapshotElement("Space panel expanded", { widths: [258] });
    });
});

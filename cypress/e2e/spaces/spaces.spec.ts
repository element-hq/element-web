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
import type { Preset } from "matrix-js-sdk/src/@types/partials";
import type { ICreateRoomOpts } from "matrix-js-sdk/src/@types/requests";
import { HomeserverInstance } from "../../plugins/utils/homeserver";
import Chainable = Cypress.Chainable;
import { UserCredentials } from "../../support/login";

function openSpaceCreateMenu(): Chainable<JQuery> {
    cy.findByRole("button", { name: "Create a space" }).click();
    return cy.get(".mx_SpaceCreateMenu_wrapper .mx_ContextualMenu");
}

function openSpaceContextMenu(spaceName: string): Chainable<JQuery> {
    cy.getSpacePanelButton(spaceName).rightclick();
    return cy.get(".mx_SpacePanel_contextMenu");
}

function spaceCreateOptions(spaceName: string, roomIds: string[] = []): ICreateRoomOpts {
    return {
        creation_content: {
            type: "m.space",
        },
        initial_state: [
            {
                type: "m.room.name",
                content: {
                    name: spaceName,
                },
            },
            ...roomIds.map(spaceChildInitialState),
        ],
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
    let homeserver: HomeserverInstance;
    let user: UserCredentials;

    beforeEach(() => {
        cy.startHomeserver("default").then((data) => {
            homeserver = data;

            cy.initTestUser(homeserver, "Sue").then((_user) => {
                user = _user;
                cy.mockClipboard();
            });
        });
    });

    afterEach(() => {
        cy.stopHomeserver(homeserver);
    });

    it("should allow user to create public space", () => {
        openSpaceCreateMenu();
        cy.get("#mx_ContextualMenu_Container").percySnapshotElement("Space create menu");
        cy.get(".mx_SpaceCreateMenu_wrapper .mx_ContextualMenu").within(() => {
            // Regex pattern due to strings of "mx_SpaceCreateMenuType_public"
            cy.findByRole("button", { name: /Public/ }).click();

            cy.get('.mx_SpaceBasicSettings_avatarContainer input[type="file"]').selectFile(
                "cypress/fixtures/riot.png",
                { force: true },
            );
            cy.findByRole("textbox", { name: "Name" }).type("Let's have a Riot");
            cy.findByRole("textbox", { name: "Address" }).should("have.value", "lets-have-a-riot");
            cy.findByRole("textbox", { name: "Description" }).type("This is a space to reminisce Riot.im!");
            cy.findByRole("button", { name: "Create" }).click();
        });

        // Create the default General & Random rooms, as well as a custom "Jokes" room
        cy.findByPlaceholderText("General").should("exist");
        cy.findByPlaceholderText("Random").should("exist");
        cy.findByPlaceholderText("Support").type("Jokes");
        cy.findByRole("button", { name: "Continue" }).click();

        // Copy matrix.to link
        // Regex pattern due to strings of "mx_SpacePublicShare_shareButton"
        cy.findByRole("button", { name: /Share invite link/ }).realClick();
        cy.getClipboardText().should("eq", "https://matrix.to/#/#lets-have-a-riot:localhost");

        // Go to space home
        cy.findByRole("button", { name: "Go to my first room" }).click();

        // Assert rooms exist in the room list
        cy.findByRole("treeitem", { name: "General" }).should("exist");
        cy.findByRole("treeitem", { name: "Random" }).should("exist");
        cy.findByRole("treeitem", { name: "Jokes" }).should("exist");
    });

    it("should allow user to create private space", () => {
        openSpaceCreateMenu().within(() => {
            // Regex pattern due to strings of "mx_SpaceCreateMenuType_private"
            cy.findByRole("button", { name: /Private/ }).click();

            cy.get('.mx_SpaceBasicSettings_avatarContainer input[type="file"]').selectFile(
                "cypress/fixtures/riot.png",
                { force: true },
            );
            cy.findByRole("textbox", { name: "Name" }).type("This is not a Riot");
            cy.findByRole("textbox", { name: "Address" }).should("not.exist");
            cy.findByRole("textbox", { name: "Description" }).type("This is a private space of mourning Riot.im...");
            cy.findByRole("button", { name: "Create" }).click();
        });

        // Regex pattern due to strings of "mx_SpaceRoomView_privateScope_meAndMyTeammatesButton"
        cy.findByRole("button", { name: /Me and my teammates/ }).click();

        // Create the default General & Random rooms, as well as a custom "Projects" room
        cy.findByPlaceholderText("General").should("exist");
        cy.findByPlaceholderText("Random").should("exist");
        cy.findByPlaceholderText("Support").type("Projects");
        cy.findByRole("button", { name: "Continue" }).click();

        cy.get(".mx_SpaceRoomView h1").findByText("Invite your teammates");
        cy.get(".mx_SpaceRoomView").percySnapshotElement("Space - 'Invite your teammates' dialog");
        cy.findByRole("button", { name: "Skip for now" }).click();

        // Assert rooms exist in the room list
        cy.findByRole("treeitem", { name: "General" }).should("exist");
        cy.findByRole("treeitem", { name: "Random" }).should("exist");
        cy.findByRole("treeitem", { name: "Projects" }).should("exist");

        // Assert rooms exist in the space explorer
        cy.contains(".mx_SpaceHierarchy_list .mx_SpaceHierarchy_roomTile", "General").should("exist");
        cy.contains(".mx_SpaceHierarchy_list .mx_SpaceHierarchy_roomTile", "Random").should("exist");
        cy.contains(".mx_SpaceHierarchy_list .mx_SpaceHierarchy_roomTile", "Projects").should("exist");
    });

    it("should allow user to create just-me space", () => {
        cy.createRoom({
            name: "Sample Room",
        });

        openSpaceCreateMenu().within(() => {
            // Regex pattern due to strings of "mx_SpaceCreateMenuType_private"
            cy.findByRole("button", { name: /Private/ }).click();

            cy.get('.mx_SpaceBasicSettings_avatarContainer input[type="file"]').selectFile(
                "cypress/fixtures/riot.png",
                { force: true },
            );
            cy.findByRole("textbox", { name: "Address" }).should("not.exist");
            cy.findByRole("textbox", { name: "Description" }).type("This is a personal space to mourn Riot.im...");
            cy.findByRole("textbox", { name: "Name" }).type("This is my Riot{enter}");
        });

        // Regex pattern due to of strings of "mx_SpaceRoomView_privateScope_justMeButton"
        cy.findByRole("button", { name: /Just me/ }).click();

        cy.findByText("Sample Room").click({ force: true }); // force click as checkbox size is zero

        // Temporal implementation as multiple elements with the role "button" and name "Add" are found
        cy.get(".mx_AddExistingToSpace_footer").within(() => {
            cy.findByRole("button", { name: "Add" }).click();
        });

        cy.get(".mx_SpaceHierarchy_list").within(() => {
            // Regex pattern due to the strings of "mx_SpaceHierarchy_roomTile_joined"
            cy.findByRole("treeitem", { name: /Sample Room/ }).should("exist");
        });
    });

    it("should allow user to invite another to a space", () => {
        let bot: MatrixClient;
        cy.getBot(homeserver, { displayName: "BotBob" }).then((_bot) => {
            bot = _bot;
        });

        cy.createSpace({
            visibility: "public" as any,
            room_alias_name: "space",
        }).as("spaceId");

        openSpaceContextMenu("#space:localhost").within(() => {
            cy.findByRole("menuitem", { name: "Invite" }).click();
        });

        cy.get(".mx_SpacePublicShare").within(() => {
            // Copy link first
            // Regex pattern due to strings of "mx_SpacePublicShare_shareButton"
            cy.findByRole("button", { name: /Share invite link/ })
                .focus()
                .realClick();
            cy.getClipboardText().should("eq", "https://matrix.to/#/#space:localhost");
            // Start Matrix invite flow
            // Regex pattern due to strings of "mx_SpacePublicShare_inviteButton"
            cy.findByRole("button", { name: /Invite people/ }).click();
        });

        cy.get(".mx_InviteDialog_other").within(() => {
            cy.findByRole("textbox").type(bot.getUserId());
            cy.findByRole("button", { name: "Invite" }).click();
        });

        cy.get(".mx_InviteDialog_other").should("not.exist");
    });

    it("should show space invites at the top of the space panel", () => {
        cy.createSpace({
            name: "My Space",
        });
        cy.getSpacePanelButton("My Space").should("exist");

        cy.getBot(homeserver, { displayName: "BotBob" }).then({ timeout: 10000 }, async (bot) => {
            const { room_id: roomId } = await bot.createRoom(spaceCreateOptions("Space Space"));
            await bot.invite(roomId, user.userId);
        });
        // Assert that `Space Space` is above `My Space` due to it being an invite
        cy.getSpacePanelButton("Space Space")
            .should("exist")
            .parent()
            .next()
            .findByRole("button", { name: "My Space" })
            .should("exist");
    });

    it("should include rooms in space home", () => {
        cy.createRoom({
            name: "Music",
        }).as("roomId1");
        cy.createRoom({
            name: "Gaming",
        }).as("roomId2");

        const spaceName = "Spacey Mc. Space Space";
        cy.all([cy.get<string>("@roomId1"), cy.get<string>("@roomId2")]).then(([roomId1, roomId2]) => {
            cy.createSpace({
                name: spaceName,
                initial_state: [spaceChildInitialState(roomId1), spaceChildInitialState(roomId2)],
            }).as("spaceId");
        });

        cy.get("@spaceId").then(() => {
            cy.viewSpaceHomeByName(spaceName);
        });
        cy.get(".mx_SpaceRoomView .mx_SpaceHierarchy_list").within(() => {
            // Regex pattern due to strings in "mx_SpaceHierarchy_roomTile_name"
            cy.findByRole("treeitem", { name: /Music/ }).findByRole("button").should("exist");
            cy.findByRole("treeitem", { name: /Gaming/ })
                .findByRole("button")
                .should("exist");
        });
    });

    it("should render subspaces in the space panel only when expanded", () => {
        cy.injectAxe();

        cy.createSpace({
            name: "Child Space",
            initial_state: [],
        }).then((spaceId) => {
            cy.createSpace({
                name: "Root Space",
                initial_state: [spaceChildInitialState(spaceId)],
            }).as("spaceId");
        });

        // Find collapsed Space panel
        cy.findByRole("tree", { name: "Spaces" }).within(() => {
            cy.findByRole("button", { name: "Root Space" }).should("exist");
            cy.findByRole("button", { name: "Child Space" }).should("not.exist");
        });

        const axeOptions = {
            rules: {
                // Disable this check as it triggers on nested roving tab index elements which are in practice fine
                "nested-interactive": {
                    enabled: false,
                },
            },
        };
        cy.checkA11y(undefined, axeOptions);
        cy.get(".mx_SpacePanel").percySnapshotElement("Space panel collapsed", { widths: [68] });

        cy.findByRole("tree", { name: "Spaces" }).within(() => {
            // This finds the expand button with the class name "mx_SpaceButton_toggleCollapse". Note there is another
            // button with the same name with different class name "mx_SpacePanel_toggleCollapse".
            cy.findByRole("button", { name: "Expand" }).realHover().click();
        });
        cy.get(".mx_SpacePanel:not(.collapsed)").should("exist"); // TODO: replace :not() selector

        cy.contains(".mx_SpaceItem", "Root Space")
            .should("exist")
            .contains(".mx_SpaceItem", "Child Space")
            .should("exist");

        cy.checkA11y(undefined, axeOptions);
        cy.get(".mx_SpacePanel").percySnapshotElement("Space panel expanded", { widths: [258] });
    });

    it("should not soft crash when joining a room from space hierarchy which has a link in its topic", () => {
        cy.getBot(homeserver, { displayName: "BotBob" }).then({ timeout: 10000 }, async (bot) => {
            const { room_id: roomId } = await bot.createRoom({
                preset: "public_chat" as Preset,
                name: "Test Room",
                topic: "This is a topic https://github.com/matrix-org/matrix-react-sdk/pull/10060 with a link",
            });
            const { room_id: spaceId } = await bot.createRoom(spaceCreateOptions("Test Space", [roomId]));
            await bot.invite(spaceId, user.userId);
        });

        cy.getSpacePanelButton("Test Space").should("exist");
        cy.wait(500); // without this we can end up clicking too quickly and it ends up having no effect
        cy.viewSpaceByName("Test Space");
        cy.findByRole("button", { name: "Accept" }).click();

        // Regex pattern due to strings in "mx_SpaceHierarchy_roomTile_item"
        cy.findByRole("button", { name: /Test Room/ }).realHover();
        cy.findByRole("button", { name: "Join" }).should("exist").realHover().click();
        cy.findByRole("button", { name: "View", timeout: 5000 }).should("exist").realHover().click();

        // Assert we get shown the new room intro, and thus not the soft crash screen
        cy.get(".mx_NewRoomIntro").should("exist");
    });
});

/*
Copyright 2023 Suguru Hirahara

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

import type { MatrixClient } from "matrix-js-sdk/src/client";
import { HomeserverInstance } from "../../plugins/utils/homeserver";

describe("Invite dialog", function () {
    let homeserver: HomeserverInstance;
    let bot: MatrixClient;
    const botName = "BotAlice";

    beforeEach(() => {
        cy.startHomeserver("default").then((data) => {
            homeserver = data;
            cy.initTestUser(homeserver, "Hanako");

            cy.getBot(homeserver, { displayName: botName, autoAcceptInvites: true }).then((_bot) => {
                bot = _bot;
            });
        });
    });

    afterEach(() => {
        cy.stopHomeserver(homeserver);
    });

    it("should support inviting a user to a room", () => {
        // Create and view a room
        cy.createRoom({ name: "Test Room" }).viewRoomByName("Test Room");

        // Assert that the room was configured
        cy.findByText("Hanako created and configured the room.").should("exist");

        // Open the room info panel
        cy.findByRole("button", { name: "Room info" }).click();

        cy.get(".mx_RightPanel").within(() => {
            // Click "People" button on the panel
            // Regex pattern due to the string of "mx_BaseCard_Button_sublabel"
            cy.findByRole("button", { name: /People/ }).click();
        });

        cy.get(".mx_BaseCard_header").within(() => {
            // Click "Invite to this room" button
            // Regex pattern due to "mx_MemberList_invite span::before"
            cy.findByRole("button", { name: /Invite to this room/ }).click();
        });

        cy.get(".mx_InviteDialog_other").within(() => {
            cy.get(".mx_Dialog_header .mx_Dialog_title").within(() => {
                // Assert that the header is rendered
                cy.findByText("Invite to Test Room").should("exist");
            });

            // Assert that the bar is rendered
            cy.get(".mx_InviteDialog_addressBar").should("exist");
        });

        // TODO: unhide userId
        const percyCSS = ".mx_InviteDialog_helpText_userId { visibility: hidden !important; }";

        // Take a snapshot of the invite dialog including its wrapper
        cy.get(".mx_Dialog_wrapper").percySnapshotElement("Invite Dialog - Room (without a user)", { percyCSS });

        cy.get(".mx_InviteDialog_other").within(() => {
            cy.get(".mx_InviteDialog_identityServer").should("not.exist");

            cy.findByTestId("invite-dialog-input").type(bot.getUserId());

            // Assert that notification about identity servers appears after typing userId
            cy.get(".mx_InviteDialog_identityServer").should("exist");

            cy.get(".mx_InviteDialog_tile_nameStack").within(() => {
                cy.get(".mx_InviteDialog_tile_nameStack_userId").within(() => {
                    // Assert that the bot id is rendered properly
                    cy.findByText(bot.getUserId()).should("exist");
                });

                cy.get(".mx_InviteDialog_tile_nameStack_name").within(() => {
                    cy.findByText(botName).click();
                });
            });

            cy.get(".mx_InviteDialog_userTile_pill .mx_InviteDialog_userTile_name").within(() => {
                cy.findByText(botName).should("exist");
            });
        });

        // Take a snapshot of the invite dialog with a user pill
        cy.get(".mx_Dialog_wrapper").percySnapshotElement("Invite Dialog - Room (with a user pill)", { percyCSS });

        cy.get(".mx_InviteDialog_other").within(() => {
            // Invite the bot
            cy.findByRole("button", { name: "Invite" }).click();
        });

        // Assert that the invite dialog disappears
        cy.get(".mx_InviteDialog_other").should("not.exist");

        // Assert that they were invited and joined
        cy.findByText(`${botName} joined the room`).should("exist");
    });

    it("should support inviting a user to Direct Messages", () => {
        cy.get(".mx_RoomList").within(() => {
            cy.findByRole("button", { name: "Start chat" }).click();
        });

        cy.get(".mx_InviteDialog_other").within(() => {
            cy.get(".mx_Dialog_header .mx_Dialog_title").within(() => {
                // Assert that the header is rendered
                cy.findByText("Direct Messages").should("exist");
            });

            // Assert that the bar is rendered
            cy.get(".mx_InviteDialog_addressBar").should("exist");
        });

        // TODO: unhide userId and invite link
        const percyCSS =
            ".mx_InviteDialog_footer_link, .mx_InviteDialog_helpText_userId { visibility: hidden !important; }";

        // Take a snapshot of the invite dialog including its wrapper
        cy.get(".mx_Dialog_wrapper").percySnapshotElement("Invite Dialog - Direct Messages (without a user)", {
            percyCSS,
        });

        cy.get(".mx_InviteDialog_other").within(() => {
            cy.findByTestId("invite-dialog-input").type(bot.getUserId());

            cy.get(".mx_InviteDialog_tile_nameStack").within(() => {
                cy.findByText(bot.getUserId()).should("exist");
                cy.findByText(botName).click();
            });

            cy.get(".mx_InviteDialog_userTile_pill .mx_InviteDialog_userTile_name").within(() => {
                cy.findByText(botName).should("exist");
            });
        });

        // Take a snapshot of the invite dialog with a user pill
        cy.get(".mx_Dialog_wrapper").percySnapshotElement("Invite Dialog - Direct Messages (with a user pill)", {
            percyCSS,
        });

        cy.get(".mx_InviteDialog_other").within(() => {
            // Open a direct message UI
            cy.findByRole("button", { name: "Go" }).click();
        });

        // Assert that the invite dialog disappears
        cy.get(".mx_InviteDialog_other").should("not.exist");

        // Assert that the hovered user name on invitation UI does not have background color
        // TODO: implement the test on room-header.spec.ts
        cy.get(".mx_RoomHeader").within(() => {
            cy.get(".mx_RoomHeader_name--textonly")
                .realHover()
                .should("have.css", "background-color", "rgba(0, 0, 0, 0)");
        });

        // Send a message to invite the bots
        cy.getComposer().type("Hello{enter}");

        // Assert that they were invited and joined
        cy.findByText(`${botName} joined the room`).should("exist");

        // Assert that the message is displayed at the bottom
        cy.get(".mx_EventTile_last").findByText("Hello").should("exist");
    });
});

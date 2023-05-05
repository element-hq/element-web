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

/// <reference types="cypress" />

import { HomeserverInstance } from "../../plugins/utils/homeserver";
import { SettingLevel } from "../../../src/settings/SettingLevel";

describe("Room Header", () => {
    let homeserver: HomeserverInstance;

    beforeEach(() => {
        cy.startHomeserver("default").then((data) => {
            homeserver = data;
            cy.initTestUser(homeserver, "Sakura");
        });
    });

    afterEach(() => {
        cy.stopHomeserver(homeserver);
    });

    it("should render default buttons properly", () => {
        cy.createRoom({ name: "Test Room" }).viewRoomByName("Test Room");

        cy.get(".mx_RoomHeader").within(() => {
            // Names (aria-label) of every button rendered on mx_RoomHeader by default
            const expectedButtonNames = [
                "Room options", // The room name button next to the room avatar, which renders dropdown menu on click
                "Voice call",
                "Video call",
                "Search",
                "Threads",
                "Notifications",
                "Room info",
            ];

            // Assert they are found and visible
            for (const name of expectedButtonNames) {
                cy.findByRole("button", { name }).should("be.visible");
            }

            // Assert that just those seven buttons exist on mx_RoomHeader by default
            cy.findAllByRole("button").should("have.length", 7);
        });

        cy.get(".mx_RoomHeader").percySnapshotElement("Room header");
    });

    it("should render the pin button for pinned messages card", () => {
        cy.enableLabsFeature("feature_pinning");

        cy.createRoom({ name: "Test Room" }).viewRoomByName("Test Room");

        cy.getComposer().type("Test message{enter}");

        cy.get(".mx_EventTile_last").realHover().findByRole("button", { name: "Options" }).click();

        cy.findByRole("menuitem", { name: "Pin" }).should("be.visible").click();

        cy.get(".mx_RoomHeader").within(() => {
            cy.findByRole("button", { name: "Pinned messages" }).should("be.visible");
        });
    });

    it("should render a very long room name without collapsing the buttons", () => {
        const LONG_ROOM_NAME =
            "Lorem ipsum dolor sit amet, consectetur adipisicing elit, sed do eiusmod tempor incididunt ut labore " +
            "et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut " +
            "aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum " +
            "dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui " +
            "officia deserunt mollit anim id est laborum.";

        cy.createRoom({ name: LONG_ROOM_NAME }).viewRoomByName(LONG_ROOM_NAME);

        cy.get(".mx_RoomHeader").within(() => {
            // Wait until the room name is set
            cy.get(".mx_RoomHeader_nametext").within(() => {
                cy.findByText(LONG_ROOM_NAME).should("exist");
            });

            // Assert the size of buttons on RoomHeader are specified and the buttons are not compressed
            // Note these assertions do not check the size of mx_RoomHeader_name button
            // TODO: merge the assertions by using the same class name
            cy.get(".mx_RoomHeader_button")
                .should("have.length", 3)
                .should("be.visible")
                .should("have.css", "height", "32px")
                .should("have.css", "width", "32px");
            cy.get(".mx_RightPanel_headerButton")
                .should("have.length", 3)
                .should("be.visible")
                .should("have.css", "height", "32px")
                .should("have.css", "width", "32px");
        });

        cy.get(".mx_RoomHeader").percySnapshotElement("Room header - with a long room name", {
            widths: [300, 600], // Magic numbers to emulate the narrow RoomHeader on the actual UI
        });
    });

    it("should have buttons highlighted by being clicked", () => {
        cy.createRoom({ name: "Test Room" }).viewRoomByName("Test Room");

        cy.get(".mx_RoomHeader").within(() => {
            // Check these buttons
            const buttonsHighlighted = ["Threads", "Notifications", "Room info"];

            for (const name of buttonsHighlighted) {
                cy.findByRole("button", { name: name })
                    .click() // Highlight the button
                    .then(($btn) => {
                        // Note it is not possible to get CSS values of a pseudo class with "have.css".
                        const color = $btn[0].ownerDocument.defaultView // get window reference from element
                            .getComputedStyle($btn[0], "before") // get the pseudo selector
                            .getPropertyValue("background-color"); // get "background-color" value

                        // Assert the value is equal to $accent == hex #0dbd8b == rgba(13, 189, 139)
                        expect(color).to.eq("rgb(13, 189, 139)");
                    });
            }
        });

        cy.get(".mx_RoomHeader").percySnapshotElement("Room header - with a highlighted button");
    });

    describe("with a video room", () => {
        const createVideoRoom = () => {
            // Enable video rooms. This command reloads the app
            cy.setSettingValue("feature_video_rooms", null, SettingLevel.DEVICE, true);

            cy.get(".mx_LeftPanel_roomListContainer", { timeout: 20000 })
                .findByRole("button", { name: "Add room" })
                .click();

            cy.findByRole("menuitem", { name: "New video room" }).click();

            cy.findByRole("textbox", { name: "Name" }).type("Test video room");

            cy.findByRole("button", { name: "Create video room" }).click();

            cy.viewRoomByName("Test video room");
        };

        it("should render buttons for room options, beta pill, invite, chat, and room info", () => {
            createVideoRoom();

            cy.get(".mx_RoomHeader").within(() => {
                // Names (aria-label) of the buttons on the video room header
                const expectedButtonNames = [
                    "Room options",
                    "Video rooms are a beta feature Click for more info", // Beta pill
                    "Invite",
                    "Chat",
                    "Room info",
                ];

                // Assert they are found and visible
                for (const name of expectedButtonNames) {
                    cy.findByRole("button", { name }).should("be.visible");
                }

                // Assert that there is not a button except those buttons
                cy.findAllByRole("button").should("have.length", 5);
            });

            cy.get(".mx_RoomHeader").percySnapshotElement("Room header - with a video room");
        });

        it("should render a working chat button which opens the timeline on a right panel", () => {
            createVideoRoom();

            cy.get(".mx_RoomHeader").findByRole("button", { name: "Chat" }).click();

            // Assert that the video is rendered
            cy.get(".mx_CallView video").should("exist");

            cy.get(".mx_RightPanel .mx_TimelineCard")
                .should("exist")
                .within(() => {
                    // Assert that GELS is visible
                    cy.findByText("Sakura created and configured the room.").should("exist");
                });
        });
    });
});

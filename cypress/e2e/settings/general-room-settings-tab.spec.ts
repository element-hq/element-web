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

describe("General room settings tab", () => {
    let homeserver: HomeserverInstance;
    const roomName = "Test Room";

    beforeEach(() => {
        cy.startHomeserver("default").then((data) => {
            homeserver = data;
            cy.initTestUser(homeserver, "Hanako");

            cy.createRoom({ name: roomName }).viewRoomByName(roomName);
        });
    });

    afterEach(() => {
        cy.stopHomeserver(homeserver);
    });

    it("should be rendered properly", () => {
        cy.openRoomSettings("General");

        // Assert that "Show less" details element is rendered
        cy.findByText("Show less").should("exist");

        cy.findByTestId("General").percySnapshotElement(
            "Room settings tab - General (Local addresses details area expanded)",
            {
                // Emulate TabbedView's actual min and max widths
                // 580: '.mx_UserSettingsDialog .mx_TabbedView' min-width
                // 796: 1036 (mx_TabbedView_tabsOnLeft actual width) - 240 (mx_TabbedView_tabPanel margin-right)
                widths: [580, 796],
            },
        );

        // Click the "Show less" details element
        cy.findByText("Show less").click();

        // Assert that "Show more" details element is rendered instead of "Show more"
        cy.findByText("Show less").should("not.exist");
        cy.findByText("Show more").should("exist");

        cy.findByTestId("General").percySnapshotElement(
            "Room settings tab - General (Local addresses details area collapsed)",
            {
                // Emulate TabbedView's actual min and max widths
                // 580: '.mx_UserSettingsDialog .mx_TabbedView' min-width
                // 796: 1036 (mx_TabbedView_tabsOnLeft actual width) - 240 (mx_TabbedView_tabPanel margin-right)
                widths: [580, 796],
            },
        );
    });

    it("long address should not cause dialog to overflow", () => {
        cy.openRoomSettings("General");
        // 1. Set the room-address to be a really long string
        const longString =
            "abcasdhjasjhdaj1jh1asdhasjdhajsdhjavhjksdnfjasdhfjh21jh3j12h3jashfcjbabbabasdbdasjh1j23hk1l2j3lamajshdjkltyiuwioeuqpirjdfmngsdnf8378234jskdfjkdfnbnsdfbasjbdjashdajshfgngnsdkfsdkkqwijeqiwjeiqhrkldfnaskldklasdn";
        cy.get("#roomAliases").within(() => {
            cy.get("input[label='Room address']").type(longString);
            cy.contains("Add").click();
        });

        // 2. wait for the new setting to apply ...
        cy.get("#canonicalAlias").should("have.value", `#${longString}:localhost`);

        // 3. Check if the dialog overflows
        cy.get(".mx_Dialog")
            .invoke("outerWidth")
            .then((dialogWidth) => {
                cy.get("#canonicalAlias")
                    .invoke("outerWidth")
                    .then((fieldWidth) => {
                        // Assert that the width of the select element is less than that of .mx_Dialog div.
                        expect(fieldWidth).to.be.lessThan(dialogWidth);
                    });
            });
    });
});

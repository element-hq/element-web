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

const ROOM_NAME = "Test room";
const NAME = "Alice";

describe("NotificationPanel", () => {
    let homeserver: HomeserverInstance;

    beforeEach(() => {
        cy.startHomeserver("default").then((data) => {
            homeserver = data;
            cy.initTestUser(homeserver, NAME).then(() => {
                cy.createRoom({ name: ROOM_NAME });
            });
        });
    });

    afterEach(() => {
        cy.stopHomeserver(homeserver);
    });

    it("should render empty state", () => {
        cy.viewRoomByName(ROOM_NAME);
        cy.findByRole("button", { name: "Notifications" }).click();

        // Wait until the information about the empty state is rendered
        cy.get(".mx_NotificationPanel_empty").should("exist");

        // Take a snapshot of RightPanel
        cy.get(".mx_RightPanel").percySnapshotElement("Notification Panel - empty", {
            widths: [264], // Emulate the UI. The value is based on minWidth specified on MainSplit.tsx
        });
    });
});

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

describe("LeftPanel", () => {
    let homeserver: HomeserverInstance;

    beforeEach(() => {
        cy.startHomeserver("default").then((data) => {
            homeserver = data;

            cy.initTestUser(homeserver, "Hanako");
        });
    });

    afterEach(() => {
        cy.stopHomeserver(homeserver);
    });

    it("should render the Rooms list", () => {
        // create rooms and check room names are correct
        cy.createRoom({ name: "Apple" }).then(() => cy.findByRole("treeitem", { name: "Apple" }));
        cy.createRoom({ name: "Pineapple" }).then(() => cy.findByRole("treeitem", { name: "Pineapple" }));
        cy.createRoom({ name: "Orange" }).then(() => cy.findByRole("treeitem", { name: "Orange" }));
    });
});

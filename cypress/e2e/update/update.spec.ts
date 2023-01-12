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

describe("Update", () => {
    let homeserver: HomeserverInstance;

    beforeEach(() => {
        cy.startHomeserver("default").then((data) => {
            homeserver = data;
        });
    });

    afterEach(() => {
        cy.stopHomeserver(homeserver);
    });

    it("should navigate to ?updated=$VERSION if realises it is immediately out of date on load", () => {
        const NEW_VERSION = "some-new-version";

        cy.intercept("/version*", {
            statusCode: 200,
            body: NEW_VERSION,
            headers: {
                "Content-Type": "test/plain",
            },
        }).as("version");

        cy.initTestUser(homeserver, "Ursa");

        cy.wait("@version");
        cy.url()
            .should("contain", "updated=" + NEW_VERSION)
            .then((href) => {
                const url = new URL(href);
                expect(url.searchParams.get("updated")).to.equal(NEW_VERSION);
            });
    });
});

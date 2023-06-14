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

function assertNoToasts(): void {
    cy.get(".mx_Toast_toast").should("not.exist");
}

function getToast(expectedTitle: string): Chainable<JQuery> {
    return cy.contains(".mx_Toast_toast h2", expectedTitle).should("exist").closest(".mx_Toast_toast");
}

function acceptToast(expectedTitle: string): void {
    getToast(expectedTitle).within(() => {
        cy.get(".mx_Toast_buttons .mx_AccessibleButton_kind_primary").click();
    });
}

function rejectToast(expectedTitle: string): void {
    getToast(expectedTitle).within(() => {
        cy.get(".mx_Toast_buttons .mx_AccessibleButton_kind_danger_outline").click();
    });
}

describe("Analytics Toast", () => {
    let homeserver: HomeserverInstance;

    afterEach(() => {
        cy.stopHomeserver(homeserver);
    });

    it("should not show an analytics toast if config has nothing about posthog", () => {
        cy.intercept("/config.json?cachebuster=*", (req) => {
            req.continue((res) => {
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                const { posthog, ...body } = res.body;
                res.send(200, body);
            });
        });

        cy.startHomeserver("default").then((data) => {
            homeserver = data;
            cy.initTestUser(homeserver, "Tod");
        });

        rejectToast("Notifications");
        assertNoToasts();
    });

    describe("with posthog enabled", () => {
        beforeEach(() => {
            cy.intercept("/config.json?cachebuster=*", (req) => {
                req.continue((res) => {
                    res.send(200, {
                        ...res.body,
                        posthog: {
                            project_api_key: "foo",
                            api_host: "bar",
                        },
                    });
                });
            });

            cy.startHomeserver("default").then((data) => {
                homeserver = data;
                cy.initTestUser(homeserver, "Tod");
                rejectToast("Notifications");
            });
        });

        it("should show an analytics toast which can be accepted", () => {
            acceptToast("Help improve Element");
            assertNoToasts();
        });

        it("should show an analytics toast which can be rejected", () => {
            rejectToast("Help improve Element");
            assertNoToasts();
        });
    });
});

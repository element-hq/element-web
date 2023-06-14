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

describe("Security user settings tab", () => {
    let homeserver: HomeserverInstance;

    afterEach(() => {
        cy.stopHomeserver(homeserver);
    });

    describe("with posthog enabled", () => {
        beforeEach(() => {
            // Enable posthog
            cy.intercept("/config.json?cachebuster=*", (req) => {
                req.continue((res) => {
                    res.send(200, {
                        ...res.body,
                        posthog: {
                            project_api_key: "foo",
                            api_host: "bar",
                        },
                        privacy_policy_url: "example.tld", // Set privacy policy URL to enable privacyPolicyLink
                    });
                });
            });

            cy.startHomeserver("default").then((data) => {
                homeserver = data;
                cy.initTestUser(homeserver, "Hanako");
            });

            // Hide "Notification" toast on Cypress Cloud
            cy.contains(".mx_Toast_toast h2", "Notifications")
                .should("exist")
                .closest(".mx_Toast_toast")
                .within(() => {
                    cy.findByRole("button", { name: "Dismiss" }).click();
                });

            cy.get(".mx_Toast_buttons").within(() => {
                cy.findByRole("button", { name: "Yes" }).should("exist").click(); // Allow analytics
            });

            cy.openUserSettings("Security");
        });

        describe("AnalyticsLearnMoreDialog", () => {
            it("should be rendered properly", () => {
                cy.findByRole("button", { name: "Learn more" }).click();

                cy.get(".mx_AnalyticsLearnMoreDialog_wrapper").percySnapshotElement("AnalyticsLearnMoreDialog");
            });
        });
    });
});

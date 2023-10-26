/*
Copyright 2023 The Matrix.org Foundation C.I.C.

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

import { HomeserverInstance } from "../../plugins/utils/homeserver";
import { UserCredentials } from "../../support/login";
import { doTokenRegistration } from "./utils";

describe("Soft logout", () => {
    let homeserver: HomeserverInstance;

    beforeEach(() => {
        cy.task("startOAuthServer")
            .then((oAuthServerPort: number) => {
                return cy.startHomeserver({ template: "default", oAuthServerPort });
            })
            .then((data) => {
                homeserver = data;
            });
    });

    afterEach(() => {
        cy.stopHomeserver(homeserver);
    });

    describe("with password user", () => {
        let testUserCreds: UserCredentials;

        beforeEach(() => {
            cy.initTestUser(homeserver, "Alice").then((creds) => {
                testUserCreds = creds;
            });
        });

        it("shows the soft-logout page when a request fails, and allows a re-login", () => {
            interceptRequestsWithSoftLogout();
            cy.findByText("You're signed out");
            cy.findByPlaceholderText("Password").type(testUserCreds.password).type("{enter}");

            // back to the welcome page
            cy.url().should("contain", "/#/home", { timeout: 30000 });
            cy.findByRole("heading", { name: "Welcome Alice" });
        });

        it("still shows the soft-logout page when the page is reloaded after a soft-logout", () => {
            interceptRequestsWithSoftLogout();
            cy.findByText("You're signed out");
            cy.reload();
            cy.findByText("You're signed out");
        });
    });

    describe("with SSO user", () => {
        beforeEach(() => {
            doTokenRegistration(homeserver.baseUrl);

            // Eventually, we should end up at the home screen.
            cy.url().should("contain", "/#/home", { timeout: 30000 });
            cy.findByRole("heading", { name: "Welcome Alice" });
        });

        it("shows the soft-logout page when a request fails, and allows a re-login", () => {
            cy.findByRole("heading", { name: "Welcome Alice" });

            interceptRequestsWithSoftLogout();

            cy.findByText("You're signed out");
            cy.findByRole("button", { name: "Continue with OAuth test" }).click();

            // click the submit button
            cy.findByRole("button", { name: "Submit" }).click();

            // Synapse prompts us to grant permission to Element
            cy.findByRole("heading", { name: "Continue to your account" });
            cy.findByRole("link", { name: "Continue" }).click();

            // back to the welcome page
            cy.url().should("contain", "/#/home", { timeout: 30000 });
            cy.findByRole("heading", { name: "Welcome Alice" });
        });
    });
});

/**
 * Intercept calls to /sync and have them fail with a soft-logout
 *
 * Any further requests to /sync with the same access token are blocked.
 */
function interceptRequestsWithSoftLogout(): void {
    let expiredAccessToken: string | null = null;
    cy.intercept(
        {
            pathname: "/_matrix/client/*/sync",
        },
        (req) => {
            const accessToken = req.headers["authorization"] as string;

            // on the first request, record the access token
            if (!expiredAccessToken) {
                console.log(`Soft-logout on access token ${accessToken}`);
                expiredAccessToken = accessToken;
            }

            // now, if the access token on this request matches the expired one, block it
            if (expiredAccessToken && accessToken === expiredAccessToken) {
                console.log(`Intercepting request with soft-logged-out access token`);
                req.reply({
                    statusCode: 401,
                    body: {
                        errcode: "M_UNKNOWN_TOKEN",
                        error: "Soft logout",
                        soft_logout: true,
                    },
                });
                return;
            }

            // otherwise, pass through as normal
            req.continue();
        },
    );

    // do something to make the active /sync return: create a new room
    cy.getClient().then((client) => {
        // don't wait for this to complete: it probably won't, because of the broken sync
        return client.createRoom({});
    });
}

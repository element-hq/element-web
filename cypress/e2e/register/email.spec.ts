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

/// <reference types="cypress" />

import { HomeserverInstance } from "../../plugins/utils/homeserver";
import { Mailhog } from "../../support/mailhog";

describe("Email Registration", () => {
    let homeserver: HomeserverInstance;
    let mailhog: Mailhog;

    beforeEach(() => {
        cy.startMailhog().then((_mailhog) => {
            mailhog = _mailhog;
            cy.startHomeserver({
                template: "email",
                variables: {
                    SMTP_HOST: "{{HOST_DOCKER_INTERNAL}}", // This will get replaced in synapseStart
                    SMTP_PORT: _mailhog.instance.smtpPort,
                },
            }).then((_homeserver) => {
                homeserver = _homeserver;

                cy.intercept(
                    { method: "GET", pathname: "/config.json" },
                    {
                        body: {
                            default_server_config: {
                                "m.homeserver": {
                                    base_url: homeserver.baseUrl,
                                },
                                "m.identity_server": {
                                    base_url: "https://server.invalid",
                                },
                            },
                        },
                    },
                );
                cy.visit("/#/register");
                cy.injectAxe();
            });
        });
    });

    afterEach(() => {
        cy.stopHomeserver(homeserver);
        cy.stopMailhog(mailhog);
    });

    it("registers an account and lands on the use case selection screen", () => {
        cy.findByRole("textbox", { name: "Username" }).should("be.visible");
        // Hide the server text as it contains the randomly allocated Homeserver port
        const percyCSS = ".mx_ServerPicker_server { visibility: hidden !important; }";

        cy.findByRole("textbox", { name: "Username" }).type("alice");
        cy.findByPlaceholderText("Password").type("totally a great password");
        cy.findByPlaceholderText("Confirm password").type("totally a great password");
        cy.findByPlaceholderText("Email").type("alice@email.com");
        cy.findByRole("button", { name: "Register" }).click();

        cy.findByText("Check your email to continue").should("be.visible");
        cy.percySnapshot("Registration check your email", { percyCSS });
        cy.checkA11y();

        cy.findByText("An error was encountered when sending the email").should("not.exist");

        cy.waitForPromise(async () => {
            const messages = await mailhog.api.messages();
            expect(messages.items).to.have.length(1);
            expect(messages.items[0].to).to.eq("alice@email.com");
            const [link] = messages.items[0].text.match(/http.+/);
            return link;
        }).as("emailLink");

        cy.get<string>("@emailLink").then((link) => cy.request(link));

        cy.get(".mx_UseCaseSelection_skip", { timeout: 30000 }).should("exist");
    });
});

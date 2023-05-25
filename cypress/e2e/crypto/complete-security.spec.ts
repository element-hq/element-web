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

import type { VerificationRequest } from "matrix-js-sdk/src/crypto/verification/request/VerificationRequest";
import { HomeserverInstance } from "../../plugins/utils/homeserver";
import { handleVerificationRequest, logIntoElement, waitForVerificationRequest } from "./utils";
import { CypressBot } from "../../support/bot";
import { skipIfRustCrypto } from "../../support/util";

describe("Complete security", () => {
    let homeserver: HomeserverInstance;

    beforeEach(() => {
        cy.startHomeserver("default").then((data) => {
            homeserver = data;
        });
        // visit the login page of the app, to load the matrix sdk
        cy.visit("/#/login");

        // wait for the page to load
        cy.window({ log: false }).should("have.property", "matrixcs");
    });

    afterEach(() => {
        cy.stopHomeserver(homeserver);
    });

    it("should go straight to the welcome screen if we have no signed device", () => {
        const username = Cypress._.uniqueId("user_");
        const password = "supersecret";
        cy.registerUser(homeserver, username, password, "Jeff");
        logIntoElement(homeserver.baseUrl, username, password);
        cy.findByText("Welcome Jeff");
    });

    it("should walk through device verification if we have a signed device", () => {
        skipIfRustCrypto();

        // create a new user, and have it bootstrap cross-signing
        let botClient: CypressBot;
        cy.getBot(homeserver, { displayName: "Jeff" })
            .then(async (bot) => {
                botClient = bot;
                await bot.bootstrapCrossSigning({});
            })
            .then(() => {
                // now log in, in Element. We go in through the login page because otherwise the device setup flow
                // doesn't get triggered
                console.log("%cAccount set up; logging in user", "font-weight: bold; font-size:x-large");
                logIntoElement(homeserver.baseUrl, botClient.getSafeUserId(), botClient.__cypress_password);

                // we should see a prompt for a device verification
                cy.findByRole("heading", { name: "Verify this device" });
                const botVerificationRequestPromise = waitForVerificationRequest(botClient);
                cy.findByRole("button", { name: "Verify with another device" }).click();

                // accept the verification request on the "bot" side
                cy.wrap(botVerificationRequestPromise).then(async (verificationRequest: VerificationRequest) => {
                    await handleVerificationRequest(verificationRequest);
                });

                // confirm that the emojis match
                cy.findByRole("button", { name: "They match" }).click();

                // we should get the confirmation box
                cy.findByText(/You've successfully verified/);

                cy.findByRole("button", { name: "Got it" }).click();
            });
    });
});

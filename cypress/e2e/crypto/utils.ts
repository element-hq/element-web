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

import type { ICreateRoomOpts, MatrixClient } from "matrix-js-sdk/src/matrix";
import type { ISasEvent } from "matrix-js-sdk/src/crypto/verification/SAS";
import type { VerificationRequest, Verifier } from "matrix-js-sdk/src/crypto-api";

export type EmojiMapping = [emoji: string, name: string];

/**
 * wait for the given client to receive an incoming verification request, and automatically accept it
 *
 * @param cli - matrix client we expect to receive a request
 */
export function waitForVerificationRequest(cli: MatrixClient): Promise<VerificationRequest> {
    return new Promise<VerificationRequest>((resolve) => {
        const onVerificationRequestEvent = async (request: VerificationRequest) => {
            await request.accept();
            resolve(request);
        };
        // @ts-ignore CryptoEvent is not exported to window.matrixcs; using the string value here
        cli.once("crypto.verificationRequestReceived", onVerificationRequestEvent);
    });
}

/**
 * Automatically handle a SAS verification
 *
 * Given a verifier which has already been started, wait for the emojis to be received, blindly confirm they
 * match, and return them
 *
 * @param verifier - verifier
 * @returns A promise that resolves, with the emoji list, once we confirm the emojis
 */
export function handleSasVerification(verifier: Verifier): Promise<EmojiMapping[]> {
    return new Promise<EmojiMapping[]>((resolve) => {
        const onShowSas = (event: ISasEvent) => {
            // @ts-ignore VerifierEvent is a pain to get at here as we don't have a reference to matrixcs;
            // using the string value here
            verifier.off("show_sas", onShowSas);
            event.confirm();
            resolve(event.sas.emoji);
        };

        // @ts-ignore as above, avoiding reference to VerifierEvent
        verifier.on("show_sas", onShowSas);
    });
}

/**
 * Check that the user has published cross-signing keys, and that the user's device has been cross-signed.
 */
export function checkDeviceIsCrossSigned(): void {
    let userId: string;
    let myDeviceId: string;
    cy.window({ log: false })
        .then((win) => {
            // Get the userId and deviceId of the current user
            const cli = win.mxMatrixClientPeg.get();
            const accessToken = cli.getAccessToken()!;
            const homeserverUrl = cli.getHomeserverUrl();
            myDeviceId = cli.getDeviceId();
            userId = cli.getUserId();
            return cy.request({
                method: "POST",
                url: `${homeserverUrl}/_matrix/client/v3/keys/query`,
                headers: { Authorization: `Bearer ${accessToken}` },
                body: { device_keys: { [userId]: [] } },
            });
        })
        .then((res) => {
            // there should be three cross-signing keys
            expect(res.body.master_keys[userId]).to.have.property("keys");
            expect(res.body.self_signing_keys[userId]).to.have.property("keys");
            expect(res.body.user_signing_keys[userId]).to.have.property("keys");

            // and the device should be signed by the self-signing key
            const selfSigningKeyId = Object.keys(res.body.self_signing_keys[userId].keys)[0];

            expect(res.body.device_keys[userId][myDeviceId]).to.exist;

            const myDeviceSignatures = res.body.device_keys[userId][myDeviceId].signatures[userId];
            expect(myDeviceSignatures[selfSigningKeyId]).to.exist;
        });
}

/**
 * Check that the current device is connected to the key backup.
 */
export function checkDeviceIsConnectedKeyBackup() {
    cy.findByRole("button", { name: "User menu" }).click();
    cy.get(".mx_UserMenu_contextMenu").within(() => {
        cy.findByRole("menuitem", { name: "Security & Privacy" }).click();
    });
    cy.get(".mx_Dialog").within(() => {
        cy.findByRole("button", { name: "Restore from Backup" }).should("exist");
    });
}

/**
 * Fill in the login form in element with the given creds.
 *
 * If a `securityKey` is given, verifies the new device using the key.
 */
export function logIntoElement(homeserverUrl: string, username: string, password: string, securityKey?: string) {
    cy.visit("/#/login");

    // select homeserver
    cy.findByRole("button", { name: "Edit" }).click();
    cy.findByRole("textbox", { name: "Other homeserver" }).type(homeserverUrl);
    cy.findByRole("button", { name: "Continue" }).click();

    // wait for the dialog to go away
    cy.get(".mx_ServerPickerDialog").should("not.exist");

    cy.findByRole("textbox", { name: "Username" }).type(username);
    cy.findByPlaceholderText("Password").type(password);
    cy.findByRole("button", { name: "Sign in" }).click();

    // if a securityKey was given, verify the new device
    if (securityKey !== undefined) {
        cy.get(".mx_AuthPage").within(() => {
            cy.findByRole("button", { name: "Verify with Security Key" }).click();
        });
        cy.get(".mx_Dialog").within(() => {
            // Fill in the security key
            cy.get('input[type="password"]').type(securityKey);
        });
        cy.contains(".mx_Dialog_primary:not([disabled])", "Continue").click();
        cy.findByRole("button", { name: "Done" }).click();
    }
}

/**
 * Queue up Cypress commands to log out of Element
 */
export function logOutOfElement() {
    cy.findByRole("button", { name: "User menu" }).click();
    cy.get(".mx_UserMenu_contextMenu").within(() => {
        cy.findByRole("menuitem", { name: "Sign out" }).click();
    });
    cy.get(".mx_Dialog .mx_QuestionDialog").within(() => {
        cy.findByRole("button", { name: "Sign out" }).click();
    });
}

/**
 * Given a SAS verifier for a bot client, add cypress commands to:
 *   - wait for the bot to receive the emojis
 *   - check that the bot sees the same emoji as the application
 *
 * @param botVerificationRequest - a verification request in a bot client
 */
export function doTwoWaySasVerification(verifier: Verifier): void {
    // on the bot side, wait for the emojis, confirm they match, and return them
    const emojiPromise = handleSasVerification(verifier);

    // then, check that our application shows an emoji panel with the same emojis.
    cy.wrap(emojiPromise).then((emojis: EmojiMapping[]) => {
        cy.get(".mx_VerificationShowSas_emojiSas_block").then((emojiBlocks) => {
            emojis.forEach((emoji: EmojiMapping, index: number) => {
                // VerificationShowSas munges the case of the emoji descriptions returned by the js-sdk before
                // displaying them. Once we drop support for legacy crypto, that code can go away, and so can the
                // case-munging here.
                expect(emojiBlocks[index].textContent.toLowerCase()).to.eq(emoji[0] + emoji[1].toLowerCase());
            });
        });
    });
}

/**
 * Queue up cypress commands to open the security settings and enable secure key backup.
 *
 * Assumes that the current device has been cross-signed (which means that we skip a step where we set it up).
 *
 * Stores the security key in `@securityKey`.
 */
export function enableKeyBackup() {
    cy.openUserSettings("Security & Privacy");
    cy.findByRole("button", { name: "Set up Secure Backup" }).click();
    cy.get(".mx_Dialog").within(() => {
        // Recovery key is selected by default
        cy.findByRole("button", { name: "Continue", timeout: 60000 }).click();

        // copy the text ourselves
        cy.get(".mx_CreateSecretStorageDialog_recoveryKey code").invoke("text").as("securityKey", { type: "static" });
        downloadKey();

        cy.findByText("Secure Backup successful").should("exist");
        cy.findByRole("button", { name: "Done" }).click();
        cy.findByText("Secure Backup successful").should("not.exist");
    });
}

/**
 * Queue up cypress commands to click on download button and continue
 */
export function downloadKey() {
    // Clicking download instead of Copy because of https://github.com/cypress-io/cypress/issues/2851
    cy.findByRole("button", { name: "Download" }).click();
    cy.contains(".mx_Dialog_primary:not([disabled])", "Continue").click();
}

/**
 * Create a shared, unencrypted room with the given user, and wait for them to join
 *
 * @param other - UserID of the other user
 * @param opts - other options for the createRoom call
 *
 * @returns a cypress chainable which will yield the room ID
 */
export function createSharedRoomWithUser(
    other: string,
    opts: Omit<ICreateRoomOpts, "invite"> = { name: "TestRoom" },
): Cypress.Chainable<string> {
    return cy.createRoom({ ...opts, invite: [other] }).then((roomId) => {
        cy.log(`Created test room ${roomId}`);
        cy.viewRoomById(roomId);

        // wait for the other user to join the room, otherwise our attempt to open his user details may race
        // with his join.
        cy.findByText(" joined the room", { exact: false }).should("exist");

        // Cypress complains if we return an immediate here rather than a promise.
        return Promise.resolve(roomId);
    });
}

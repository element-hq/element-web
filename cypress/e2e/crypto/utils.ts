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

import type { ISasEvent } from "matrix-js-sdk/src/crypto/verification/SAS";
import type { MatrixClient } from "matrix-js-sdk/src/matrix";
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
 * Fill in the login form in element with the given creds
 */
export function logIntoElement(homeserverUrl: string, username: string, password: string) {
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

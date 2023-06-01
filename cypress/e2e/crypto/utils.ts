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
import type { VerificationRequest } from "matrix-js-sdk/src/crypto/verification/request/VerificationRequest";

export type EmojiMapping = [emoji: string, name: string];

/**
 * wait for the given client to receive an incoming verification request, and automatically accept it
 *
 * @param cli - matrix client we expect to receive a request
 */
export function waitForVerificationRequest(cli: MatrixClient): Promise<VerificationRequest> {
    return new Promise<VerificationRequest>((resolve) => {
        const onVerificationRequestEvent = async (request: VerificationRequest) => {
            // @ts-ignore CryptoEvent is not exported to window.matrixcs; using the string value here
            cli.off("crypto.verification.request", onVerificationRequestEvent);
            await request.accept();
            resolve(request);
        };
        // @ts-ignore
        cli.on("crypto.verification.request", onVerificationRequestEvent);
    });
}

/**
 * Automatically handle an incoming verification request
 *
 * Starts the key verification process, and, once it is accepted on the other side, confirms that the
 * emojis match.
 *
 * @param request - incoming verification request
 * @returns A promise that resolves, with the emoji list, once we confirm the emojis
 */
export function handleVerificationRequest(request: VerificationRequest): Promise<EmojiMapping[]> {
    return new Promise<EmojiMapping[]>((resolve) => {
        const onShowSas = (event: ISasEvent) => {
            // @ts-ignore VerifierEvent is a pain to get at here as we don't have a reference to matrixcs;
            // using the string value here
            verifier.off("show_sas", onShowSas);
            event.confirm();
            resolve(event.sas.emoji);
        };

        const verifier = request.beginKeyVerification("m.sas.v1");
        // @ts-ignore as above, avoiding reference to VerifierEvent
        verifier.on("show_sas", onShowSas);
        verifier.verify();
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

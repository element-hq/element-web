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
 * wait for the given client to receive an incoming verification request
 *
 * @param cli - matrix client we expect to receive a request
 */
export function waitForVerificationRequest(cli: MatrixClient): Promise<VerificationRequest> {
    return new Promise<VerificationRequest>((resolve) => {
        const onVerificationRequestEvent = (request: VerificationRequest) => {
            // @ts-ignore CryptoEvent is not exported to window.matrixcs; using the string value here
            cli.off("crypto.verification.request", onVerificationRequestEvent);
            resolve(request);
        };
        // @ts-ignore
        cli.on("crypto.verification.request", onVerificationRequestEvent);
    });
}

/**
 * Handle an incoming verification request
 *
 * Starts the key verification process, and, once it is accepted on the other side, confirms that the
 * emojis match.
 *
 * Returns a promise that resolves, with the emoji list, once we confirm the emojis
 *
 * @param request - incoming verification request
 */
export function handleVerificationRequest(request: VerificationRequest) {
    return new Promise<EmojiMapping[]>((resolve) => {
        const onShowSas = (event: ISasEvent) => {
            verifier.off("show_sas", onShowSas);
            event.confirm();
            verifier.done();
            resolve(event.sas.emoji);
        };

        const verifier = request.beginKeyVerification("m.sas.v1");
        verifier.on("show_sas", onShowSas);
        verifier.verify();
    });
}

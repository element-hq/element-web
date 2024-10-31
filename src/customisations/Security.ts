/*
Copyright 2024 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/
import { CryptoCallbacks } from "matrix-js-sdk/src/crypto-api";

import { IMatrixClientCreds } from "../MatrixClientPeg";
import { Kind as SetupEncryptionKind } from "../toasts/SetupEncryptionToast";

/* eslint-disable-next-line @typescript-eslint/no-unused-vars */
function examineLoginResponse(response: any, credentials: IMatrixClientCreds): void {
    // E.g. add additional data to the persisted credentials
}

/* eslint-disable-next-line @typescript-eslint/no-unused-vars */
function persistCredentials(credentials: IMatrixClientCreds): void {
    // E.g. store any additional credential fields
}

/* eslint-disable-next-line @typescript-eslint/no-unused-vars */
function createSecretStorageKey(): Uint8Array | null {
    // E.g. generate or retrieve secret storage key somehow
    return null;
}

/* eslint-disable-next-line @typescript-eslint/no-unused-vars */
function getSecretStorageKey(): Uint8Array | null {
    // E.g. retrieve secret storage key from some other place
    return null;
}

/* eslint-disable-next-line @typescript-eslint/no-unused-vars */
function catchAccessSecretStorageError(e: unknown): void {
    // E.g. notify the user in some way
}

/* eslint-disable-next-line @typescript-eslint/no-unused-vars */
function setupEncryptionNeeded(kind: SetupEncryptionKind): boolean {
    // E.g. trigger some kind of setup
    return false;
}

// This interface summarises all available customisation points and also marks
// them all as optional. This allows customisers to only define and export the
// customisations they need while still maintaining type safety.
export interface ISecurityCustomisations {
    examineLoginResponse?: typeof examineLoginResponse;
    persistCredentials?: typeof persistCredentials;
    createSecretStorageKey?: typeof createSecretStorageKey;
    getSecretStorageKey?: typeof getSecretStorageKey;
    catchAccessSecretStorageError?: typeof catchAccessSecretStorageError;
    setupEncryptionNeeded?: typeof setupEncryptionNeeded;
    getDehydrationKey?: CryptoCallbacks["getDehydrationKey"];

    /**
     * When false, disables the post-login UI from showing. If there's
     * an error during setup, that will be shown to the user.
     *
     * Note: when this is set to false then the app will assume the user's
     * encryption is set up some other way which would circumvent the default
     * UI, such as by presenting alternative UI.
     */
    SHOW_ENCRYPTION_SETUP_UI?: boolean; // default true
}

// A real customisation module will define and export one or more of the
// customisation points that make up `ISecurityCustomisations`.
export default {
    SHOW_ENCRYPTION_SETUP_UI: true,
} as ISecurityCustomisations;

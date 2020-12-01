/*
Copyright 2020 The Matrix.org Foundation C.I.C.

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

import { IMatrixClientCreds } from "../MatrixClientPeg";
import { Kind as SetupEncryptionKind } from "../toasts/SetupEncryptionToast";
import { ISecretStorageKeyInfo } from 'matrix-js-sdk/src/matrix';

/* eslint-disable-next-line @typescript-eslint/no-unused-vars */
function examineLoginResponse(
    response: any,
    credentials: IMatrixClientCreds,
): void {
    // E.g. add additional data to the persisted credentials
}

/* eslint-disable-next-line @typescript-eslint/no-unused-vars */
function persistCredentials(
    credentials: IMatrixClientCreds,
): void {
    // E.g. store any additional credential fields
}

/* eslint-disable-next-line @typescript-eslint/no-unused-vars */
function createSecretStorageKey(): Uint8Array {
    // E.g. generate or retrieve secret storage key somehow
    return null;
}

/* eslint-disable-next-line @typescript-eslint/no-unused-vars */
function getSecretStorageKey(): Uint8Array {
    // E.g. retrieve secret storage key from some other place
    return null;
}

/* eslint-disable-next-line @typescript-eslint/no-unused-vars */
function getDehydrationKey(
    keyInfo: ISecretStorageKeyInfo,
): Promise<Uint8Array> {
    return Promise.resolve(null);
}

/* eslint-disable-next-line @typescript-eslint/no-unused-vars */
function catchAccessSecretStorageError(e: Error): void {
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
    createSecretStorageKey?: typeof createSecretStorageKey,
    getSecretStorageKey?: typeof getSecretStorageKey,
    catchAccessSecretStorageError?: typeof catchAccessSecretStorageError,
    setupEncryptionNeeded?: typeof setupEncryptionNeeded,
    getDehydrationKey?: typeof getDehydrationKey,
}

// A real customisation module will define and export one or more of the
// customisation points that make up `ISecurityCustomisations`.
export default {} as ISecurityCustomisations;

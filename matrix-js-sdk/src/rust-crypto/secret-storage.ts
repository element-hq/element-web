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

import { ServerSideSecretStorage } from "../secret-storage";

/**
 * Check that the private cross signing keys (master, self signing, user signing) are stored in the secret storage and encrypted with the same secret storage key.
 *
 * @param secretStorage - The secret store using account data
 * @returns True if the cross-signing keys are all stored and encrypted with the same secret storage key.
 */
export async function secretStorageContainsCrossSigningKeys(secretStorage: ServerSideSecretStorage): Promise<boolean> {
    // Check if the master cross-signing key is stored in secret storage
    const secretStorageMasterKeys = await secretStorage.isStored("m.cross_signing.master");

    // Master key not stored
    if (!secretStorageMasterKeys) return false;

    // Get the user signing keys stored into the secret storage
    const secretStorageUserSigningKeys = (await secretStorage.isStored(`m.cross_signing.user_signing`)) || {};
    // Get the self signing keys stored into the secret storage
    const secretStorageSelfSigningKeys = (await secretStorage.isStored(`m.cross_signing.self_signing`)) || {};

    // Check that one of the secret storage keys used to encrypt the master key was also used to encrypt the user-signing and self-signing keys
    return Object.keys(secretStorageMasterKeys).some(
        (secretStorageKey) =>
            secretStorageUserSigningKeys[secretStorageKey] && secretStorageSelfSigningKeys[secretStorageKey],
    );
}

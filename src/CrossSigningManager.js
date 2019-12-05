/*
Copyright 2019 The Matrix.org Foundation C.I.C.

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

import Modal from './Modal';
import sdk from './index';
import { deriveKey } from 'matrix-js-sdk/lib/crypto/key_passphrase';
import { decodeRecoveryKey } from 'matrix-js-sdk/lib/crypto/recoverykey';

// This stores the cross-signing private keys in memory for the JS SDK. They are
// also persisted to Secure Secret Storage in account data by the JS SDK when
// created.
const crossSigningKeys = {};

// XXX: On desktop platforms, we plan to store only the SSSS default key in a
// secure enclave, while the cross-signing private keys will still be retrieved
// from SSSS, so it's unclear that we actually need these cross-signing
// application callbacks for Riot. Should the JS SDK default to in-memory
// storage of these itself?
export const getCrossSigningKey = k => crossSigningKeys[k];
export const saveCrossSigningKeys = newKeys => Object.assign(crossSigningKeys, newKeys);

// This stores the secret storage private keys in memory for the JS SDK. This is
// only meant to act as a cache to avoid prompting the user multiple times
// during the same session. It is considered unsafe to persist this to normal
// web storage. For platforms with a secure enclave, we will store this key
// there.
const secretStorageKeys = {};

// XXX: This flow should maybe be reworked to allow retries in case of typos,
// etc.
export const getSecretStorageKey = async ({ keys: keyInfos }) => {
    const keyInfoEntries = Object.entries(keyInfos);
    if (keyInfoEntries.length > 1) {
        throw new Error("Multiple storage key requests not implemented");
    }
    const [name, info] = keyInfoEntries[0];
    // Check the in-memory cache
    if (secretStorageKeys[name]) {
        return [name, secretStorageKeys[name]];
    }
    const AccessSecretStorageDialog =
        sdk.getComponent("dialogs.secretstorage.AccessSecretStorageDialog");
    const { finished } = Modal.createTrackedDialog("Access Secret Storage dialog", "",
        AccessSecretStorageDialog, {
        keyInfo: info,
    },
    );
    const [input] = await finished;
    if (!input) {
        throw new Error("Secret storage access canceled");
    }
    let key;
    if (input.passphrase) {
        key = await deriveKey(
            input.passphrase,
            info.passphrase.salt,
            info.passphrase.iterations,
        );
    } else {
        key = decodeRecoveryKey(input.recoveryKey);
    }
    // Save to cache to avoid future prompts in the current session
    secretStorageKeys[name] = key;
    return [name, key];
};

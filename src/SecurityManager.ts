/*
Copyright 2019, 2020 The Matrix.org Foundation C.I.C.

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

import {
    DeviceVerificationStatus,
    ICryptoCallbacks,
    MatrixClient,
    encodeBase64,
    SecretStorage,
} from "matrix-js-sdk/src/matrix";
import { deriveKey } from "matrix-js-sdk/src/crypto/key_passphrase";
import { decodeRecoveryKey } from "matrix-js-sdk/src/crypto/recoverykey";
import { logger } from "matrix-js-sdk/src/logger";

import type CreateSecretStorageDialog from "./async-components/views/dialogs/security/CreateSecretStorageDialog";
import Modal from "./Modal";
import { MatrixClientPeg } from "./MatrixClientPeg";
import { _t } from "./languageHandler";
import { isSecureBackupRequired } from "./utils/WellKnownUtils";
import AccessSecretStorageDialog, { KeyParams } from "./components/views/dialogs/security/AccessSecretStorageDialog";
import RestoreKeyBackupDialog from "./components/views/dialogs/security/RestoreKeyBackupDialog";
import SettingsStore from "./settings/SettingsStore";
import { ModuleRunner } from "./modules/ModuleRunner";
import QuestionDialog from "./components/views/dialogs/QuestionDialog";
import InteractiveAuthDialog from "./components/views/dialogs/InteractiveAuthDialog";

// This stores the secret storage private keys in memory for the JS SDK. This is
// only meant to act as a cache to avoid prompting the user multiple times
// during the same single operation. Use `accessSecretStorage` below to scope a
// single secret storage operation, as it will clear the cached keys once the
// operation ends.
let secretStorageKeys: Record<string, Uint8Array> = {};
let secretStorageKeyInfo: Record<string, SecretStorage.SecretStorageKeyDescription> = {};
let secretStorageBeingAccessed = false;

let nonInteractive = false;

let dehydrationCache: {
    key?: Uint8Array;
    keyInfo?: SecretStorage.SecretStorageKeyDescription;
} = {};

function isCachingAllowed(): boolean {
    return secretStorageBeingAccessed;
}

/**
 * This can be used by other components to check if secret storage access is in
 * progress, so that we can e.g. avoid intermittently showing toasts during
 * secret storage setup.
 *
 * @returns {bool}
 */
export function isSecretStorageBeingAccessed(): boolean {
    return secretStorageBeingAccessed;
}

export class AccessCancelledError extends Error {
    public constructor() {
        super("Secret storage access canceled");
    }
}

async function confirmToDismiss(): Promise<boolean> {
    const [sure] = await Modal.createDialog(QuestionDialog, {
        title: _t("encryption|cancel_entering_passphrase_title"),
        description: _t("encryption|cancel_entering_passphrase_description"),
        danger: false,
        button: _t("action|go_back"),
        cancelButton: _t("action|cancel"),
    }).finished;
    return !sure;
}

function makeInputToKey(
    keyInfo: SecretStorage.SecretStorageKeyDescription,
): (keyParams: KeyParams) => Promise<Uint8Array> {
    return async ({ passphrase, recoveryKey }): Promise<Uint8Array> => {
        if (passphrase) {
            return deriveKey(passphrase, keyInfo.passphrase.salt, keyInfo.passphrase.iterations);
        } else if (recoveryKey) {
            return decodeRecoveryKey(recoveryKey);
        }
        throw new Error("Invalid input, passphrase or recoveryKey need to be provided");
    };
}

async function getSecretStorageKey({
    keys: keyInfos,
}: {
    keys: Record<string, SecretStorage.SecretStorageKeyDescription>;
}): Promise<[string, Uint8Array]> {
    const cli = MatrixClientPeg.safeGet();
    let keyId = await cli.getDefaultSecretStorageKeyId();
    let keyInfo!: SecretStorage.SecretStorageKeyDescription;
    if (keyId) {
        // use the default SSSS key if set
        keyInfo = keyInfos[keyId];
        if (!keyInfo) {
            // if the default key is not available, pretend the default key
            // isn't set
            keyId = null;
        }
    }
    if (!keyId) {
        // if no default SSSS key is set, fall back to a heuristic of using the
        // only available key, if only one key is set
        const keyInfoEntries = Object.entries(keyInfos);
        if (keyInfoEntries.length > 1) {
            throw new Error("Multiple storage key requests not implemented");
        }
        [keyId, keyInfo] = keyInfoEntries[0];
    }

    // Check the in-memory cache
    if (isCachingAllowed() && secretStorageKeys[keyId]) {
        return [keyId, secretStorageKeys[keyId]];
    }

    if (dehydrationCache.key) {
        if (await MatrixClientPeg.safeGet().checkSecretStorageKey(dehydrationCache.key, keyInfo)) {
            cacheSecretStorageKey(keyId, keyInfo, dehydrationCache.key);
            return [keyId, dehydrationCache.key];
        }
    }

    const keyFromCustomisations = ModuleRunner.instance.extensions.cryptoSetup.getSecretStorageKey();
    if (keyFromCustomisations) {
        logger.log("CryptoSetupExtension: Using key from extension (secret storage)");
        cacheSecretStorageKey(keyId, keyInfo, keyFromCustomisations);
        return [keyId, keyFromCustomisations];
    }

    if (nonInteractive) {
        throw new Error("Could not unlock non-interactively");
    }

    const inputToKey = makeInputToKey(keyInfo);
    const { finished } = Modal.createDialog(
        AccessSecretStorageDialog,
        /* props= */
        {
            keyInfo,
            checkPrivateKey: async (input: KeyParams): Promise<boolean> => {
                const key = await inputToKey(input);
                return MatrixClientPeg.safeGet().checkSecretStorageKey(key, keyInfo);
            },
        },
        /* className= */ undefined,
        /* isPriorityModal= */ false,
        /* isStaticModal= */ false,
        /* options= */ {
            onBeforeClose: async (reason): Promise<boolean> => {
                if (reason === "backgroundClick") {
                    return confirmToDismiss();
                }
                return true;
            },
        },
    );
    const [keyParams] = await finished;
    if (!keyParams) {
        throw new AccessCancelledError();
    }
    const key = await inputToKey(keyParams);

    // Save to cache to avoid future prompts in the current session
    cacheSecretStorageKey(keyId, keyInfo, key);

    return [keyId, key];
}

export async function getDehydrationKey(
    keyInfo: SecretStorage.SecretStorageKeyDescription,
    checkFunc: (data: Uint8Array) => void,
): Promise<Uint8Array> {
    const keyFromCustomisations = ModuleRunner.instance.extensions.cryptoSetup.getSecretStorageKey();
    if (keyFromCustomisations) {
        logger.log("CryptoSetupExtension: Using key from extension (dehydration)");
        return keyFromCustomisations;
    }

    const inputToKey = makeInputToKey(keyInfo);
    const { finished } = Modal.createDialog(
        AccessSecretStorageDialog,
        /* props= */
        {
            keyInfo,
            checkPrivateKey: async (input: KeyParams): Promise<boolean> => {
                const key = await inputToKey(input);
                try {
                    checkFunc(key);
                    return true;
                } catch (e) {
                    return false;
                }
            },
        },
        /* className= */ undefined,
        /* isPriorityModal= */ false,
        /* isStaticModal= */ false,
        /* options= */ {
            onBeforeClose: async (reason): Promise<boolean> => {
                if (reason === "backgroundClick") {
                    return confirmToDismiss();
                }
                return true;
            },
        },
    );
    const [input] = await finished;
    if (!input) {
        throw new AccessCancelledError();
    }
    const key = await inputToKey(input);

    // need to copy the key because rehydration (unpickling) will clobber it
    dehydrationCache = { key: new Uint8Array(key), keyInfo };

    return key;
}

function cacheSecretStorageKey(
    keyId: string,
    keyInfo: SecretStorage.SecretStorageKeyDescription,
    key: Uint8Array,
): void {
    if (isCachingAllowed()) {
        secretStorageKeys[keyId] = key;
        secretStorageKeyInfo[keyId] = keyInfo;
    }
}

async function onSecretRequested(
    userId: string,
    deviceId: string,
    requestId: string,
    name: string,
    deviceTrust: DeviceVerificationStatus,
): Promise<string | undefined> {
    logger.log("onSecretRequested", userId, deviceId, requestId, name, deviceTrust);
    const client = MatrixClientPeg.safeGet();
    if (userId !== client.getUserId()) {
        return;
    }
    if (!deviceTrust?.isVerified()) {
        logger.log(`Ignoring secret request from untrusted device ${deviceId}`);
        return;
    }
    if (
        name === "m.cross_signing.master" ||
        name === "m.cross_signing.self_signing" ||
        name === "m.cross_signing.user_signing"
    ) {
        const callbacks = client.getCrossSigningCacheCallbacks();
        if (!callbacks?.getCrossSigningKeyCache) return;
        const keyId = name.replace("m.cross_signing.", "");
        const key = await callbacks.getCrossSigningKeyCache(keyId);
        if (!key) {
            logger.log(`${keyId} requested by ${deviceId}, but not found in cache`);
        }
        return key ? encodeBase64(key) : undefined;
    } else if (name === "m.megolm_backup.v1") {
        const key = await client.crypto?.getSessionBackupPrivateKey();
        if (!key) {
            logger.log(`session backup key requested by ${deviceId}, but not found in cache`);
        }
        return key ? encodeBase64(key) : undefined;
    }
    logger.warn("onSecretRequested didn't recognise the secret named ", name);
}

export const crossSigningCallbacks: ICryptoCallbacks = {
    getSecretStorageKey,
    cacheSecretStorageKey,
    onSecretRequested,
    getDehydrationKey,
};

export async function promptForBackupPassphrase(): Promise<Uint8Array> {
    let key!: Uint8Array;

    const { finished } = Modal.createDialog(
        RestoreKeyBackupDialog,
        {
            showSummary: false,
            keyCallback: (k: Uint8Array) => (key = k),
        },
        undefined,
        /* priority = */ false,
        /* static = */ true,
    );

    const success = await finished;
    if (!success) throw new Error("Key backup prompt cancelled");

    return key;
}

/**
 * Carry out an operation that may require multiple accesses to secret storage, caching the key.
 *
 * Use this helper to wrap an operation that may require multiple accesses to secret storage; the user will be prompted
 * to enter the 4S key or passphrase on the first access, and the key will be cached for the rest of the operation.
 *
 * @param func - The operation to be wrapped.
 */
export async function withSecretStorageKeyCache<T>(func: () => Promise<T>): Promise<T> {
    secretStorageBeingAccessed = true;
    try {
        return await func();
    } finally {
        // Clear secret storage key cache now that work is complete
        secretStorageBeingAccessed = false;
        if (!isCachingAllowed()) {
            secretStorageKeys = {};
            secretStorageKeyInfo = {};
        }
    }
}

/**
 * This helper should be used whenever you need to access secret storage. It
 * ensures that secret storage (and also cross-signing since they each depend on
 * each other in a cycle of sorts) have been bootstrapped before running the
 * provided function.
 *
 * Bootstrapping secret storage may take one of these paths:
 * 1. Create secret storage from a passphrase and store cross-signing keys
 *    in secret storage.
 * 2. Access existing secret storage by requesting passphrase and accessing
 *    cross-signing keys as needed.
 * 3. All keys are loaded and there's nothing to do.
 *
 * Additionally, the secret storage keys are cached during the scope of this function
 * to ensure the user is prompted only once for their secret storage
 * passphrase. The cache is then cleared once the provided function completes.
 *
 * @param {Function} [func] An operation to perform once secret storage has been
 * bootstrapped. Optional.
 * @param {bool} [forceReset] Reset secret storage even if it's already set up
 */
export async function accessSecretStorage(func = async (): Promise<void> => {}, forceReset = false): Promise<void> {
    await withSecretStorageKeyCache(() => doAccessSecretStorage(func, forceReset));
}

/** Helper for {@link #accessSecretStorage} */
async function doAccessSecretStorage(func: () => Promise<void>, forceReset: boolean): Promise<void> {
    try {
        const cli = MatrixClientPeg.safeGet();
        if (!(await cli.hasSecretStorageKey()) || forceReset) {
            // This dialog calls bootstrap itself after guiding the user through
            // passphrase creation.
            const { finished } = Modal.createDialogAsync(
                import("./async-components/views/dialogs/security/CreateSecretStorageDialog") as unknown as Promise<
                    typeof CreateSecretStorageDialog
                >,
                {
                    forceReset,
                },
                undefined,
                /* priority = */ false,
                /* static = */ true,
                /* options = */ {
                    onBeforeClose: async (reason): Promise<boolean> => {
                        // If Secure Backup is required, you cannot leave the modal.
                        if (reason === "backgroundClick") {
                            return !isSecureBackupRequired(cli);
                        }
                        return true;
                    },
                },
            );
            const [confirmed] = await finished;
            if (!confirmed) {
                throw new Error("Secret storage creation canceled");
            }
        } else {
            const crypto = cli.getCrypto();
            if (!crypto) {
                throw new Error("End-to-end encryption is disabled - unable to access secret storage.");
            }

            await crypto.bootstrapCrossSigning({
                authUploadDeviceSigningKeys: async (makeRequest): Promise<void> => {
                    const { finished } = Modal.createDialog(InteractiveAuthDialog, {
                        title: _t("encryption|bootstrap_title"),
                        matrixClient: cli,
                        makeRequest,
                    });
                    const [confirmed] = await finished;
                    if (!confirmed) {
                        throw new Error("Cross-signing key upload auth canceled");
                    }
                },
            });
            await crypto.bootstrapSecretStorage({
                getKeyBackupPassphrase: promptForBackupPassphrase,
            });

            const keyId = Object.keys(secretStorageKeys)[0];
            if (keyId && SettingsStore.getValue("feature_dehydration")) {
                let dehydrationKeyInfo = {};
                if (secretStorageKeyInfo[keyId] && secretStorageKeyInfo[keyId].passphrase) {
                    dehydrationKeyInfo = { passphrase: secretStorageKeyInfo[keyId].passphrase };
                }
                logger.log("Setting dehydration key");
                await cli.setDehydrationKey(secretStorageKeys[keyId], dehydrationKeyInfo, "Backup device");
            } else if (!keyId) {
                logger.warn("Not setting dehydration key: no SSSS key found");
            } else {
                logger.log("Not setting dehydration key: feature disabled");
            }
        }

        // `return await` needed here to ensure `finally` block runs after the
        // inner operation completes.
        return await func();
    } catch (e) {
        ModuleRunner.instance.extensions.cryptoSetup.catchAccessSecretStorageError(e as Error);
        logger.error(e);
        // Re-throw so that higher level logic can abort as needed
        throw e;
    }
}

// FIXME: this function name is a bit of a mouthful
export async function tryToUnlockSecretStorageWithDehydrationKey(client: MatrixClient): Promise<void> {
    const key = dehydrationCache.key;
    let restoringBackup = false;
    if (key && (await client.isSecretStorageReady())) {
        logger.log("Trying to set up cross-signing using dehydration key");
        secretStorageBeingAccessed = true;
        nonInteractive = true;
        try {
            await client.checkOwnCrossSigningTrust();

            // we also need to set a new dehydrated device to replace the
            // device we rehydrated
            let dehydrationKeyInfo = {};
            if (dehydrationCache.keyInfo && dehydrationCache.keyInfo.passphrase) {
                dehydrationKeyInfo = { passphrase: dehydrationCache.keyInfo.passphrase };
            }
            await client.setDehydrationKey(key, dehydrationKeyInfo, "Backup device");

            // and restore from backup
            const backupInfo = await client.getKeyBackupVersion();
            if (backupInfo) {
                restoringBackup = true;
                // don't await, because this can take a long time
                client.restoreKeyBackupWithSecretStorage(backupInfo).finally(() => {
                    secretStorageBeingAccessed = false;
                    nonInteractive = false;
                    if (!isCachingAllowed()) {
                        secretStorageKeys = {};
                        secretStorageKeyInfo = {};
                    }
                });
            }
        } finally {
            dehydrationCache = {};
            // the secret storage cache is needed for restoring from backup, so
            // don't clear it yet if we're restoring from backup
            if (!restoringBackup) {
                secretStorageBeingAccessed = false;
                nonInteractive = false;
                if (!isCachingAllowed()) {
                    secretStorageKeys = {};
                    secretStorageKeyInfo = {};
                }
            }
        }
    }
}

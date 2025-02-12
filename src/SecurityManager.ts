/*
Copyright 2024 New Vector Ltd.
Copyright 2019, 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { lazy } from "react";
import { type SecretStorage } from "matrix-js-sdk/src/matrix";
import { deriveRecoveryKeyFromPassphrase, decodeRecoveryKey, type CryptoCallbacks } from "matrix-js-sdk/src/crypto-api";
import { logger as rootLogger } from "matrix-js-sdk/src/logger";

import Modal from "./Modal";
import { MatrixClientPeg } from "./MatrixClientPeg";
import { _t } from "./languageHandler";
import { isSecureBackupRequired } from "./utils/WellKnownUtils";
import AccessSecretStorageDialog, {
    type KeyParams,
} from "./components/views/dialogs/security/AccessSecretStorageDialog";
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

const logger = rootLogger.getChild("SecurityManager:");

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
            return deriveRecoveryKeyFromPassphrase(passphrase, keyInfo.passphrase.salt, keyInfo.passphrase.iterations);
        } else if (recoveryKey) {
            return decodeRecoveryKey(recoveryKey);
        }
        throw new Error("Invalid input, passphrase or recoveryKey need to be provided");
    };
}

async function getSecretStorageKey(
    {
        keys: keyInfos,
    }: {
        keys: Record<string, SecretStorage.SecretStorageKeyDescription>;
    },
    secretName: string,
): Promise<[string, Uint8Array]> {
    const cli = MatrixClientPeg.safeGet();
    const defaultKeyId = await cli.secretStorage.getDefaultKeyId();

    let keyId: string;
    // If the defaultKey is useful, use that
    if (defaultKeyId && keyInfos[defaultKeyId]) {
        keyId = defaultKeyId;
    } else {
        // Fall back to a heuristic of using the
        // only available key, if only one key is set
        const usefulKeys = Object.keys(keyInfos);
        if (usefulKeys.length > 1) {
            throw new Error("Multiple storage key requests not implemented");
        }
        keyId = usefulKeys[0];
    }
    const keyInfo = keyInfos[keyId];
    logger.debug(
        `getSecretStorageKey: request for 4S keys [${Object.keys(keyInfos)}] for secret \`${secretName}\`: looking for key ${keyId}`,
    );

    // Check the in-memory cache
    if (secretStorageBeingAccessed && secretStorageKeys[keyId]) {
        logger.debug(`getSecretStorageKey: returning key ${keyId} from cache`);
        return [keyId, secretStorageKeys[keyId]];
    }

    const keyFromCustomisations = ModuleRunner.instance.extensions.cryptoSetup.getSecretStorageKey();
    if (keyFromCustomisations) {
        logger.debug("getSecretStorageKey: Using secret storage key from CryptoSetupExtension");
        cacheSecretStorageKey(keyId, keyInfo, keyFromCustomisations);
        return [keyId, keyFromCustomisations];
    }

    // We only prompt the user for the default key
    if (keyId !== defaultKeyId) {
        logger.debug(`getSecretStorageKey: request for non-default key ${keyId}: not prompting user`);
        throw new Error("Request for non-default 4S key");
    }

    logger.debug(`getSecretStorageKey: prompting user for key ${keyId}`);
    const inputToKey = makeInputToKey(keyInfo);
    const { finished } = Modal.createDialog(
        AccessSecretStorageDialog,
        /* props= */
        {
            keyInfo,
            checkPrivateKey: async (input: KeyParams): Promise<boolean> => {
                const key = await inputToKey(input);
                return MatrixClientPeg.safeGet().secretStorage.checkKey(key, keyInfo);
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
    logger.debug(`getSecretStorageKey: got key ${keyId} from user`);
    const key = await inputToKey(keyParams);

    // Save to cache to avoid future prompts in the current session
    cacheSecretStorageKey(keyId, keyInfo, key);

    return [keyId, key];
}

function cacheSecretStorageKey(
    keyId: string,
    keyInfo: SecretStorage.SecretStorageKeyDescription,
    key: Uint8Array,
): void {
    if (secretStorageBeingAccessed) {
        logger.debug(`Caching 4S key ${keyId}`);
        secretStorageKeys[keyId] = key;
        secretStorageKeyInfo[keyId] = keyInfo;
    }
}

export const crossSigningCallbacks: CryptoCallbacks = {
    getSecretStorageKey,
    cacheSecretStorageKey,
};

/**
 * Carry out an operation that may require multiple accesses to secret storage, caching the key.
 *
 * Use this helper to wrap an operation that may require multiple accesses to secret storage; the user will be prompted
 * to enter the 4S key or passphrase on the first access, and the key will be cached for the rest of the operation.
 *
 * @param func - The operation to be wrapped.
 */
export async function withSecretStorageKeyCache<T>(func: () => Promise<T>): Promise<T> {
    logger.debug("enabling 4S key cache");
    secretStorageBeingAccessed = true;
    try {
        return await func();
    } finally {
        // Clear secret storage key cache now that work is complete
        logger.debug("disabling 4S key cache");
        secretStorageBeingAccessed = false;
        secretStorageKeys = {};
        secretStorageKeyInfo = {};
    }
}

export interface AccessSecretStorageOpts {
    /** Reset secret storage even if it's already set up. */
    forceReset?: boolean;
    /** Create new cross-signing keys. Only applicable if `forceReset` is `true`. */
    resetCrossSigning?: boolean;
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
 * @param [opts] The options to use when accessing secret storage.
 */
export async function accessSecretStorage(
    func = async (): Promise<void> => {},
    opts: AccessSecretStorageOpts = {},
): Promise<void> {
    await withSecretStorageKeyCache(() => doAccessSecretStorage(func, opts));
}

/** Helper for {@link #accessSecretStorage} */
async function doAccessSecretStorage(func: () => Promise<void>, opts: AccessSecretStorageOpts): Promise<void> {
    try {
        const cli = MatrixClientPeg.safeGet();
        const crypto = cli.getCrypto();
        if (!crypto) {
            throw new Error("End-to-end encryption is disabled - unable to access secret storage.");
        }

        let createNew = false;
        if (opts.forceReset) {
            logger.debug("accessSecretStorage: resetting 4S");
            createNew = true;
        } else if (!(await cli.secretStorage.hasKey())) {
            logger.debug("accessSecretStorage: no 4S key configured, creating a new one");
            createNew = true;
        }

        if (createNew) {
            // This dialog calls bootstrap itself after guiding the user through
            // passphrase creation.
            const { finished } = Modal.createDialog(
                lazy(() => import("./async-components/views/dialogs/security/CreateSecretStorageDialog")),
                opts,
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
            logger.debug("accessSecretStorage: bootstrapCrossSigning");
            await crypto.bootstrapCrossSigning({
                authUploadDeviceSigningKeys: async (makeRequest): Promise<void> => {
                    logger.debug("accessSecretStorage: performing UIA to upload cross-signing keys");
                    const { finished } = Modal.createDialog(InteractiveAuthDialog, {
                        title: _t("encryption|bootstrap_title"),
                        matrixClient: cli,
                        makeRequest,
                    });
                    const [confirmed] = await finished;
                    if (!confirmed) {
                        throw new Error("Cross-signing key upload auth canceled");
                    }
                    logger.debug("accessSecretStorage: Cross-signing key upload successful");
                },
            });
            logger.debug("accessSecretStorage: bootstrapSecretStorage");
            await crypto.bootstrapSecretStorage({});
        }

        logger.debug("accessSecretStorage: 4S now ready");
        // `return await` needed here to ensure `finally` block runs after the
        // inner operation completes.
        await func();
        logger.debug("accessSecretStorage: operation complete");
    } catch (e) {
        ModuleRunner.instance.extensions.cryptoSetup.catchAccessSecretStorageError(e as Error);
        logger.error("accessSecretStorage: error during operation", e);
        // Re-throw so that higher level logic can abort as needed
        throw e;
    }
}

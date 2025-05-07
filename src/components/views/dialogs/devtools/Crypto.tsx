/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX } from "react";
import { InlineSpinner } from "@vector-im/compound-web";

import { useMatrixClientContext } from "../../../../contexts/MatrixClientContext";
import BaseTool from "./BaseTool";
import { useAsyncMemo } from "../../../../hooks/useAsyncMemo";
import { _t } from "../../../../languageHandler";

interface KeyBackupProps {
    /**
     * Callback to invoke when the back button is clicked.
     */
    onBack(): void;
}

/**
 * A component that displays information about the key storage and cross-signing.
 */
export function Crypto({ onBack }: KeyBackupProps): JSX.Element {
    const matrixClient = useMatrixClientContext();
    return (
        <BaseTool onBack={onBack} className="mx_Crypto">
            {matrixClient.getCrypto() ? (
                <>
                    <KeyStorage />
                    <CrossSigning />
                </>
            ) : (
                <span>{_t("devtools|crypto|crypto_not_available")}</span>
            )}
        </BaseTool>
    );
}

/**
 * A component that displays information about the key storage.
 */
function KeyStorage(): JSX.Element {
    const matrixClient = useMatrixClientContext();
    const keyStorageData = useAsyncMemo(async () => {
        const crypto = matrixClient.getCrypto()!;

        // Get all the key storage data that we will display
        const backupInfo = await crypto.getKeyBackupInfo();
        const backupKeyStored = Boolean(await matrixClient.isKeyBackupKeyStored());
        const backupKeyFromCache = await crypto.getSessionBackupPrivateKey();
        const backupKeyCached = Boolean(backupKeyFromCache);
        const backupKeyWellFormed = backupKeyFromCache instanceof Uint8Array;
        const activeBackupVersion = await crypto.getActiveSessionBackupVersion();
        const secretStorageKeyInAccount = await matrixClient.secretStorage.hasKey();
        const secretStorageReady = await crypto.isSecretStorageReady();

        return {
            backupInfo,
            backupKeyStored,
            backupKeyCached,
            backupKeyWellFormed,
            activeBackupVersion,
            secretStorageKeyInAccount,
            secretStorageReady,
        };
    }, [matrixClient]);

    // Show a spinner while loading
    if (keyStorageData === undefined) return <InlineSpinner aria-label={_t("common|loading")} />;

    const {
        backupInfo,
        backupKeyStored,
        backupKeyCached,
        backupKeyWellFormed,
        activeBackupVersion,
        secretStorageKeyInAccount,
        secretStorageReady,
    } = keyStorageData;

    return (
        <table aria-label={_t("devtools|crypto|key_storage")}>
            <thead>{_t("devtools|crypto|key_storage")}</thead>
            <tbody>
                <tr>
                    <th scope="row">{_t("devtools|crypto|key_backup_latest_version")}</th>
                    <td>
                        {backupInfo
                            ? `${backupInfo.version} (${_t("settings|security|key_backup_algorithm")} ${backupInfo.algorithm})`
                            : _t("devtools|crypto|key_backup_inactive_warning")}
                    </td>
                </tr>
                <tr>
                    <th scope="row">{_t("devtools|crypto|backup_key_stored_status")}</th>
                    <td>
                        {backupKeyStored
                            ? _t("devtools|crypto|backup_key_stored")
                            : _t("devtools|crypto|backup_key_not_stored")}
                    </td>
                </tr>
                <tr>
                    <th scope="row">{_t("devtools|crypto|key_backup_active_version")}</th>
                    <td>
                        {activeBackupVersion === null
                            ? _t("devtools|crypto|key_backup_active_version_none")
                            : activeBackupVersion}
                    </td>
                </tr>
                <tr>
                    <th scope="row">{_t("devtools|crypto|backup_key_cached_status")}</th>
                    <td>
                        {`${
                            backupKeyCached
                                ? _t("devtools|crypto|backup_key_cached")
                                : _t("devtools|crypto|not_found_locally")
                        }, ${
                            backupKeyWellFormed
                                ? _t("devtools|crypto|backup_key_well_formed")
                                : _t("devtools|crypto|backup_key_unexpected_type")
                        }`}
                    </td>
                </tr>
                <tr>
                    <th scope="row">{_t("devtools|crypto|4s_public_key_status")}</th>
                    <td>
                        {secretStorageKeyInAccount
                            ? _t("devtools|crypto|4s_public_key_in_account_data")
                            : _t("devtools|crypto|4s_public_key_not_in_account_data")}
                    </td>
                </tr>
                <tr>
                    <th scope="row">{_t("devtools|crypto|secret_storage_status")}</th>
                    <td>
                        {secretStorageReady
                            ? _t("devtools|crypto|secret_storage_ready")
                            : _t("devtools|crypto|secret_storage_not_ready")}
                    </td>
                </tr>
            </tbody>
        </table>
    );
}

/**
 * A component that displays information about cross-signing.
 */
function CrossSigning(): JSX.Element {
    const matrixClient = useMatrixClientContext();
    const crossSigningData = useAsyncMemo(async () => {
        const crypto = matrixClient.getCrypto()!;

        // Get all the cross-signing data that we will display
        const crossSigningStatus = await crypto.getCrossSigningStatus();
        const crossSigningPublicKeysOnDevice = crossSigningStatus.publicKeysOnDevice;
        const crossSigningPrivateKeysInStorage = crossSigningStatus.privateKeysInSecretStorage;
        const masterPrivateKeyCached = crossSigningStatus.privateKeysCachedLocally.masterKey;
        const selfSigningPrivateKeyCached = crossSigningStatus.privateKeysCachedLocally.selfSigningKey;
        const userSigningPrivateKeyCached = crossSigningStatus.privateKeysCachedLocally.userSigningKey;
        const crossSigningReady = await crypto.isCrossSigningReady();

        return {
            crossSigningPublicKeysOnDevice,
            crossSigningPrivateKeysInStorage,
            masterPrivateKeyCached,
            selfSigningPrivateKeyCached,
            userSigningPrivateKeyCached,
            crossSigningReady,
        };
    }, [matrixClient]);

    // Show a spinner while loading
    if (crossSigningData === undefined) return <InlineSpinner aria-label={_t("common|loading")} />;

    const {
        crossSigningPublicKeysOnDevice,
        crossSigningPrivateKeysInStorage,
        masterPrivateKeyCached,
        selfSigningPrivateKeyCached,
        userSigningPrivateKeyCached,
        crossSigningReady,
    } = crossSigningData;

    return (
        <table aria-label={_t("devtools|crypto|cross_signing")}>
            <thead>{_t("devtools|crypto|cross_signing")}</thead>
            <tbody>
                <tr>
                    <th scope="row">{_t("devtools|crypto|cross_signing_status")}</th>
                    <td>{getCrossSigningStatus(crossSigningReady, crossSigningPrivateKeysInStorage)}</td>
                </tr>
                <tr>
                    <th scope="row">{_t("devtools|crypto|cross_signing_public_keys_on_device_status")}</th>
                    <td>
                        {crossSigningPublicKeysOnDevice
                            ? _t("devtools|crypto|cross_signing_public_keys_on_device")
                            : _t("devtools|crypto|not_found")}
                    </td>
                </tr>
                <tr>
                    <th scope="row">{_t("devtools|crypto|cross_signing_private_keys_in_storage_status")}</th>
                    <td>
                        {crossSigningPrivateKeysInStorage
                            ? _t("devtools|crypto|cross_signing_private_keys_in_storage")
                            : _t("devtools|crypto|cross_signing_private_keys_not_in_storage")}
                    </td>
                </tr>
                <tr>
                    <th scope="row">{_t("devtools|crypto|master_private_key_cached_status")}</th>
                    <td>
                        {masterPrivateKeyCached
                            ? _t("devtools|crypto|cross_signing_cached")
                            : _t("devtools|crypto|not_found_locally")}
                    </td>
                </tr>
                <tr>
                    <th scope="row">{_t("devtools|crypto|self_signing_private_key_cached_status")}</th>
                    <td>
                        {selfSigningPrivateKeyCached
                            ? _t("devtools|crypto|cross_signing_cached")
                            : _t("devtools|crypto|not_found_locally")}
                    </td>
                </tr>
                <tr>
                    <th scope="row">{_t("devtools|crypto|user_signing_private_key_cached_status")}</th>
                    <td>
                        {userSigningPrivateKeyCached
                            ? _t("devtools|crypto|cross_signing_cached")
                            : _t("devtools|crypto|not_found_locally")}
                    </td>
                </tr>
            </tbody>
        </table>
    );
}

/**
 * Get the cross-signing status.
 * @param crossSigningReady Whether cross-signing is ready.
 * @param crossSigningPrivateKeysInStorage Whether cross-signing private keys are in secret storage.
 */
function getCrossSigningStatus(crossSigningReady: boolean, crossSigningPrivateKeysInStorage: boolean): string {
    if (crossSigningReady) {
        return crossSigningPrivateKeysInStorage
            ? _t("devtools|crypto|cross_signing_ready")
            : _t("devtools|crypto|cross_signing_untrusted");
    }

    if (crossSigningPrivateKeysInStorage) {
        return _t("devtools|crypto|cross_signing_not_ready");
    }

    return _t("devtools|crypto|cross_signing_not_ready");
}

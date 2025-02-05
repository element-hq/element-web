/*
Copyright 2024 New Vector Ltd.
Copyright 2019, 2020 The Matrix.org Foundation C.I.C.
Copyright 2018 New Vector Ltd

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { lazy, type ReactNode } from "react";
import { CryptoEvent, type BackupTrustInfo, type KeyBackupInfo } from "matrix-js-sdk/src/crypto-api";
import { logger } from "matrix-js-sdk/src/logger";
import { type EmptyObject } from "matrix-js-sdk/src/matrix";

import { MatrixClientPeg } from "../../../MatrixClientPeg";
import { _t } from "../../../languageHandler";
import Modal from "../../../Modal";
import { isSecureBackupRequired } from "../../../utils/WellKnownUtils";
import Spinner from "../elements/Spinner";
import AccessibleButton from "../elements/AccessibleButton";
import QuestionDialog from "../dialogs/QuestionDialog";
import RestoreKeyBackupDialog from "../dialogs/security/RestoreKeyBackupDialog";
import { accessSecretStorage } from "../../../SecurityManager";
import { SettingsSubsectionText } from "./shared/SettingsSubsection";

interface IState {
    loading: boolean;
    error: boolean;
    backupKeyStored: boolean | null;
    backupKeyCached: boolean | null;
    backupKeyWellFormed: boolean | null;
    secretStorageKeyInAccount: boolean | null;
    secretStorageReady: boolean | null;

    /** Information on the current key backup version, as returned by the server.
     *
     * `null` could mean any of:
     *    * we haven't yet requested the data from the server.
     *    * we were unable to reach the server.
     *    * the server returned key backup version data we didn't understand or was malformed.
     *    * there is actually no backup on the server.
     */
    backupInfo: KeyBackupInfo | null;

    /**
     * Information on whether the backup in `backupInfo` is correctly signed, and whether we have the right key to
     * decrypt it.
     *
     * `undefined` if `backupInfo` is null, or if crypto is not enabled in the client.
     */
    backupTrustInfo: BackupTrustInfo | undefined;

    /**
     * If key backup is currently enabled, the backup version we are backing up to.
     */
    activeBackupVersion: string | null;

    /**
     * Number of sessions remaining to be backed up. `null` if we have no information on this.
     */
    sessionsRemaining: number | null;
}

export default class SecureBackupPanel extends React.PureComponent<EmptyObject, IState> {
    private unmounted = false;

    public constructor(props: EmptyObject) {
        super(props);

        this.state = {
            loading: true,
            error: false,
            backupKeyStored: null,
            backupKeyCached: null,
            backupKeyWellFormed: null,
            secretStorageKeyInAccount: null,
            secretStorageReady: null,
            backupInfo: null,
            backupTrustInfo: undefined,
            activeBackupVersion: null,
            sessionsRemaining: null,
        };
    }

    public componentDidMount(): void {
        this.unmounted = false;
        this.loadBackupStatus();

        MatrixClientPeg.safeGet().on(CryptoEvent.KeyBackupStatus, this.onKeyBackupStatus);
        MatrixClientPeg.safeGet().on(CryptoEvent.KeyBackupSessionsRemaining, this.onKeyBackupSessionsRemaining);
    }

    public componentWillUnmount(): void {
        this.unmounted = true;

        if (MatrixClientPeg.get()) {
            MatrixClientPeg.get()!.removeListener(CryptoEvent.KeyBackupStatus, this.onKeyBackupStatus);
            MatrixClientPeg.get()!.removeListener(
                CryptoEvent.KeyBackupSessionsRemaining,
                this.onKeyBackupSessionsRemaining,
            );
        }
    }

    private onKeyBackupSessionsRemaining = (sessionsRemaining: number): void => {
        this.setState({
            sessionsRemaining,
        });
    };

    private onKeyBackupStatus = (): void => {
        // This just loads the current backup status rather than forcing
        // a re-check otherwise we risk causing infinite loops
        this.loadBackupStatus();
    };

    private async loadBackupStatus(): Promise<void> {
        this.setState({ loading: true });
        this.getUpdatedDiagnostics();
        try {
            const cli = MatrixClientPeg.safeGet();
            const backupInfo = (await cli.getCrypto()?.getKeyBackupInfo()) ?? null;
            const backupTrustInfo = backupInfo ? await cli.getCrypto()?.isKeyBackupTrusted(backupInfo) : undefined;

            const activeBackupVersion = (await cli.getCrypto()?.getActiveSessionBackupVersion()) ?? null;

            if (this.unmounted) return;
            this.setState({
                loading: false,
                error: false,
                backupInfo,
                backupTrustInfo,
                activeBackupVersion,
            });
        } catch (e) {
            logger.log("Unable to fetch key backup status", e);
            if (this.unmounted) return;
            this.setState({
                loading: false,
                error: true,
                backupInfo: null,
                backupTrustInfo: undefined,
                activeBackupVersion: null,
            });
        }
    }

    private async getUpdatedDiagnostics(): Promise<void> {
        const cli = MatrixClientPeg.safeGet();
        const crypto = cli.getCrypto();
        if (!crypto) return;

        const secretStorage = cli.secretStorage;

        const backupKeyStored = !!(await cli.isKeyBackupKeyStored());
        const backupKeyFromCache = await crypto.getSessionBackupPrivateKey();
        const backupKeyCached = !!backupKeyFromCache;
        const backupKeyWellFormed = backupKeyFromCache instanceof Uint8Array;
        const secretStorageKeyInAccount = await secretStorage.hasKey();
        const secretStorageReady = await crypto.isSecretStorageReady();

        if (this.unmounted) return;
        this.setState({
            backupKeyStored,
            backupKeyCached,
            backupKeyWellFormed,
            secretStorageKeyInAccount,
            secretStorageReady,
        });
    }

    private startNewBackup = (): void => {
        Modal.createDialog(
            lazy(() => import("../../../async-components/views/dialogs/security/CreateKeyBackupDialog")),
            {
                onFinished: () => {
                    this.loadBackupStatus();
                },
            },
            undefined,
            /* priority = */ false,
            /* static = */ true,
        );
    };

    private deleteBackup = (): void => {
        Modal.createDialog(QuestionDialog, {
            title: _t("settings|security|delete_backup"),
            description: _t("settings|security|delete_backup_confirm_description"),
            button: _t("settings|security|delete_backup"),
            danger: true,
            onFinished: (proceed) => {
                if (!proceed) return;
                this.setState({ loading: true });
                const versionToDelete = this.state.backupInfo!.version!;
                // deleteKeyBackupVersion fires a key backup status event
                // which will update the UI
                MatrixClientPeg.safeGet().getCrypto()?.deleteKeyBackupVersion(versionToDelete);
            },
        });
    };

    private restoreBackup = async (): Promise<void> => {
        Modal.createDialog(RestoreKeyBackupDialog, undefined, undefined, /* priority = */ false, /* static = */ true);
    };

    private resetSecretStorage = async (): Promise<void> => {
        this.setState({ error: false });
        try {
            await accessSecretStorage(async (): Promise<void> => {}, { forceReset: true });
        } catch (e) {
            logger.error("Error resetting secret storage", e);
            if (this.unmounted) return;
            this.setState({ error: true });
        }
        if (this.unmounted) return;
        this.loadBackupStatus();
    };

    public render(): React.ReactNode {
        const {
            loading,
            error,
            backupKeyStored,
            backupKeyCached,
            backupKeyWellFormed,
            secretStorageKeyInAccount,
            secretStorageReady,
            backupInfo,
            backupTrustInfo,
            sessionsRemaining,
        } = this.state;

        let statusDescription: JSX.Element;
        let extraDetailsTableRows: JSX.Element | undefined;
        let extraDetails: JSX.Element | undefined;
        const actions: JSX.Element[] = [];
        if (error) {
            statusDescription = (
                <SettingsSubsectionText className="error">
                    {_t("settings|security|error_loading_key_backup_status")}
                </SettingsSubsectionText>
            );
        } else if (loading) {
            statusDescription = <Spinner />;
        } else if (backupInfo) {
            let restoreButtonCaption = _t("settings|security|restore_key_backup");

            if (this.state.activeBackupVersion !== null) {
                statusDescription = (
                    <SettingsSubsectionText>✅ {_t("settings|security|key_backup_active")}</SettingsSubsectionText>
                );
            } else {
                statusDescription = (
                    <>
                        <SettingsSubsectionText>
                            {_t("settings|security|key_backup_inactive", {}, { b: (sub) => <strong>{sub}</strong> })}
                        </SettingsSubsectionText>
                        <SettingsSubsectionText>
                            {_t("settings|security|key_backup_connect_prompt")}
                        </SettingsSubsectionText>
                    </>
                );
                restoreButtonCaption = _t("settings|security|key_backup_connect");
            }

            let uploadStatus: ReactNode;
            if (sessionsRemaining === null) {
                // No upload status to show when backup disabled.
                uploadStatus = "";
            } else if (sessionsRemaining > 0) {
                uploadStatus = (
                    <div>
                        {_t("settings|security|key_backup_in_progress", { sessionsRemaining })} <br />
                    </div>
                );
            } else {
                uploadStatus = (
                    <div>
                        {_t("settings|security|key_backup_complete")} <br />
                    </div>
                );
            }

            let trustedLocally: string | undefined;
            if (backupTrustInfo?.matchesDecryptionKey) {
                trustedLocally = _t("settings|security|key_backup_can_be_restored");
            }

            extraDetailsTableRows = (
                <>
                    <tr>
                        <th scope="row">{_t("settings|security|key_backup_latest_version")}</th>
                        <td>
                            {backupInfo.version} ({_t("settings|security|key_backup_algorithm")}{" "}
                            <code>{backupInfo.algorithm}</code>)
                        </td>
                    </tr>
                    <tr>
                        <th scope="row">{_t("settings|security|key_backup_active_version")}</th>
                        <td>
                            {this.state.activeBackupVersion === null
                                ? _t("settings|security|key_backup_active_version_none")
                                : this.state.activeBackupVersion}
                        </td>
                    </tr>
                </>
            );

            extraDetails = (
                <>
                    {uploadStatus}
                    <div>{trustedLocally}</div>
                </>
            );

            actions.push(
                <AccessibleButton key="restore" kind="primary_outline" onClick={this.restoreBackup}>
                    {restoreButtonCaption}
                </AccessibleButton>,
            );

            if (!isSecureBackupRequired(MatrixClientPeg.safeGet())) {
                actions.push(
                    <AccessibleButton key="delete" kind="danger_outline" onClick={this.deleteBackup}>
                        {_t("settings|security|delete_backup")}
                    </AccessibleButton>,
                );
            }
        } else {
            statusDescription = (
                <>
                    <SettingsSubsectionText>
                        {_t(
                            "settings|security|key_backup_inactive_warning",
                            {},
                            { b: (sub) => <strong>{sub}</strong> },
                        )}
                    </SettingsSubsectionText>
                    <SettingsSubsectionText>{_t("encryption|setup_secure_backup|explainer")}</SettingsSubsectionText>
                </>
            );
            actions.push(
                <AccessibleButton key="setup" kind="primary_outline" onClick={this.startNewBackup}>
                    {_t("encryption|setup_secure_backup|title")}
                </AccessibleButton>,
            );
        }

        if (secretStorageKeyInAccount) {
            actions.push(
                <AccessibleButton key="reset" kind="danger_outline" onClick={this.resetSecretStorage}>
                    {_t("action|reset")}
                </AccessibleButton>,
            );
        }

        let backupKeyWellFormedText = "";
        if (backupKeyCached) {
            backupKeyWellFormedText = ", ";
            if (backupKeyWellFormed) {
                backupKeyWellFormedText += _t("settings|security|backup_key_well_formed");
            } else {
                backupKeyWellFormedText += _t("settings|security|backup_key_unexpected_type");
            }
        }

        let actionRow: JSX.Element | undefined;
        if (actions.length) {
            actionRow = <div className="mx_SecureBackupPanel_buttonRow">{actions}</div>;
        }

        return (
            <>
                <SettingsSubsectionText>{_t("settings|security|backup_keys_description")}</SettingsSubsectionText>
                {statusDescription}
                <details>
                    <summary className="mx_SecureBackupPanel_advanced">{_t("common|advanced")}</summary>
                    <table className="mx_SecureBackupPanel_statusList">
                        <tr>
                            <th scope="row">{_t("settings|security|backup_key_stored_status")}</th>
                            <td>
                                {backupKeyStored === true
                                    ? _t("settings|security|cross_signing_in_4s")
                                    : _t("settings|security|cross_signing_not_stored")}
                            </td>
                        </tr>
                        <tr>
                            <th scope="row">{_t("settings|security|backup_key_cached_status")}</th>
                            <td>
                                {backupKeyCached
                                    ? _t("settings|security|cross_signing_cached")
                                    : _t("settings|security|cross_signing_not_cached")}
                                {backupKeyWellFormedText}
                            </td>
                        </tr>
                        <tr>
                            <th scope="row">{_t("settings|security|4s_public_key_status")}</th>
                            <td>
                                {secretStorageKeyInAccount
                                    ? _t("settings|security|4s_public_key_in_account_data")
                                    : _t("settings|security|cross_signing_not_found")}
                            </td>
                        </tr>
                        <tr>
                            <th scope="row">{_t("settings|security|secret_storage_status")}</th>
                            <td>
                                {secretStorageReady
                                    ? _t("settings|security|secret_storage_ready")
                                    : _t("settings|security|secret_storage_not_ready")}
                            </td>
                        </tr>
                        {extraDetailsTableRows}
                    </table>
                    {extraDetails}
                </details>
                {actionRow}
            </>
        );
    }
}

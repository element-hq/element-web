/*
Copyright 2018 New Vector Ltd
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

import React, { ReactNode } from "react";
import { IKeyBackupInfo } from "matrix-js-sdk/src/crypto/keybackup";
import { TrustInfo } from "matrix-js-sdk/src/crypto/backup";
import { CryptoEvent } from "matrix-js-sdk/src/crypto";
import { logger } from "matrix-js-sdk/src/logger";

import type CreateKeyBackupDialog from "../../../async-components/views/dialogs/security/CreateKeyBackupDialog";
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
    error: Error | null;
    backupKeyStored: boolean | null;
    backupKeyCached: boolean | null;
    backupKeyWellFormed: boolean | null;
    secretStorageKeyInAccount: boolean | null;
    secretStorageReady: boolean | null;
    backupInfo: IKeyBackupInfo | null;
    backupSigStatus: TrustInfo | null;
    sessionsRemaining: number;
}

export default class SecureBackupPanel extends React.PureComponent<{}, IState> {
    private unmounted = false;

    public constructor(props: {}) {
        super(props);

        this.state = {
            loading: true,
            error: null,
            backupKeyStored: null,
            backupKeyCached: null,
            backupKeyWellFormed: null,
            secretStorageKeyInAccount: null,
            secretStorageReady: null,
            backupInfo: null,
            backupSigStatus: null,
            sessionsRemaining: 0,
        };
    }

    public componentDidMount(): void {
        this.checkKeyBackupStatus();

        MatrixClientPeg.get().on(CryptoEvent.KeyBackupStatus, this.onKeyBackupStatus);
        MatrixClientPeg.get().on(CryptoEvent.KeyBackupSessionsRemaining, this.onKeyBackupSessionsRemaining);
    }

    public componentWillUnmount(): void {
        this.unmounted = true;

        if (MatrixClientPeg.get()) {
            MatrixClientPeg.get().removeListener(CryptoEvent.KeyBackupStatus, this.onKeyBackupStatus);
            MatrixClientPeg.get().removeListener(
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

    private async checkKeyBackupStatus(): Promise<void> {
        this.getUpdatedDiagnostics();
        try {
            const keyBackupResult = await MatrixClientPeg.get().checkKeyBackup();
            this.setState({
                loading: false,
                error: null,
                backupInfo: keyBackupResult?.backupInfo ?? null,
                backupSigStatus: keyBackupResult?.trustInfo ?? null,
            });
        } catch (e) {
            logger.log("Unable to fetch check backup status", e);
            if (this.unmounted) return;
            this.setState({
                loading: false,
                error: e,
                backupInfo: null,
                backupSigStatus: null,
            });
        }
    }

    private async loadBackupStatus(): Promise<void> {
        this.setState({ loading: true });
        this.getUpdatedDiagnostics();
        try {
            const backupInfo = await MatrixClientPeg.get().getKeyBackupVersion();
            const backupSigStatus = backupInfo ? await MatrixClientPeg.get().isKeyBackupTrusted(backupInfo) : null;
            if (this.unmounted) return;
            this.setState({
                loading: false,
                error: null,
                backupInfo,
                backupSigStatus,
            });
        } catch (e) {
            logger.log("Unable to fetch key backup status", e);
            if (this.unmounted) return;
            this.setState({
                loading: false,
                error: e,
                backupInfo: null,
                backupSigStatus: null,
            });
        }
    }

    private async getUpdatedDiagnostics(): Promise<void> {
        const cli = MatrixClientPeg.get();
        const crypto = cli.crypto;
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
        Modal.createDialogAsync(
            import("../../../async-components/views/dialogs/security/CreateKeyBackupDialog") as unknown as Promise<
                typeof CreateKeyBackupDialog
            >,
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
            title: _t("Delete Backup"),
            description: _t(
                "Are you sure? You will lose your encrypted messages if your keys are not backed up properly.",
            ),
            button: _t("Delete Backup"),
            danger: true,
            onFinished: (proceed) => {
                if (!proceed) return;
                this.setState({ loading: true });
                MatrixClientPeg.get()
                    .deleteKeyBackupVersion(this.state.backupInfo!.version!)
                    .then(() => {
                        this.loadBackupStatus();
                    });
            },
        });
    };

    private restoreBackup = async (): Promise<void> => {
        Modal.createDialog(RestoreKeyBackupDialog, undefined, undefined, /* priority = */ false, /* static = */ true);
    };

    private resetSecretStorage = async (): Promise<void> => {
        this.setState({ error: null });
        try {
            await accessSecretStorage(async (): Promise<void> => {}, /* forceReset = */ true);
        } catch (e) {
            logger.error("Error resetting secret storage", e);
            if (this.unmounted) return;
            this.setState({ error: e });
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
            backupSigStatus,
            sessionsRemaining,
        } = this.state;

        let statusDescription: JSX.Element;
        let extraDetailsTableRows: JSX.Element | undefined;
        let extraDetails: JSX.Element | undefined;
        const actions: JSX.Element[] = [];
        if (error) {
            statusDescription = <div className="error">{_t("Unable to load key backup status")}</div>;
        } else if (loading) {
            statusDescription = <Spinner />;
        } else if (backupInfo) {
            let restoreButtonCaption = _t("Restore from Backup");

            if (MatrixClientPeg.get().getKeyBackupEnabled()) {
                statusDescription = <p>✅ {_t("This session is backing up your keys.")}</p>;
            } else {
                statusDescription = (
                    <>
                        <SettingsSubsectionText>
                            {_t(
                                "This session is <b>not backing up your keys</b>, " +
                                    "but you do have an existing backup you can restore from " +
                                    "and add to going forward.",
                                {},
                                { b: (sub) => <b>{sub}</b> },
                            )}
                        </SettingsSubsectionText>
                        <SettingsSubsectionText>
                            {_t(
                                "Connect this session to key backup before signing out to avoid " +
                                    "losing any keys that may only be on this session.",
                            )}
                        </SettingsSubsectionText>
                    </>
                );
                restoreButtonCaption = _t("Connect this session to Key Backup");
            }

            let uploadStatus: ReactNode;
            if (!MatrixClientPeg.get().getKeyBackupEnabled()) {
                // No upload status to show when backup disabled.
                uploadStatus = "";
            } else if (sessionsRemaining > 0) {
                uploadStatus = (
                    <div>
                        {_t("Backing up %(sessionsRemaining)s keys…", { sessionsRemaining })} <br />
                    </div>
                );
            } else {
                uploadStatus = (
                    <div>
                        {_t("All keys backed up")} <br />
                    </div>
                );
            }

            let backupSigStatuses: React.ReactNode | undefined = backupSigStatus?.sigs?.map((sig, i) => {
                const deviceName = sig.device ? sig.device.getDisplayName() || sig.device.deviceId : null;
                const validity = (sub: string): JSX.Element => (
                    <span className={sig.valid ? "mx_SecureBackupPanel_sigValid" : "mx_SecureBackupPanel_sigInvalid"}>
                        {sub}
                    </span>
                );
                const verify = (sub: string): JSX.Element => (
                    <span
                        className={
                            sig.device && sig.deviceTrust?.isVerified()
                                ? "mx_SecureBackupPanel_deviceVerified"
                                : "mx_SecureBackupPanel_deviceNotVerified"
                        }
                    >
                        {sub}
                    </span>
                );
                const device = (sub: string): JSX.Element => (
                    <span className="mx_SecureBackupPanel_deviceName">{deviceName}</span>
                );
                const fromThisDevice =
                    sig.device && sig.device.getFingerprint() === MatrixClientPeg.get().getDeviceEd25519Key();
                const fromThisUser = sig.crossSigningId && sig.deviceId === MatrixClientPeg.get().getCrossSigningId();
                let sigStatus;
                if (sig.valid && fromThisUser) {
                    sigStatus = _t(
                        "Backup has a <validity>valid</validity> signature from this user",
                        {},
                        { validity },
                    );
                } else if (!sig.valid && fromThisUser) {
                    sigStatus = _t(
                        "Backup has a <validity>invalid</validity> signature from this user",
                        {},
                        { validity },
                    );
                } else if (sig.crossSigningId) {
                    sigStatus = _t(
                        "Backup has a signature from <verify>unknown</verify> user with ID %(deviceId)s",
                        { deviceId: sig.deviceId },
                        { verify },
                    );
                } else if (!sig.device) {
                    sigStatus = _t(
                        "Backup has a signature from <verify>unknown</verify> session with ID %(deviceId)s",
                        { deviceId: sig.deviceId },
                        { verify },
                    );
                } else if (sig.valid && fromThisDevice) {
                    sigStatus = _t(
                        "Backup has a <validity>valid</validity> signature from this session",
                        {},
                        { validity },
                    );
                } else if (!sig.valid && fromThisDevice) {
                    // it can happen...
                    sigStatus = _t(
                        "Backup has an <validity>invalid</validity> signature from this session",
                        {},
                        { validity },
                    );
                } else if (sig.valid && sig.deviceTrust?.isVerified()) {
                    sigStatus = _t(
                        "Backup has a <validity>valid</validity> signature from " +
                            "<verify>verified</verify> session <device></device>",
                        {},
                        { validity, verify, device },
                    );
                } else if (sig.valid && !sig.deviceTrust?.isVerified()) {
                    sigStatus = _t(
                        "Backup has a <validity>valid</validity> signature from " +
                            "<verify>unverified</verify> session <device></device>",
                        {},
                        { validity, verify, device },
                    );
                } else if (!sig.valid && sig.deviceTrust?.isVerified()) {
                    sigStatus = _t(
                        "Backup has an <validity>invalid</validity> signature from " +
                            "<verify>verified</verify> session <device></device>",
                        {},
                        { validity, verify, device },
                    );
                } else if (!sig.valid && !sig.deviceTrust?.isVerified()) {
                    sigStatus = _t(
                        "Backup has an <validity>invalid</validity> signature from " +
                            "<verify>unverified</verify> session <device></device>",
                        {},
                        { validity, verify, device },
                    );
                }

                return <div key={i}>{sigStatus}</div>;
            });
            if (!backupSigStatus?.sigs?.length) {
                backupSigStatuses = _t("Backup is not signed by any of your sessions");
            }

            let trustedLocally: string | undefined;
            if (backupSigStatus?.trusted_locally) {
                trustedLocally = _t("This backup is trusted because it has been restored on this session");
            }

            extraDetailsTableRows = (
                <>
                    <tr>
                        <th scope="row">{_t("Backup version:")}</th>
                        <td>{backupInfo.version}</td>
                    </tr>
                    <tr>
                        <th scope="row">{_t("Algorithm:")}</th>
                        <td>{backupInfo.algorithm}</td>
                    </tr>
                </>
            );

            extraDetails = (
                <>
                    {uploadStatus}
                    <div>{backupSigStatuses}</div>
                    <div>{trustedLocally}</div>
                </>
            );

            actions.push(
                <AccessibleButton key="restore" kind="primary" onClick={this.restoreBackup}>
                    {restoreButtonCaption}
                </AccessibleButton>,
            );

            if (!isSecureBackupRequired(MatrixClientPeg.get())) {
                actions.push(
                    <AccessibleButton key="delete" kind="danger" onClick={this.deleteBackup}>
                        {_t("Delete Backup")}
                    </AccessibleButton>,
                );
            }
        } else {
            statusDescription = (
                <>
                    <SettingsSubsectionText>
                        {_t(
                            "Your keys are <b>not being backed up from this session</b>.",
                            {},
                            { b: (sub) => <b>{sub}</b> },
                        )}
                    </SettingsSubsectionText>
                    <SettingsSubsectionText>
                        {_t("Back up your keys before signing out to avoid losing them.")}
                    </SettingsSubsectionText>
                </>
            );
            actions.push(
                <AccessibleButton key="setup" kind="primary" onClick={this.startNewBackup}>
                    {_t("Set up")}
                </AccessibleButton>,
            );
        }

        if (secretStorageKeyInAccount) {
            actions.push(
                <AccessibleButton key="reset" kind="danger" onClick={this.resetSecretStorage}>
                    {_t("Reset")}
                </AccessibleButton>,
            );
        }

        let backupKeyWellFormedText = "";
        if (backupKeyCached) {
            backupKeyWellFormedText = ", ";
            if (backupKeyWellFormed) {
                backupKeyWellFormedText += _t("well formed");
            } else {
                backupKeyWellFormedText += _t("unexpected type");
            }
        }

        let actionRow: JSX.Element | undefined;
        if (actions.length) {
            actionRow = <div className="mx_SecureBackupPanel_buttonRow">{actions}</div>;
        }

        return (
            <>
                <SettingsSubsectionText>
                    {_t(
                        "Back up your encryption keys with your account data in case you " +
                            "lose access to your sessions. Your keys will be secured with a " +
                            "unique Security Key.",
                    )}
                </SettingsSubsectionText>
                {statusDescription}
                <details>
                    <summary>{_t("Advanced")}</summary>
                    <table className="mx_SecureBackupPanel_statusList">
                        <tr>
                            <th scope="row">{_t("Backup key stored:")}</th>
                            <td>{backupKeyStored === true ? _t("in secret storage") : _t("not stored")}</td>
                        </tr>
                        <tr>
                            <th scope="row">{_t("Backup key cached:")}</th>
                            <td>
                                {backupKeyCached ? _t("cached locally") : _t("not found locally")}
                                {backupKeyWellFormedText}
                            </td>
                        </tr>
                        <tr>
                            <th scope="row">{_t("Secret storage public key:")}</th>
                            <td>{secretStorageKeyInAccount ? _t("in account data") : _t("not found")}</td>
                        </tr>
                        <tr>
                            <th scope="row">{_t("Secret storage:")}</th>
                            <td>{secretStorageReady ? _t("ready") : _t("not ready")}</td>
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

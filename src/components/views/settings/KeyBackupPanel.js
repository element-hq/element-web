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

import React from 'react';

import * as sdk from '../../../index';
import {MatrixClientPeg} from '../../../MatrixClientPeg';
import { _t } from '../../../languageHandler';
import Modal from '../../../Modal';

export default class KeyBackupPanel extends React.PureComponent {
    constructor(props) {
        super(props);

        this._unmounted = false;
        this.state = {
            loading: true,
            error: null,
            backupInfo: null,
            backupSigStatus: null,
            backupKeyStored: null,
            sessionsRemaining: 0,
        };
    }

    componentDidMount() {
        this._checkKeyBackupStatus();

        MatrixClientPeg.get().on('crypto.keyBackupStatus', this._onKeyBackupStatus);
        MatrixClientPeg.get().on(
            'crypto.keyBackupSessionsRemaining',
            this._onKeyBackupSessionsRemaining,
        );
    }

    componentWillUnmount() {
        this._unmounted = true;

        if (MatrixClientPeg.get()) {
            MatrixClientPeg.get().removeListener('crypto.keyBackupStatus', this._onKeyBackupStatus);
            MatrixClientPeg.get().removeListener(
                'crypto.keyBackupSessionsRemaining',
                this._onKeyBackupSessionsRemaining,
            );
        }
    }

    _onKeyBackupSessionsRemaining = (sessionsRemaining) => {
        this.setState({
            sessionsRemaining,
        });
    }

    _onKeyBackupStatus = () => {
        // This just loads the current backup status rather than forcing
        // a re-check otherwise we risk causing infinite loops
        this._loadBackupStatus();
    }

    async _checkKeyBackupStatus() {
        try {
            const {backupInfo, trustInfo} = await MatrixClientPeg.get().checkKeyBackup();
            const backupKeyStored = Boolean(await MatrixClientPeg.get().isKeyBackupKeyStored());
            this.setState({
                backupInfo,
                backupSigStatus: trustInfo,
                backupKeyStored,
                error: null,
                loading: false,
            });
        } catch (e) {
            console.log("Unable to fetch check backup status", e);
            if (this._unmounted) return;
            this.setState({
                error: e,
                backupInfo: null,
                backupSigStatus: null,
                backupKeyStored: null,
                loading: false,
            });
        }
    }

    async _loadBackupStatus() {
        this.setState({loading: true});
        try {
            const backupInfo = await MatrixClientPeg.get().getKeyBackupVersion();
            const backupSigStatus = await MatrixClientPeg.get().isKeyBackupTrusted(backupInfo);
            const backupKeyStored = await MatrixClientPeg.get().isKeyBackupKeyStored();
            if (this._unmounted) return;
            this.setState({
                error: null,
                backupInfo,
                backupSigStatus,
                backupKeyStored,
                loading: false,
            });
        } catch (e) {
            console.log("Unable to fetch key backup status", e);
            if (this._unmounted) return;
            this.setState({
                error: e,
                backupInfo: null,
                backupSigStatus: null,
                backupKeyStored: null,
                loading: false,
            });
        }
    }

    _startNewBackup = () => {
        Modal.createTrackedDialogAsync('Key Backup', 'Key Backup',
            import('../../../async-components/views/dialogs/keybackup/CreateKeyBackupDialog'),
            {
                onFinished: () => {
                    this._loadBackupStatus();
                },
            }, null, /* priority = */ false, /* static = */ true,
        );
    }

    _deleteBackup = () => {
        const QuestionDialog = sdk.getComponent('dialogs.QuestionDialog');
        Modal.createTrackedDialog('Delete Backup', '', QuestionDialog, {
            title: _t('Delete Backup'),
            description: _t(
                "Are you sure? You will lose your encrypted messages if your " +
                "keys are not backed up properly.",
            ),
            button: _t('Delete Backup'),
            danger: true,
            onFinished: (proceed) => {
                if (!proceed) return;
                this.setState({loading: true});
                MatrixClientPeg.get().deleteKeyBackupVersion(this.state.backupInfo.version).then(() => {
                    this._loadBackupStatus();
                });
            },
        });
    }

    _restoreBackup = async () => {
        const RestoreKeyBackupDialog = sdk.getComponent('dialogs.keybackup.RestoreKeyBackupDialog');
        Modal.createTrackedDialog(
            'Restore Backup', '', RestoreKeyBackupDialog, null, null,
            /* priority = */ false, /* static = */ true,
        );
    }

    render() {
        const Spinner = sdk.getComponent("elements.Spinner");
        const AccessibleButton = sdk.getComponent("elements.AccessibleButton");
        const encryptedMessageAreEncrypted = _t(
            "Encrypted messages are secured with end-to-end encryption. " +
            "Only you and the recipient(s) have the keys to read these messages.",
        );

        if (this.state.error) {
            return (
                <div className="error">
                    {_t("Unable to load key backup status")}
                </div>
            );
        } else if (this.state.loading) {
            return <Spinner />;
        } else if (this.state.backupInfo) {
            let clientBackupStatus;
            let restoreButtonCaption = _t("Restore from Backup");

            if (MatrixClientPeg.get().getKeyBackupEnabled()) {
                clientBackupStatus = <div>
                    <p>{encryptedMessageAreEncrypted}</p>
                    <p>✅ {_t("This session is backing up your keys. ")}</p>
                </div>;
            } else {
                clientBackupStatus = <div>
                    <p>{encryptedMessageAreEncrypted}</p>
                    <p>{_t(
                        "This session is <b>not backing up your keys</b>, " +
                        "but you do have an existing backup you can restore from " +
                        "and add to going forward.", {},
                        {b: sub => <b>{sub}</b>},
                    )}</p>
                    <p>{_t(
                        "Connect this session to key backup before signing out to avoid " +
                        "losing any keys that may only be on this session.",
                    )}</p>
                </div>;
                restoreButtonCaption = _t("Connect this session to Key Backup");
            }

            let keyStatus;
            if (this.state.backupKeyStored === true) {
                keyStatus = _t("in secret storage");
            } else {
                keyStatus = _t("not stored");
            }

            let uploadStatus;
            const { sessionsRemaining } = this.state;
            if (!MatrixClientPeg.get().getKeyBackupEnabled()) {
                // No upload status to show when backup disabled.
                uploadStatus = "";
            } else if (sessionsRemaining > 0) {
                uploadStatus = <div>
                    {_t("Backing up %(sessionsRemaining)s keys...", { sessionsRemaining })} <br />
                </div>;
            } else {
                uploadStatus = <div>
                    {_t("All keys backed up")} <br />
                </div>;
            }

            let backupSigStatuses = this.state.backupSigStatus.sigs.map((sig, i) => {
                const deviceName = sig.device ? (sig.device.getDisplayName() || sig.device.deviceId) : null;
                const validity = sub =>
                    <span className={sig.valid ? 'mx_KeyBackupPanel_sigValid' : 'mx_KeyBackupPanel_sigInvalid'}>
                        {sub}
                    </span>;
                const verify = sub =>
                    <span className={sig.device && sig.deviceTrust.isVerified() ? 'mx_KeyBackupPanel_deviceVerified' : 'mx_KeyBackupPanel_deviceNotVerified'}>
                        {sub}
                    </span>;
                const device = sub => <span className="mx_KeyBackupPanel_deviceName">{deviceName}</span>;
                const fromThisDevice = (
                    sig.device &&
                    sig.device.getFingerprint() === MatrixClientPeg.get().getDeviceEd25519Key()
                );
                const fromThisUser = (
                    sig.crossSigningId &&
                    sig.deviceId === MatrixClientPeg.get().getCrossSigningId()
                );
                let sigStatus;
                if (sig.valid && fromThisUser) {
                    sigStatus = _t(
                        "Backup has a <validity>valid</validity> signature from this user",
                        {}, { validity },
                    );
                } else if (!sig.valid && fromThisUser) {
                    sigStatus = _t(
                        "Backup has a <validity>invalid</validity> signature from this user",
                        {}, { validity },
                    );
                } else if (sig.crossSigningId) {
                    sigStatus = _t(
                        "Backup has a signature from <verify>unknown</verify> user with ID %(deviceId)s",
                        { deviceId: sig.deviceId }, { verify },
                    );
                } else if (!sig.device) {
                    sigStatus = _t(
                        "Backup has a signature from <verify>unknown</verify> session with ID %(deviceId)s",
                        { deviceId: sig.deviceId }, { verify },
                    );
                } else if (sig.valid && fromThisDevice) {
                    sigStatus = _t(
                        "Backup has a <validity>valid</validity> signature from this session",
                        {}, { validity },
                    );
                } else if (!sig.valid && fromThisDevice) {
                    // it can happen...
                    sigStatus = _t(
                        "Backup has an <validity>invalid</validity> signature from this session",
                        {}, { validity },
                    );
                } else if (sig.valid && sig.deviceTrust.isVerified()) {
                    sigStatus = _t(
                        "Backup has a <validity>valid</validity> signature from " +
                        "<verify>verified</verify> session <device></device>",
                        {}, { validity, verify, device },
                    );
                } else if (sig.valid && !sig.deviceTrust.isVerified()) {
                    sigStatus = _t(
                        "Backup has a <validity>valid</validity> signature from " +
                        "<verify>unverified</verify> session <device></device>",
                        {}, { validity, verify, device },
                    );
                } else if (!sig.valid && sig.deviceTrust.isVerified()) {
                    sigStatus = _t(
                        "Backup has an <validity>invalid</validity> signature from " +
                        "<verify>verified</verify> session <device></device>",
                        {}, { validity, verify, device },
                    );
                } else if (!sig.valid && !sig.deviceTrust.isVerified()) {
                    sigStatus = _t(
                        "Backup has an <validity>invalid</validity> signature from " +
                        "<verify>unverified</verify> session <device></device>",
                        {}, { validity, verify, device },
                    );
                }

                return <div key={i}>
                    {sigStatus}
                </div>;
            });
            if (this.state.backupSigStatus.sigs.length === 0) {
                backupSigStatuses = _t("Backup is not signed by any of your sessions");
            }

            let trustedLocally;
            if (this.state.backupSigStatus.trusted_locally) {
                trustedLocally = _t("This backup is trusted because it has been restored on this session");
            }

            const buttonRow = (
                <div className="mx_KeyBackupPanel_buttonRow">
                    <AccessibleButton kind="primary" onClick={this._restoreBackup}>
                        {restoreButtonCaption}
                    </AccessibleButton>&nbsp;&nbsp;&nbsp;
                    <AccessibleButton kind="danger" onClick={this._deleteBackup}>
                        {_t("Delete Backup")}
                    </AccessibleButton>
                </div>
            );

            return <div>
                <div>{clientBackupStatus}</div>
                <details>
                    <summary>{_t("Advanced")}</summary>
                    <div>{_t("Backup version: ")}{this.state.backupInfo.version}</div>
                    <div>{_t("Algorithm: ")}{this.state.backupInfo.algorithm}</div>
                    <div>{_t("Backup key stored: ")}{keyStatus}</div>
                    {uploadStatus}
                    <div>{backupSigStatuses}</div>
                    <div>{trustedLocally}</div>
                </details>
                {buttonRow}
            </div>;
        } else {
            return <div>
                <div>
                    <p>{_t(
                        "Your keys are <b>not being backed up from this session</b>.", {},
                        {b: sub => <b>{sub}</b>},
                    )}</p>
                    <p>{encryptedMessageAreEncrypted}</p>
                    <p>{_t("Back up your keys before signing out to avoid losing them.")}</p>
                </div>
                <div className="mx_KeyBackupPanel_buttonRow">
                    <AccessibleButton kind="primary" onClick={this._startNewBackup}>
                        {_t("Start using Key Backup")}
                    </AccessibleButton>
                </div>
            </div>;
        }
    }
}

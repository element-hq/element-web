/*
Copyright 2018 New Vector Ltd

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

import sdk from '../../../index';
import MatrixClientPeg from '../../../MatrixClientPeg';
import { _t } from '../../../languageHandler';
import Modal from '../../../Modal';

export default class KeyBackupPanel extends React.Component {
    constructor(props) {
        super(props);

        this._startNewBackup = this._startNewBackup.bind(this);
        this._deleteBackup = this._deleteBackup.bind(this);
        this._verifyDevice = this._verifyDevice.bind(this);
        this._onKeyBackupStatus = this._onKeyBackupStatus.bind(this);
        this._restoreBackup = this._restoreBackup.bind(this);

        this._unmounted = false;
        this.state = {
            loading: true,
            error: null,
            backupInfo: null,
        };
    }

    componentWillMount() {
        this._loadBackupStatus();

        MatrixClientPeg.get().on('crypto.keyBackupStatus', this._onKeyBackupStatus);
    }

    componentWillUnmount() {
        this._unmounted = true;

        if (MatrixClientPeg.get()) {
            MatrixClientPeg.get().removeListener('crypto.keyBackupStatus', this._onKeyBackupStatus);
        }
    }

    _onKeyBackupStatus() {
        this._loadBackupStatus();
    }

    async _loadBackupStatus() {
        this.setState({loading: true});
        try {
            const backupInfo = await MatrixClientPeg.get().getKeyBackupVersion();
            const backupSigStatus = await MatrixClientPeg.get().isKeyBackupTrusted(backupInfo);
            if (this._unmounted) return;
            this.setState({
                backupInfo,
                backupSigStatus,
                loading: false,
            });
        } catch (e) {
            console.log("Unable to fetch key backup status", e);
            if (this._unmounted) return;
            this.setState({
                error: e,
                loading: false,
            });
            return;
        }
    }

    _startNewBackup() {
        const CreateKeyBackupDialog = sdk.getComponent('dialogs.keybackup.CreateKeyBackupDialog');
        Modal.createTrackedDialog('Key Backup', 'Key Backup', CreateKeyBackupDialog, {
            onFinished: () => {
                this._loadBackupStatus();
            },
        });
    }

    _deleteBackup() {
        const QuestionDialog = sdk.getComponent('dialogs.QuestionDialog');
        Modal.createTrackedDialog('Delete Backup', '', QuestionDialog, {
            title: _t('Delete Backup'),
            description: _t(
                "Delete your backed up encryption keys from the server? " +
                "You will no longer be able to use your recovery key to read encrypted message history",
            ),
            button: _t('Delete backup'),
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

    _restoreBackup() {
        const RestoreKeyBackupDialog = sdk.getComponent('dialogs.keybackup.RestoreKeyBackupDialog');
        Modal.createTrackedDialog('Restore Backup', '', RestoreKeyBackupDialog, {
        });
    }

    _verifyDevice(e) {
        const device = this.state.backupSigStatus.sigs[e.target.getAttribute('data-sigindex')].device;

        const DeviceVerifyDialog = sdk.getComponent('views.dialogs.DeviceVerifyDialog');
        Modal.createTrackedDialog('Device Verify Dialog', '', DeviceVerifyDialog, {
            userId: MatrixClientPeg.get().credentials.userId,
            device: device,
            onFinished: () => {
                this._loadBackupStatus();
            },
        });
    }

    render() {
        const Spinner = sdk.getComponent("elements.Spinner");
        const AccessibleButton = sdk.getComponent("elements.AccessibleButton");

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
            if (MatrixClientPeg.get().getKeyBackupEnabled()) {
                clientBackupStatus = _t("This device is uploading keys to this backup");
            } else {
                // XXX: display why and how to fix it
                clientBackupStatus = _t(
                    "This device is <b>not</b> uploading keys to this backup", {},
                    {b: x => <b>{x}</b>},
                );
            }

            let backupSigStatuses = this.state.backupSigStatus.sigs.map((sig, i) => {
                const sigStatusSubstitutions = {
                    validity: sub =>
                        <span className={sig.valid ? 'mx_KeyBackupPanel_sigValid' : 'mx_KeyBackupPanel_sigInvalid'}>
                            {sub}
                        </span>,
                    verify: sub =>
                        <span className={sig.device.isVerified() ? 'mx_KeyBackupPanel_deviceVerified' : 'mx_KeyBackupPanel_deviceNotVerified'}>
                            {sub}
                        </span>,
                    device: sub => <span className="mx_KeyBackupPanel_deviceName">{sig.device.getDisplayName()}</span>,
                };
                let sigStatus;
                if (sig.device.getFingerprint() === MatrixClientPeg.get().getDeviceEd25519Key()) {
                    sigStatus = _t(
                        "Backup has a <validity>valid</validity> signature from this device",
                        {}, sigStatusSubstitutions,
                    );
                } else if (sig.valid && sig.device.isVerified()) {
                    sigStatus = _t(
                        "Backup has a <validity>valid</validity> signature from " +
                        "<verify>verified</verify> device <device>x</device>",
                        {}, sigStatusSubstitutions,
                    );
                } else if (sig.valid && !sig.device.isVerified()) {
                    sigStatus = _t(
                        "Backup has a <validity>valid</validity> signature from " +
                        "<verify>unverified</verify> device <device></device>",
                        {}, sigStatusSubstitutions,
                    );
                } else if (!sig.valid && sig.device.isVerified()) {
                    sigStatus = _t(
                        "Backup has an <validity>invalid</validity> signature from " +
                        "<verify>verified</verify> device <device></device>",
                        {}, sigStatusSubstitutions,
                    );
                } else if (!sig.valid && !sig.device.isVerified()) {
                    sigStatus = _t(
                        "Backup has an <validity>invalid</validity> signature from " +
                        "<verify>unverified</verify> device <device></device>",
                        {}, sigStatusSubstitutions,
                    );
                }

                let verifyButton;
                if (!sig.device.isVerified()) {
                    verifyButton = <div><br /><AccessibleButton className="mx_UserSettings_button"
                            onClick={this._verifyDevice} data-sigindex={i}>
                        { _t("Verify...") }
                    </AccessibleButton></div>;
                }

                return <div key={i}>
                    {sigStatus}
                    {verifyButton}
                </div>;
            });
            if (this.state.backupSigStatus.sigs.length === 0) {
                backupSigStatuses = _t("Backup is not signed by any of your devices");
            }

            return <div>
                {_t("Backup version: ")}{this.state.backupInfo.version}<br />
                {_t("Algorithm: ")}{this.state.backupInfo.algorithm}<br />
                {clientBackupStatus}<br />
                <div>{backupSigStatuses}</div><br />
                <br />
                <AccessibleButton className="mx_UserSettings_button"
                        onClick={this._restoreBackup}>
                    { _t("Restore backup") }
                </AccessibleButton>&nbsp;&nbsp;&nbsp;
                <AccessibleButton className="mx_UserSettings_button danger"
                        onClick={this._deleteBackup}>
                    { _t("Delete backup") }
                </AccessibleButton>
            </div>;
        } else {
            return <div>
                {_t("No backup is present")}<br /><br />
                <AccessibleButton className="mx_UserSettings_button"
                        onClick={this._startNewBackup}>
                    { _t("Start a new backup") }
                </AccessibleButton>
            </div>;
        }
    }
}

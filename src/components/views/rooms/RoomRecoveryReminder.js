/*
Copyright 2018, 2019 New Vector Ltd

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

import React from "react";
import PropTypes from "prop-types";
import sdk from "../../../index";
import { _t } from "../../../languageHandler";
import Modal from "../../../Modal";
import MatrixClientPeg from "../../../MatrixClientPeg";
import SettingsStore, {SettingLevel} from "../../../settings/SettingsStore";

export default class RoomRecoveryReminder extends React.PureComponent {
    static propTypes = {
        // called if the user sets the option to suppress this reminder in the future
        onDontAskAgainSet: PropTypes.func,
    }

    static defaultProps = {
        onDontAskAgainSet: function() {},
    }

    constructor(props) {
        super(props);

        this.state = {
            loading: true,
            error: null,
            unverifiedDevice: null,
        };
    }

    componentWillMount() {
        this._loadBackupStatus();
    }

    async _loadBackupStatus() {
        let backupSigStatus;
        try {
            const backupInfo = await MatrixClientPeg.get().getKeyBackupVersion();
            backupSigStatus = await MatrixClientPeg.get().isKeyBackupTrusted(backupInfo);
        } catch (e) {
            console.log("Unable to fetch key backup status", e);
            this.setState({
                loading: false,
                error: e,
            });
            return;
        }

        let unverifiedDevice;
        for (const sig of backupSigStatus.sigs) {
            if (!sig.device.isVerified()) {
                unverifiedDevice = sig.device;
                break;
            }
        }
        this.setState({
            loading: false,
            unverifiedDevice,
        });
    }

    showSetupDialog = () => {
        if (this.state.unverifiedDevice) {
            // A key backup exists for this account, but the creating device is not
            // verified, so we'll show the device verify dialog.
            // TODO: Should change to a restore key backup flow that checks the recovery
            // passphrase while at the same time also cross-signing the device as well in
            // a single flow (for cases where a key backup exists but the backup creating
            // device is unverified).  Since we don't have that yet, we'll look for an
            // unverified device and verify it.  Note that this means we won't restore
            // keys yet; instead we'll only trust the backup for sending our own new keys
            // to it.
            const DeviceVerifyDialog = sdk.getComponent('views.dialogs.DeviceVerifyDialog');
            Modal.createTrackedDialog('Device Verify Dialog', '', DeviceVerifyDialog, {
                userId: MatrixClientPeg.get().credentials.userId,
                device: this.state.unverifiedDevice,
            });
            return;
        }

        // The default case assumes that a key backup doesn't exist for this account, so
        // we'll show the create key backup flow.
        Modal.createTrackedDialogAsync("Key Backup", "Key Backup",
            import("../../../async-components/views/dialogs/keybackup/CreateKeyBackupDialog"),
        );
    }

    onDontAskAgainClick = () => {
        // When you choose "Don't ask again" from the room reminder, we show a
        // dialog to confirm the choice.
        Modal.createTrackedDialogAsync("Ignore Recovery Reminder", "Ignore Recovery Reminder",
            import("../../../async-components/views/dialogs/keybackup/IgnoreRecoveryReminderDialog"),
            {
                onDontAskAgain: async () => {
                    await SettingsStore.setValue(
                        "showRoomRecoveryReminder",
                        null,
                        SettingLevel.ACCOUNT,
                        false,
                    );
                    this.props.onDontAskAgainSet();
                },
                onSetup: () => {
                    this.showSetupDialog();
                },
            },
        );
    }

    onSetupClick = () => {
        this.showSetupDialog();
    }

    render() {
        if (this.state.loading) {
            return null;
        }

        const AccessibleButton = sdk.getComponent("views.elements.AccessibleButton");

        let body;
        if (this.state.error) {
            body = <div className="error">
                {_t("Unable to load key backup status")}
            </div>;
        } else if (this.state.unverifiedDevice) {
            // A key backup exists for this account, but the creating device is not
            // verified.
            body = _t(
                "To view your secure message history and ensure you can view new " +
                "messages on future devices, set up Secure Message Recovery.",
            );
        } else {
            // The default case assumes that a key backup doesn't exist for this account.
            // (This component doesn't currently check that itself.)
            body = _t(
                "If you log out or use another device, you'll lose your " +
                "secure message history. To prevent this, set up Secure " +
                "Message Recovery.",
            );
        }

        return (
            <div className="mx_RoomRecoveryReminder">
                <div className="mx_RoomRecoveryReminder_header">{_t(
                    "Secure Message Recovery",
                )}</div>
                <div className="mx_RoomRecoveryReminder_body">{body}</div>
                <div className="mx_RoomRecoveryReminder_buttons">
                    <AccessibleButton className="mx_RoomRecoveryReminder_button mx_RoomRecoveryReminder_secondary"
                        onClick={this.onDontAskAgainClick}>
                        { _t("Don't ask again") }
                    </AccessibleButton>
                    <AccessibleButton className="mx_RoomRecoveryReminder_button"
                        onClick={this.onSetupClick}>
                        { _t("Set up") }
                    </AccessibleButton>
                </div>
            </div>
        );
    }
}

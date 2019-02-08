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
            backupInfo: null,
        };
    }

    componentWillMount() {
        this._loadBackupStatus();
    }

    async _loadBackupStatus() {
        try {
            const backupInfo = await MatrixClientPeg.get().getKeyBackupVersion();
            this.setState({
                loading: false,
                backupInfo,
            });
        } catch (e) {
            console.log("Unable to fetch key backup status", e);
            this.setState({
                loading: false,
                error: e,
            });
            return;
        }
    }

    showSetupDialog = () => {
        if (this.state.backupInfo) {
            // A key backup exists for this account, but the creating device is not
            // verified, so restore the backup which will give us the keys from it and
            // allow us to trust it (ie. upload keys to it)
            const RestoreKeyBackupDialog = sdk.getComponent('dialogs.keybackup.RestoreKeyBackupDialog');
            Modal.createTrackedDialog('Restore Backup', '', RestoreKeyBackupDialog, {});
        } else {
            Modal.createTrackedDialogAsync("Key Backup", "Key Backup",
                import("../../../async-components/views/dialogs/keybackup/CreateKeyBackupDialog"),
            );
        }
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
        } else if (this.state.backupInfo) {
            // A key backup exists for this account, but we're not using it.
            body = <div>
                <p>{_t(
                    "Secure Key Backup should be active on all of your devices to avoid " +
                    "losing access to your encrypted messages.",
                )}</p>
            </div>;
        } else {
            body = _t(
                "Securely back up your decryption keys to the server to make sure " +
                "you'll always be able to read your encrypted messages.",
            );
        }

        return (
            <div className="mx_RoomRecoveryReminder">
                <div className="mx_RoomRecoveryReminder_header">{_t(
                    "Don't risk losing your encrypted messages!",
                )}</div>
                <div className="mx_RoomRecoveryReminder_body">{body}</div>
                <div className="mx_RoomRecoveryReminder_buttons">
                    <AccessibleButton className="mx_RoomRecoveryReminder_button"
                        onClick={this.onSetupClick}>
                        {_t("Activate Secure Key Backup")}
                    </AccessibleButton>
                    <p><AccessibleButton className="mx_RoomRecoveryReminder_secondary mx_linkButton"
                        onClick={this.onDontAskAgainClick}>
                        { _t("No thanks, I'll download a copy of my decryption keys before I log out") }
                    </AccessibleButton></p>
                </div>
            </div>
        );
    }
}

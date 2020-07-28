/*
Copyright 2018, 2019 New Vector Ltd
Copyright 2020 The Matrix.org Foundation C.I.C.

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
import * as sdk from "../../../index";
import { _t } from "../../../languageHandler";
import Modal from "../../../Modal";
import {MatrixClientPeg} from "../../../MatrixClientPeg";
import SettingsStore from "../../../settings/SettingsStore";
import {SettingLevel} from "../../../settings/SettingLevel";

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
            notNowClicked: false,
        };
    }

    componentDidMount() {
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
        }
    }

    showSetupDialog = () => {
        if (this.state.backupInfo) {
            // A key backup exists for this account, but the creating device is not
            // verified, so restore the backup which will give us the keys from it and
            // allow us to trust it (ie. upload keys to it)
            const RestoreKeyBackupDialog = sdk.getComponent('dialogs.keybackup.RestoreKeyBackupDialog');
            Modal.createTrackedDialog(
                'Restore Backup', '', RestoreKeyBackupDialog, null, null,
                /* priority = */ false, /* static = */ true,
            );
        } else {
            Modal.createTrackedDialogAsync("Key Backup", "Key Backup",
                import("../../../async-components/views/dialogs/keybackup/CreateKeyBackupDialog"),
                null, null, /* priority = */ false, /* static = */ true,
            );
        }
    }

    onOnNotNowClick = () => {
        this.setState({notNowClicked: true});
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
        // If there was an error loading just don't display the banner: we'll try again
        // next time the user switchs to the room.
        if (this.state.error || this.state.loading || this.state.notNowClicked) {
            return null;
        }

        const AccessibleButton = sdk.getComponent("views.elements.AccessibleButton");

        let setupCaption;
        if (this.state.backupInfo) {
            setupCaption = _t("Connect this session to Key Backup");
        } else {
            setupCaption = _t("Start using Key Backup");
        }

        return (
            <div className="mx_RoomRecoveryReminder">
                <div className="mx_RoomRecoveryReminder_header">{_t(
                    "Never lose encrypted messages",
                )}</div>
                <div className="mx_RoomRecoveryReminder_body">
                    <p>{_t(
                        "Messages in this room are secured with end-to-end " +
                        "encryption. Only you and the recipient(s) have the " +
                        "keys to read these messages.",
                    )}</p>
                    <p>{_t(
                        "Securely back up your keys to avoid losing them. " +
                        "<a>Learn more.</a>", {},
                        {
                            // TODO: We don't have this link yet: this will prevent the translators
                            // having to re-translate the string when we do.
                            a: sub => '',
                        },
                    )}</p>
                </div>
                <div className="mx_RoomRecoveryReminder_buttons">
                    <AccessibleButton kind="primary"
                        onClick={this.onSetupClick}>
                        {setupCaption}
                    </AccessibleButton>
                    <AccessibleButton className="mx_RoomRecoveryReminder_secondary mx_linkButton"
                        onClick={this.onOnNotNowClick}>
                        { _t("Not now") }
                    </AccessibleButton>
                    <AccessibleButton className="mx_RoomRecoveryReminder_secondary mx_linkButton"
                        onClick={this.onDontAskAgainClick}>
                        { _t("Don't ask me again") }
                    </AccessibleButton>
                </div>
            </div>
        );
    }
}

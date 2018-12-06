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

import React from "react";
import PropTypes from "prop-types";
import sdk from "../../../index";
import { _t } from "../../../languageHandler";
import Modal from "../../../Modal";

export default class RoomRecoveryReminder extends React.PureComponent {
    static propTypes = {
        onFinished: PropTypes.func.isRequired,
    }

    showKeyBackupDialog = () => {
        Modal.createTrackedDialogAsync("Key Backup", "Key Backup",
            import("../../../async-components/views/dialogs/keybackup/CreateKeyBackupDialog"),
            {
                onFinished: this.props.onFinished,
            },
        );
    }

    onDontAskAgainClick = () => {
        // When you choose "Don't ask again" from the room reminder, we show a
        // dialog to confirm the choice.
        Modal.createTrackedDialogAsync("Ignore Recovery Reminder", "Ignore Recovery Reminder",
            import("../../../async-components/views/dialogs/keybackup/IgnoreRecoveryReminderDialog"),
            {
                onDontAskAgain: () => {
                    // Report false to the caller, who should prevent the
                    // reminder from appearing in the future.
                    this.props.onFinished(false);
                },
                onSetup: () => {
                    this.showKeyBackupDialog();
                },
            },
        );
    }

    onSetupClick = () => {
        this.showKeyBackupDialog();
    }

    render() {
        const AccessibleButton = sdk.getComponent("views.elements.AccessibleButton");

        return (
            <div className="mx_RoomRecoveryReminder">
                <div className="mx_RoomRecoveryReminder_header">{_t(
                    "Secure Message Recovery",
                )}</div>
                <div className="mx_RoomRecoveryReminder_body">{_t(
                    "If you log out or use another device, you'll lose your " +
                    "secure message history. To prevent this, set up Secure " +
                    "Message Recovery.",
                )}</div>
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

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
import sdk from "../../../../index";
import MatrixClientPeg from '../../../../MatrixClientPeg';
import dis from "../../../../dispatcher";
import { _t } from "../../../../languageHandler";
import Modal from "../../../../Modal";

export default class NewRecoveryMethodDialog extends React.PureComponent {
    static propTypes = {
        onFinished: PropTypes.func.isRequired,
    }

    onGoToSettingsClick = () => {
        this.props.onFinished();
        dis.dispatch({ action: 'view_user_settings' });
    }

    onSetupClick = async() => {
        // TODO: Should change to a restore key backup flow that checks the
        // recovery passphrase while at the same time also cross-signing the
        // device as well in a single flow.  Since we don't have that yet, we'll
        // look for an unverified device and verify it.  Note that this means
        // we won't restore keys yet; instead we'll only trust the backup for
        // sending our own new keys to it.
        let backupSigStatus;
        try {
            const backupInfo = await MatrixClientPeg.get().getKeyBackupVersion();
            backupSigStatus = await MatrixClientPeg.get().isKeyBackupTrusted(backupInfo);
        } catch (e) {
            console.log("Unable to fetch key backup status", e);
            return;
        }

        let unverifiedDevice;
        for (const sig of backupSigStatus.sigs) {
            if (!sig.device.isVerified()) {
                unverifiedDevice = sig.device;
                break;
            }
        }
        if (!unverifiedDevice) {
            console.log("Unable to find a device to verify.");
            return;
        }

        const DeviceVerifyDialog = sdk.getComponent('views.dialogs.DeviceVerifyDialog');
        Modal.createTrackedDialog('Device Verify Dialog', '', DeviceVerifyDialog, {
            userId: MatrixClientPeg.get().credentials.userId,
            device: unverifiedDevice,
            onFinished: this.props.onFinished,
        });
    }

    render() {
        const BaseDialog = sdk.getComponent("views.dialogs.BaseDialog");
        const DialogButtons = sdk.getComponent("views.elements.DialogButtons");
        const title = <span className="mx_NewRecoveryMethodDialog_title">
            {_t("New Recovery Method")}
        </span>;

        return (
            <BaseDialog className="mx_NewRecoveryMethodDialog"
                onFinished={this.props.onFinished}
                title={title}
                hasCancel={false}
            >
                <div>
                    <p>{_t(
                        "A new recovery passphrase and key for Secure " +
                        "Messages has been detected.",
                    )}</p>
                    <p>{_t(
                        "Setting up Secure Messages on this device " +
                        "will re-encrypt this device's message history with " +
                        "the new recovery method.",
                    )}</p>
                    <p className="warning">{_t(
                        "If you didn't set the new recovery method, an " +
                        "attacker may be trying to access your account. " +
                        "Change your account password and set a new recovery " +
                        "method immediately in Settings.",
                    )}</p>
                    <DialogButtons
                        primaryButton={_t("Set up Secure Messages")}
                        onPrimaryButtonClick={this.onSetupClick}
                        cancelButton={_t("Go to Settings")}
                        onCancel={this.onGoToSettingsClick}
                    />
                </div>
            </BaseDialog>
        );
    }
}

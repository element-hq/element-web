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

import sdk from './index';
import Modal from './Modal';

export default class SuggestKeyRestoreHandler {
    constructor(matrixClient) {
        this._matrixClient = matrixClient;
    }

    handleSuggestKeyRestore() {
        const onVerifyDevice = () => {
            const DeviceVerifyDialog = sdk.getComponent('views.dialogs.DeviceVerifyDialog');

            Modal.createTrackedDialog('Key Restore', 'Starting verification', DeviceVerifyDialog, {
                // userId: this.props.userId,
                // device: this.state.deviceInfo,
                onFinished: (verified) => {
                    if (verified) {
                        this.props.onFinished();
                    }
                },
            });
        };

        const onRecoverFromBackup = () => {
             // XXX: we need this so that you can get at it from UserSettings too
             // * prompt for recovery key
             // * Download the current backup version info from the server and check the key decrypts it okay.
             // * Check that the public key for that backup version matches the recovery key
             // * show a spinner
             // * Download all the existing keys from the server
             // * Decrypt them using the recovery key
             // * Add them to the local store (which encrypts them as normal with "DEFAULT KEY"
             // * Enable incremental backups for this device.
        };

        const onIgnoreSuggestion = () => {
        };

        const onFinished = () => {
            this.suggestBackup();
        };

        // FIXME: need a way to know if an account has ever touched E2E before.
        // Perhaps we can extend toDevice to include a flag if it's the first time the
        // server has ever sent a room_key to a client or something?
        const virginAccount = false;

        if (virginAccount) {
            this.suggestBackup();
            return;
        }

        const SuggestKeyRestoreDialog = sdk.getComponent("dialogs.SuggestKeyRestoreDialog");
        Modal.createTrackedDialog('Key Restore', 'Key Restore', SuggestKeyRestoreDialog, {
            matrixClient: this._matrixClient,
            isOnlyDevice: false, // FIXME
            hasOnlineBackup: false, // FIXME
            onVerifyDevice: onVerifyDevice,
            onRecoverFromBackup: onRecoverFromBackup,
            onIgnoreSuggestion: onIgnoreSuggestion,
            onFinished: onFinished,
        });
    }

    suggestBackup() {
        if (hasOnlineBackup) return;

        const onStartNewBackup = () => {
          // XXX: we need this so that you can get at it from UserSettings too
          // * Upload all their existing keys from their session store to the backup using the bulk upload API.
          //   (Having re-encrypted them using the backup keypair rather than the static one used to store them on disk)
        };

        const SuggestKeyBackupDialog = sdk.getComponent("dialogs.SuggestKeyBackupDialog");
        Modal.createTrackedDialog('Key Backup', 'Key Backup', SuggestKeyBackupDialog, {
            onStartNewBackup: onStartNewBackup,
        });        
    }    
}


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
import sdk from '../../../../index';
import MatrixClientPeg from '../../../../MatrixClientPeg';

import { _t } from '../../../../languageHandler';

function isRecoveryKeyValid(r) {
    return MatrixClientPeg.get().isValidRecoveryKey(r.replace(/ /g, ''));
}

/**
 * Dialog for restoring e2e keys from a backup and the user's recovery key
 */
export default React.createClass({
    getInitialState: function() {
        return {
            backupInfo: null,
            loading: false,
            loadError: null,
            restoreError: null,
            recoveryKey: "",
            recoverInfo: null,
            recoveryKeyValid: false,
        };
    },

    componentWillMount: function() {
        this._loadBackupStatus();
    },

    _onCancel: function() {
        this.props.onFinished(false);
    },

    _onDone: function() {
        this.props.onFinished(true);
    },

    _onRecoveryKeyChange: function(e) {
        this.setState({
            recoveryKey: e.target.value,
            recoveryKeyValid: isRecoveryKeyValid(e.target.value),
        });
    },

    _onRecoverClick: async function() {
        this.setState({
            loading: true,
            restoreError: null,
        });
        try {
            const recoverInfo = await MatrixClientPeg.get().restoreKeyBackups(
                this.state.recoveryKey.replace(/ /g, ''), undefined, undefined, this.state.backupInfo.version,
            );
            this.setState({
                loading: false,
                recoverInfo,
            });
        } catch (e) {
            console.log("Error restoring backup", e);
            this.setState({
                loading: false,
                restoreError: e,
            });
        }
    },

    _loadBackupStatus: async function() {
        this.setState({
            loading: true,
            loadError: null,
        });
        try {
            const backupInfo = await MatrixClientPeg.get().getKeyBackupVersion();
            this.setState({
                loadError: null,
                loading: false,
                backupInfo,
            });
        } catch (e) {
            console.log("Error loading backup status", e);
            this.setState({
                loadError: e,
                loading: false,
            });
        }
    },

    render: function() {
        const BaseDialog = sdk.getComponent('views.dialogs.BaseDialog');
        const Spinner = sdk.getComponent("elements.Spinner");

        let content;
        if (this.state.loading) {
            content = <Spinner />;
        } else if (this.state.loadError) {
            content = _t("Unable to load backup status");
        } else if (this.state.restoreError) {
            content = _t("Unable to restore backup");
        } else if (this.state.backupInfo === null) {
            content = _t("No backup found!");
        } else if (this.state.recoverInfo) {
            let failedToDecrypt;
            if (this.state.recoverInfo.total > this.state.recoverInfo.imported) {
                failedToDecrypt = <p>{_t(
                    "Failed to decrypt %(failedCount)s sessions!",
                    {failedCount: this.state.recoverInfo.total - this.state.recoverInfo.imported},
                )}</p>;
            }
            content = <div>
                <p>{_t("Restored %(sessionCount)s session keys", {sessionCount: this.state.recoverInfo.imported})}</p>
                {failedToDecrypt}
            </div>;
        } else {
            const DialogButtons = sdk.getComponent('views.elements.DialogButtons');

            let keyStatus;
            if (this.state.recoveryKey.length === 0) {
                keyStatus = <div className="mx_RestoreKeyBackupDialog_keyStatus"></div>;
            } else if (this.state.recoveryKeyValid) {
                keyStatus = <div className="mx_RestoreKeyBackupDialog_keyStatus">
                    {"\uD83D\uDC4D "}{_t("This looks like a valid recovery key!")}
                </div>;
            } else {
                keyStatus = <div className="mx_RestoreKeyBackupDialog_keyStatus">
                    {"\uD83D\uDC4E "}{_t("Not a valid recovery key")}
                </div>;
            }

            content = <div>
                {_t("Please enter the recovery key generated when you set up key backup")}<br />
                <textarea
                    onChange={this._onRecoveryKeyChange}
                    value={this.state.recoveryKey}
                    style={{width: "90%"}}
                    autoFocus={true}
                />
                {keyStatus}
                <DialogButtons primaryButton={_t('Recover')}
                    onPrimaryButtonClick={this._onRecoverClick}
                    hasCancel={true}
                    onCancel={this._onCancel}
                    focus={false}
                    primaryDisabled={!this.state.recoveryKeyValid}
                />
            </div>;
        }

        return (
            <BaseDialog className='mx_RestoreKeyBackupDialog'
                onFinished={this.props.onFinished}
                title={_t('Restore Key Backup')}
            >
            <div>
                {content}
            </div>
            </BaseDialog>
        );
    },
});

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

import React from 'react';
import createReactClass from 'create-react-class';
import sdk from '../../../../index';
import MatrixClientPeg from '../../../../MatrixClientPeg';
import Modal from '../../../../Modal';

import { MatrixClient } from 'matrix-js-sdk';

import { _t } from '../../../../languageHandler';

const RESTORE_TYPE_PASSPHRASE = 0;
const RESTORE_TYPE_RECOVERYKEY = 1;

/**
 * Dialog for restoring e2e keys from a backup and the user's recovery key
 */
export default createReactClass({
    getInitialState: function() {
        return {
            backupInfo: null,
            loading: false,
            loadError: null,
            restoreError: null,
            recoveryKey: "",
            recoverInfo: null,
            recoveryKeyValid: false,
            forceRecoveryKey: false,
            passPhrase: '',
            restoreType: null,
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

    _onUseRecoveryKeyClick: function() {
        this.setState({
            forceRecoveryKey: true,
        });
    },

    _onResetRecoveryClick: function() {
        this.props.onFinished(false);
        Modal.createTrackedDialogAsync('Key Backup', 'Key Backup',
            import('../../../../async-components/views/dialogs/keybackup/CreateKeyBackupDialog'),
            {
                onFinished: () => {
                    this._loadBackupStatus();
                },
            },
        );
    },

    _onRecoveryKeyChange: function(e) {
        this.setState({
            recoveryKey: e.target.value,
            recoveryKeyValid: MatrixClientPeg.get().isValidRecoveryKey(e.target.value),
        });
    },

    _onPassPhraseNext: async function() {
        this.setState({
            loading: true,
            restoreError: null,
            restoreType: RESTORE_TYPE_PASSPHRASE,
        });
        try {
            const recoverInfo = await MatrixClientPeg.get().restoreKeyBackupWithPassword(
                this.state.passPhrase, undefined, undefined, this.state.backupInfo,
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

    _onRecoveryKeyNext: async function() {
        this.setState({
            loading: true,
            restoreError: null,
            restoreType: RESTORE_TYPE_RECOVERYKEY,
        });
        try {
            const recoverInfo = await MatrixClientPeg.get().restoreKeyBackupWithRecoveryKey(
                this.state.recoveryKey, undefined, undefined, this.state.backupInfo,
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

    _onPassPhraseChange: function(e) {
        this.setState({
            passPhrase: e.target.value,
        });
    },

    _onPassPhraseKeyPress: function(e) {
        if (e.key === "Enter") {
            this._onPassPhraseNext();
        }
    },

    _onRecoveryKeyKeyPress: function(e) {
        if (e.key === "Enter" && this.state.recoveryKeyValid) {
            this._onRecoveryKeyNext();
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

        const backupHasPassphrase = (
            this.state.backupInfo &&
            this.state.backupInfo.auth_data &&
            this.state.backupInfo.auth_data.private_key_salt &&
            this.state.backupInfo.auth_data.private_key_iterations
        );

        let content;
        let title;
        if (this.state.loading) {
            title = _t("Loading...");
            content = <Spinner />;
        } else if (this.state.loadError) {
            title = _t("Error");
            content = _t("Unable to load backup status");
        } else if (this.state.restoreError) {
            if (this.state.restoreError.errcode === MatrixClient.RESTORE_BACKUP_ERROR_BAD_KEY) {
                if (this.state.restoreType === RESTORE_TYPE_RECOVERYKEY) {
                    title = _t("Recovery Key Mismatch");
                    content = <div>
                        <p>{_t(
                            "Backup could not be decrypted with this key: " +
                            "please verify that you entered the correct recovery key.",
                        )}</p>
                    </div>;
                } else {
                    title = _t("Incorrect Recovery Passphrase");
                    content = <div>
                        <p>{_t(
                            "Backup could not be decrypted with this passphrase: " +
                            "please verify that you entered the correct recovery passphrase.",
                        )}</p>
                    </div>;
                }
            } else {
                title = _t("Error");
                content = _t("Unable to restore backup");
            }
        } else if (this.state.backupInfo === null) {
            title = _t("Error");
            content = _t("No backup found!");
        } else if (this.state.recoverInfo) {
            title = _t("Backup Restored");
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
        } else if (backupHasPassphrase && !this.state.forceRecoveryKey) {
            const DialogButtons = sdk.getComponent('views.elements.DialogButtons');
            const AccessibleButton = sdk.getComponent('elements.AccessibleButton');
            title = _t("Enter Recovery Passphrase");
            content = <div>
                <p>{_t(
                    "<b>Warning</b>: you should only set up key backup " +
                    "from a trusted computer.", {},
                    { b: sub => <b>{sub}</b> },
                )}</p>
                <p>{_t(
                    "Access your secure message history and set up secure " +
                    "messaging by entering your recovery passphrase.",
                )}</p>

                <div className="mx_RestoreKeyBackupDialog_primaryContainer">
                    <input type="password"
                        className="mx_RestoreKeyBackupDialog_passPhraseInput"
                        onChange={this._onPassPhraseChange}
                        onKeyPress={this._onPassPhraseKeyPress}
                        value={this.state.passPhrase}
                        autoFocus={true}
                    />
                    <DialogButtons primaryButton={_t('Next')}
                        onPrimaryButtonClick={this._onPassPhraseNext}
                        hasCancel={true}
                        onCancel={this._onCancel}
                        focus={false}
                    />
                </div>
                {_t(
                    "If you've forgotten your recovery passphrase you can "+
                    "<button1>use your recovery key</button1> or " +
                    "<button2>set up new recovery options</button2>"
                , {}, {
                    button1: s => <AccessibleButton className="mx_linkButton"
                        element="span"
                        onClick={this._onUseRecoveryKeyClick}
                    >
                        {s}
                    </AccessibleButton>,
                    button2: s => <AccessibleButton className="mx_linkButton"
                        element="span"
                        onClick={this._onResetRecoveryClick}
                    >
                        {s}
                    </AccessibleButton>,
                })}
            </div>;
        } else {
            title = _t("Enter Recovery Key");
            const DialogButtons = sdk.getComponent('views.elements.DialogButtons');
            const AccessibleButton = sdk.getComponent('elements.AccessibleButton');

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
                <p>{_t(
                    "<b>Warning</b>: you should only set up key backup " +
                    "from a trusted computer.", {},
                    { b: sub => <b>{sub}</b> },
                )}</p>
                <p>{_t(
                    "Access your secure message history and set up secure " +
                    "messaging by entering your recovery key.",
                )}</p>

                <div className="mx_RestoreKeyBackupDialog_primaryContainer">
                    <input className="mx_RestoreKeyBackupDialog_recoveryKeyInput"
                        onChange={this._onRecoveryKeyChange}
                        onKeyPress={this._onRecoveryKeyKeyPress}
                        value={this.state.recoveryKey}
                        autoFocus={true}
                    />
                    {keyStatus}
                    <DialogButtons primaryButton={_t('Next')}
                        onPrimaryButtonClick={this._onRecoveryKeyNext}
                        hasCancel={true}
                        onCancel={this._onCancel}
                        focus={false}
                        primaryDisabled={!this.state.recoveryKeyValid}
                    />
                </div>
                {_t(
                    "If you've forgotten your recovery passphrase you can "+
                    "<button>set up new recovery options</button>"
                , {}, {
                    button: s => <AccessibleButton className="mx_linkButton"
                        element="span"
                        onClick={this._onResetRecoveryClick}
                    >
                        {s}
                    </AccessibleButton>,
                })}
            </div>;
        }

        return (
            <BaseDialog className='mx_RestoreKeyBackupDialog'
                onFinished={this.props.onFinished}
                title={title}
            >
            <div>
                {content}
            </div>
            </BaseDialog>
        );
    },
});

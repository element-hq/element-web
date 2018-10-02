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
import Promise from 'bluebird';

import { _t, _td } from '../../../../languageHandler';

const PHASE_INTRO = 0;
const PHASE_GENERATING = 1;
const PHASE_SHOWKEY = 2;
const PHASE_MAKEBACKUP = 3;
const PHASE_UPLOAD = 4;
const PHASE_DONE = 5;

// XXX: copied from ShareDialog: factor out into utils
function selectText(target) {
    const range = document.createRange();
    range.selectNodeContents(target);

    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
}

/**
 * Walks the user through the process of creating an e22 key backup
 * on the server.
 */
export default React.createClass({
    getInitialState: function() {
        return {
            phase: PHASE_INTRO,
        };
    },

    componentWillMount: function() {
        this._recoveryKeyNode = null;
        this._keyBackupInfo = null;
    },

    _collectRecoveryKeyNode: function(n) {
        this._recoveryKeyNode = n;
    },

    _copyRecoveryKey: function() {
        selectText(this._recoveryKeyNode);
        const successful = document.execCommand('copy');
        if (successful) {
            this.setState({copied: true});
        }
    },

    _createBackup: function() {
        this.setState({
            phase: PHASE_MAKEBACKUP,
            error: null,
        });
        this._createBackupPromise = MatrixClientPeg.get().createKeyBackupVersion(
            this._keyBackupInfo,
        ).then((info) => {
            this.setState({
                phase: PHASE_UPLOAD,
            });
            return MatrixClientPeg.get().backupAllGroupSessions(info.version);
        }).then(() => {
            this.setState({
                phase: PHASE_DONE,
            });
        }).catch(e => {
            console.log("Error creating key backup", e);
            this.setState({
                error: e,
            });
        });
    },

    _onCancel: function() {
        this.props.onFinished(false);
    },

    _onDone: function() {
        this.props.onFinished(true);
    },

    _generateKey: async function() {
        this.setState({
            phase: PHASE_GENERATING,
        });
        // Look, work is being done!
        await Promise.delay(1200);
        this._keyBackupInfo = MatrixClientPeg.get().prepareKeyBackupVersion();
        this.setState({
            phase: PHASE_SHOWKEY,
        });
    },

    _renderPhaseIntro: function() {
        const DialogButtons = sdk.getComponent('views.elements.DialogButtons');
        return <div>
            <p>To avoid ever losing your encrypted message history, you
            can save your encryption keys on the server, protected by a recovery key.
            </p>
            <p>To maximise security, your recovery key is never stored by the app,
            so you must store it yourself somewhere safe.</p>
            <p>Warning: storing your encryption keys on the server means that
            if someone gains access to your account and also steals your recovery key,
            they will be able to read all of your encrypted conversation history.
            </p>

            <p>Do you wish to generate a recovery key and backup your encryption
            keys on the server?</p>

            <DialogButtons primaryButton={_t('Generate recovery key')}
                onPrimaryButtonClick={this._generateKey}
                onCancel={this._onCancel}
                cancelButton={_t("I'll stick to manual backups")}
            />
        </div>;
    },

    _renderPhaseShowKey: function() {
        return <div>
            <p>{_t("Here is your recovery key:")}</p>
            <p className="mx_CreateKeyBackupDialog_recoveryKey">
                <code ref={this._collectRecoveryKeyNode}>{this._keyBackupInfo.recovery_key}</code>
            </p>
            <p>{_t("This key can decrypt your full message history.")}</p>
            <p>{_t(
                "When you've saved it somewhere safe, proceed to the next step where the key will be used to "+
                "create an encrypted backup of your message keys and then destroyed.",
            )}</p>
            <div className="mx_Dialog_buttons">
                <button onClick={this._copyRecoveryKey}>
                    {this.state.copied ? _t("Copied!") : _t("Copy to clipboard")}
                </button>
                <button onClick={this._createBackup}>
                    {_t("Proceed")}
                </button>
            </div>
        </div>;
    },

    _renderBusyPhase: function(text) {
        const Spinner = sdk.getComponent('views.elements.Spinner');
        return <div>
            <p>{_t(text)}</p>
            <Spinner />
        </div>;
    },

    _renderPhaseDone: function() {
        const DialogButtons = sdk.getComponent('views.elements.DialogButtons');
        return <div>
            <p>{_t("Backup created")}</p>
            <p>{_t("Your encryption keys are now being backed up to your Homeserver.")}</p>
            <DialogButtons primaryButton={_t('Close')}
                onPrimaryButtonClick={this._onDone}
                hasCancel={false}
            />
        </div>;
    },

    render: function() {
        const BaseDialog = sdk.getComponent('views.dialogs.BaseDialog');

        let content;
        if (this.state.error) {
            content = <div>
                <p>{_t("Unable to create key backup")}</p>
                <div className="mx_Dialog_buttons">
                    <button onClick={this._createBackup}>
                        {_t("Retry")}
                    </button>
                </div>
            </div>;
        } else {
            switch (this.state.phase) {
                case PHASE_INTRO:
                    content = this._renderPhaseIntro();
                    break;
                case PHASE_GENERATING:
                    content = this._renderBusyPhase(_td("Generating recovery key..."));
                    break;
                case PHASE_SHOWKEY:
                    content = this._renderPhaseShowKey();
                    break;
                case PHASE_MAKEBACKUP:
                    content = this._renderBusyPhase(_td("Creating backup..."));
                    break;
                case PHASE_UPLOAD:
                    content = this._renderBusyPhase(_td("Uploading keys..."));
                    break;
                case PHASE_DONE:
                    content = this._renderPhaseDone();
                    break;
            }
        }

        return (
            <BaseDialog className='mx_CreateKeyBackupDialog'
                onFinished={this.props.onFinished}
                title={_t('Create Key Backup')}
                hasCancel={[PHASE_INTRO, PHASE_DONE].includes(this.state.phase)}
            >
            <div>
                {content}
            </div>
            </BaseDialog>
        );
    },
});

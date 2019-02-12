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
import sdk from '../../../../index';
import MatrixClientPeg from '../../../../MatrixClientPeg';
import { scorePassword } from '../../../../utils/PasswordScorer';

import FileSaver from 'file-saver';

import { _t } from '../../../../languageHandler';

const PHASE_PASSPHRASE = 0;
const PHASE_PASSPHRASE_CONFIRM = 1;
const PHASE_SHOWKEY = 2;
const PHASE_KEEPITSAFE = 3;
const PHASE_BACKINGUP = 4;
const PHASE_DONE = 5;
const PHASE_OPTOUT_CONFIRM = 6;

const PASSWORD_MIN_SCORE = 4; // So secure, many characters, much complex, wow, etc, etc.
const PASSPHRASE_FEEDBACK_DELAY = 500; // How long after keystroke to offer passphrase feedback, ms.

// XXX: copied from ShareDialog: factor out into utils
function selectText(target) {
    const range = document.createRange();
    range.selectNodeContents(target);

    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
}

/**
 * Walks the user through the process of creating an e2e key backup
 * on the server.
 */
export default React.createClass({
    getInitialState: function() {
        return {
            phase: PHASE_PASSPHRASE,
            passPhrase: '',
            passPhraseConfirm: '',
            copied: false,
            downloaded: false,
            zxcvbnResult: null,
            setPassPhrase: false,
        };
    },

    componentWillMount: function() {
        this._recoveryKeyNode = null;
        this._keyBackupInfo = null;
        this._setZxcvbnResultTimeout = null;
    },

    componentWillUnmount: function() {
        if (this._setZxcvbnResultTimeout !== null) {
            clearTimeout(this._setZxcvbnResultTimeout);
        }
    },

    _collectRecoveryKeyNode: function(n) {
        this._recoveryKeyNode = n;
    },

    _onCopyClick: function() {
        selectText(this._recoveryKeyNode);
        const successful = document.execCommand('copy');
        if (successful) {
            this.setState({
                copied: true,
                phase: PHASE_KEEPITSAFE,
            });
        }
    },

    _onDownloadClick: function() {
        const blob = new Blob([this._keyBackupInfo.recovery_key], {
            type: 'text/plain;charset=us-ascii',
        });
        FileSaver.saveAs(blob, 'recovery-key.txt');

        this.setState({
            downloaded: true,
            phase: PHASE_KEEPITSAFE,
        });
    },

    _createBackup: async function() {
        this.setState({
            phase: PHASE_BACKINGUP,
            error: null,
        });
        let info;
        try {
            info = await MatrixClientPeg.get().createKeyBackupVersion(
                this._keyBackupInfo,
            );
            await MatrixClientPeg.get().scheduleAllGroupSessionsForBackup();
            this.setState({
                phase: PHASE_DONE,
            });
        } catch (e) {
            console.log("Error creating key backup", e);
            // TODO: If creating a version succeeds, but backup fails, should we
            // delete the version, disable backup, or do nothing?  If we just
            // disable without deleting, we'll enable on next app reload since
            // it is trusted.
            if (info) {
                MatrixClientPeg.get().deleteKeyBackupVersion(info.version);
            }
            this.setState({
                error: e,
            });
        }
    },

    _onCancel: function() {
        this.props.onFinished(false);
    },

    _onDone: function() {
        this.props.onFinished(true);
    },

    _onOptOutClick: function() {
        this.setState({phase: PHASE_OPTOUT_CONFIRM});
    },

    _onSetUpClick: function() {
        this.setState({phase: PHASE_PASSPHRASE});
    },

    _onSkipPassPhraseClick: async function() {
        this._keyBackupInfo = await MatrixClientPeg.get().prepareKeyBackupVersion();
        this.setState({
            copied: false,
            downloaded: false,
            phase: PHASE_SHOWKEY,
        });
    },

    _onPassPhraseNextClick: function() {
        this.setState({phase: PHASE_PASSPHRASE_CONFIRM});
    },

    _onPassPhraseKeyPress: async function(e) {
        if (e.key === 'Enter') {
            // If we're waiting for the timeout before updating the result at this point,
            // skip ahead and do it now, otherwise we'll deny the attempt to proceed
            // even if the user entered a valid passphrase
            if (this._setZxcvbnResultTimeout !== null) {
                clearTimeout(this._setZxcvbnResultTimeout);
                this._setZxcvbnResultTimeout = null;
                await new Promise((resolve) => {
                    this.setState({
                        zxcvbnResult: scorePassword(this.state.passPhrase),
                    }, resolve);
                });
            }
            if (this._passPhraseIsValid()) {
                this._onPassPhraseNextClick();
            }
        }
    },

    _onPassPhraseConfirmNextClick: async function() {
        this._keyBackupInfo = await MatrixClientPeg.get().prepareKeyBackupVersion(this.state.passPhrase);
        this.setState({
            setPassPhrase: true,
            copied: false,
            downloaded: false,
            phase: PHASE_SHOWKEY,
        });
    },

    _onPassPhraseConfirmKeyPress: function(e) {
        if (e.key === 'Enter' && this.state.passPhrase === this.state.passPhraseConfirm) {
            this._onPassPhraseConfirmNextClick();
        }
    },

    _onSetAgainClick: function() {
        this.setState({
            passPhrase: '',
            passPhraseConfirm: '',
            phase: PHASE_PASSPHRASE,
            zxcvbnResult: null,
        });
    },

    _onKeepItSafeBackClick: function() {
        this.setState({
            phase: PHASE_SHOWKEY,
        });
    },

    _onPassPhraseChange: function(e) {
        this.setState({
            passPhrase: e.target.value,
        });

        if (this._setZxcvbnResultTimeout !== null) {
            clearTimeout(this._setZxcvbnResultTimeout);
        }
        this._setZxcvbnResultTimeout = setTimeout(() => {
            this._setZxcvbnResultTimeout = null;
            this.setState({
                // precompute this and keep it in state: zxcvbn is fast but
                // we use it in a couple of different places so no point recomputing
                // it unnecessarily.
                zxcvbnResult: scorePassword(this.state.passPhrase),
            });
        }, PASSPHRASE_FEEDBACK_DELAY);
    },

    _onPassPhraseConfirmChange: function(e) {
        this.setState({
            passPhraseConfirm: e.target.value,
        });
    },

    _passPhraseIsValid: function() {
        return this.state.zxcvbnResult && this.state.zxcvbnResult.score >= PASSWORD_MIN_SCORE;
    },

    _renderPhasePassPhrase: function() {
        const DialogButtons = sdk.getComponent('views.elements.DialogButtons');

        let strengthMeter;
        let helpText;
        if (this.state.zxcvbnResult) {
            if (this.state.zxcvbnResult.score >= PASSWORD_MIN_SCORE) {
                helpText = _t("Great! This passphrase looks strong enough.");
            } else {
                const suggestions = [];
                for (let i = 0; i < this.state.zxcvbnResult.feedback.suggestions.length; ++i) {
                    suggestions.push(<div key={i}>{this.state.zxcvbnResult.feedback.suggestions[i]}</div>);
                }
                const suggestionBlock = <div>{suggestions.length > 0 ? suggestions : _t("Keep going...")}</div>;

                helpText = <div>
                    {this.state.zxcvbnResult.feedback.warning}
                    {suggestionBlock}
                </div>;
            }
            strengthMeter = <div>
                <progress max={PASSWORD_MIN_SCORE} value={this.state.zxcvbnResult.score} />
            </div>;
        }

        return <div>
            <p>{_t(
                "<b>Warning</b>: you should only set up key backup from a trusted computer.", {},
                { b: sub => <b>{sub}</b> },
            )}</p>
            <p>{_t(
                "We'll store an encrypted copy of your keys on our server. " +
                "Protect your backup with a passphrase to keep it secure.",
            )}</p>
            <p>{_t("For maximum security, this should be different from your account password.")}</p>

            <div className="mx_CreateKeyBackupDialog_primaryContainer">
                <div className="mx_CreateKeyBackupDialog_passPhraseContainer">
                    <input type="password"
                        onChange={this._onPassPhraseChange}
                        onKeyPress={this._onPassPhraseKeyPress}
                        value={this.state.passPhrase}
                        className="mx_CreateKeyBackupDialog_passPhraseInput"
                        placeholder={_t("Enter a passphrase...")}
                        autoFocus={true}
                    />
                    <div className="mx_CreateKeyBackupDialog_passPhraseHelp">
                        {strengthMeter}
                        {helpText}
                    </div>
                </div>
            </div>

            <DialogButtons primaryButton={_t('Next')}
                onPrimaryButtonClick={this._onPassPhraseNextClick}
                hasCancel={false}
                disabled={!this._passPhraseIsValid()}
            />

            <details>
                <summary>{_t("Advanced")}</summary>
                <p><button onClick={this._onSkipPassPhraseClick} >
                    {_t("Set up with a Recovery Key")}
                </button></p>
            </details>
        </div>;
    },

    _renderPhasePassPhraseConfirm: function() {
        const AccessibleButton = sdk.getComponent('elements.AccessibleButton');

        let matchText;
        if (this.state.passPhraseConfirm === this.state.passPhrase) {
            matchText = _t("That matches!");
        } else if (!this.state.passPhrase.startsWith(this.state.passPhraseConfirm)) {
            // only tell them they're wrong if they've actually gone wrong.
            // Security concious readers will note that if you left riot-web unattended
            // on this screen, this would make it easy for a malicious person to guess
            // your passphrase one letter at a time, but they could get this faster by
            // just opening the browser's developer tools and reading it.
            // Note that not having typed anything at all will not hit this clause and
            // fall through so empty box === no hint.
            matchText = _t("That doesn't match.");
        }

        let passPhraseMatch = null;
        if (matchText) {
            passPhraseMatch = <div className="mx_CreateKeyBackupDialog_passPhraseMatch">
                <div>{matchText}</div>
                <div>
                    <AccessibleButton element="span" className="mx_linkButton" onClick={this._onSetAgainClick}>
                        {_t("Go back to set it again.")}
                    </AccessibleButton>
                </div>
            </div>;
        }
        const DialogButtons = sdk.getComponent('views.elements.DialogButtons');
        return <div>
            <p>{_t(
                "Please enter your passphrase a second time to confirm.",
            )}</p>
            <div className="mx_CreateKeyBackupDialog_primaryContainer">
                <div className="mx_CreateKeyBackupDialog_passPhraseContainer">
                    <div>
                        <input type="password"
                            onChange={this._onPassPhraseConfirmChange}
                            onKeyPress={this._onPassPhraseConfirmKeyPress}
                            value={this.state.passPhraseConfirm}
                            className="mx_CreateKeyBackupDialog_passPhraseInput"
                            placeholder={_t("Repeat your passphrase...")}
                            autoFocus={true}
                        />
                    </div>
                    {passPhraseMatch}
                </div>
            </div>
            <DialogButtons primaryButton={_t('Next')}
                onPrimaryButtonClick={this._onPassPhraseConfirmNextClick}
                hasCancel={false}
                disabled={this.state.passPhrase !== this.state.passPhraseConfirm}
            />
        </div>;
    },

    _renderPhaseShowKey: function() {
        let bodyText;
        if (this.state.setPassPhrase) {
            bodyText = _t(
                "As a safety net, you can use it to restore your encrypted message " +
                "history if you forget your Recovery Passphrase.",
            );
        } else {
            bodyText = _t("As a safety net, you can use it to restore your encrypted message history.");
        }

        return <div>
            <p>{_t(
                "Your recovery key is a safety net - you can use it to restore " +
                "access to your encrypted messages if you forget your passphrase.",
            )}</p>
            <p>{_t(
                "Keep your recovery key somewhere very secure, like a password manager (or a safe)",
            )}</p>
            <p>{bodyText}</p>
            <div className="mx_CreateKeyBackupDialog_primaryContainer">
                <div className="mx_CreateKeyBackupDialog_recoveryKeyHeader">
                    {_t("Your Recovery Key")}
                </div>
                <div className="mx_CreateKeyBackupDialog_recoveryKeyContainer">
                    <div className="mx_CreateKeyBackupDialog_recoveryKey">
                        <code ref={this._collectRecoveryKeyNode}>{this._keyBackupInfo.recovery_key}</code>
                    </div>
                    <div className="mx_CreateKeyBackupDialog_recoveryKeyButtons">
                        <button className="mx_Dialog_primary" onClick={this._onCopyClick}>
                            {_t("Copy to clipboard")}
                        </button>
                        <button className="mx_Dialog_primary" onClick={this._onDownloadClick}>
                            {_t("Download")}
                        </button>
                    </div>
                </div>
            </div>
        </div>;
    },

    _renderPhaseKeepItSafe: function() {
        let introText;
        if (this.state.copied) {
            introText = _t(
                "Your Recovery Key has been <b>copied to your clipboard</b>, paste it to:",
                {}, {b: s => <b>{s}</b>},
            );
        } else if (this.state.downloaded) {
            introText = _t(
                "Your Recovery Key is in your <b>Downloads</b> folder.",
                {}, {b: s => <b>{s}</b>},
            );
        }
        const DialogButtons = sdk.getComponent('views.elements.DialogButtons');
        return <div>
            {introText}
            <ul>
                <li>{_t("<b>Print it</b> and store it somewhere safe", {}, {b: s => <b>{s}</b>})}</li>
                <li>{_t("<b>Save it</b> on a USB key or backup drive", {}, {b: s => <b>{s}</b>})}</li>
                <li>{_t("<b>Copy it</b> to your personal cloud storage", {}, {b: s => <b>{s}</b>})}</li>
            </ul>
            <DialogButtons primaryButton={_t("OK")}
                onPrimaryButtonClick={this._createBackup}
                hasCancel={false}>
                <button onClick={this._onKeepItSafeBackClick}>{_t("Back")}</button>
            </DialogButtons>
        </div>;
    },

    _renderBusyPhase: function(text) {
        const Spinner = sdk.getComponent('views.elements.Spinner');
        return <div>
            <Spinner />
        </div>;
    },

    _renderPhaseDone: function() {
        const DialogButtons = sdk.getComponent('views.elements.DialogButtons');
        return <div>
            <p>{_t(
                "Your keys are being backed up (the first backup could take a few minutes).",
            )}</p>
            <DialogButtons primaryButton={_t('Okay')}
                onPrimaryButtonClick={this._onDone}
                hasCancel={false}
            />
        </div>;
    },

    _renderPhaseOptOutConfirm: function() {
        const DialogButtons = sdk.getComponent('views.elements.DialogButtons');
        return <div>
            {_t(
                "Without setting up Secure Message Recovery, you won't be able to restore your " +
                "encrypted message history if you log out or use another device.",
            )}
            <DialogButtons primaryButton={_t('Set up Secure Message Recovery')}
                onPrimaryButtonClick={this._onSetUpClick}
                hasCancel={false}
            >
                <button onClick={this._onCancel}>I understand, continue without</button>
            </DialogButtons>
        </div>;
    },

    _titleForPhase: function(phase) {
        switch (phase) {
            case PHASE_PASSPHRASE:
                return _t('Secure your backup with a passphrase');
            case PHASE_PASSPHRASE_CONFIRM:
                return _t('Confirm your passphrase');
            case PHASE_OPTOUT_CONFIRM:
                return _t('Warning!');
            case PHASE_SHOWKEY:
                return _t('Recovery key');
            case PHASE_KEEPITSAFE:
                return _t('Keep it safe');
            case PHASE_BACKINGUP:
                return _t('Starting backup...');
            case PHASE_DONE:
                return _t('Success!');
            default:
                return _t("Create Key Backup");
        }
    },

    render: function() {
        const BaseDialog = sdk.getComponent('views.dialogs.BaseDialog');

        let content;
        if (this.state.error) {
            const DialogButtons = sdk.getComponent('views.elements.DialogButtons');
            content = <div>
                <p>{_t("Unable to create key backup")}</p>
                <div className="mx_Dialog_buttons">
                    <DialogButtons primaryButton={_t('Retry')}
                        onPrimaryButtonClick={this._createBackup}
                        hasCancel={true}
                        onCancel={this._onCancel}
                    />
                </div>
            </div>;
        } else {
            switch (this.state.phase) {
                case PHASE_PASSPHRASE:
                    content = this._renderPhasePassPhrase();
                    break;
                case PHASE_PASSPHRASE_CONFIRM:
                    content = this._renderPhasePassPhraseConfirm();
                    break;
                case PHASE_SHOWKEY:
                    content = this._renderPhaseShowKey();
                    break;
                case PHASE_KEEPITSAFE:
                    content = this._renderPhaseKeepItSafe();
                    break;
                case PHASE_BACKINGUP:
                    content = this._renderBusyPhase();
                    break;
                case PHASE_DONE:
                    content = this._renderPhaseDone();
                    break;
                case PHASE_OPTOUT_CONFIRM:
                    content = this._renderPhaseOptOutConfirm();
                    break;
            }
        }

        return (
            <BaseDialog className='mx_CreateKeyBackupDialog'
                onFinished={this.props.onFinished}
                title={this._titleForPhase(this.state.phase)}
                hasCancel={[PHASE_PASSPHRASE, PHASE_DONE].includes(this.state.phase)}
            >
            <div>
                {content}
            </div>
            </BaseDialog>
        );
    },
});

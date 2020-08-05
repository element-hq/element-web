/*
Copyright 2018, 2019 New Vector Ltd
Copyright 2019, 2020 The Matrix.org Foundation C.I.C.

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

import React, {createRef} from 'react';
import FileSaver from 'file-saver';
import * as sdk from '../../../../index';
import {MatrixClientPeg} from '../../../../MatrixClientPeg';
import PropTypes from 'prop-types';
import {_t, _td} from '../../../../languageHandler';
import { accessSecretStorage } from '../../../../CrossSigningManager';
import AccessibleButton from "../../../../components/views/elements/AccessibleButton";
import {copyNode} from "../../../../utils/strings";
import PassphraseField from "../../../../components/views/auth/PassphraseField";

const PHASE_PASSPHRASE = 0;
const PHASE_PASSPHRASE_CONFIRM = 1;
const PHASE_SHOWKEY = 2;
const PHASE_KEEPITSAFE = 3;
const PHASE_BACKINGUP = 4;
const PHASE_DONE = 5;
const PHASE_OPTOUT_CONFIRM = 6;

const PASSWORD_MIN_SCORE = 4; // So secure, many characters, much complex, wow, etc, etc.

/*
 * Walks the user through the process of creating an e2e key backup
 * on the server.
 */
export default class CreateKeyBackupDialog extends React.PureComponent {
    static propTypes = {
        onFinished: PropTypes.func.isRequired,
    }

    constructor(props) {
        super(props);

        this._recoveryKeyNode = null;
        this._keyBackupInfo = null;

        this.state = {
            secureSecretStorage: null,
            phase: PHASE_PASSPHRASE,
            passPhrase: '',
            passPhraseValid: false,
            passPhraseConfirm: '',
            copied: false,
            downloaded: false,
        };

        this._passphraseField = createRef();
    }

    async componentDidMount() {
        const cli = MatrixClientPeg.get();
        const secureSecretStorage = await cli.doesServerSupportUnstableFeature("org.matrix.e2e_cross_signing");
        this.setState({ secureSecretStorage });

        // If we're using secret storage, skip ahead to the backing up step, as
        // `accessSecretStorage` will handle passphrases as needed.
        if (secureSecretStorage) {
            this.setState({ phase: PHASE_BACKINGUP });
            this._createBackup();
        }
    }

    _collectRecoveryKeyNode = (n) => {
        this._recoveryKeyNode = n;
    }

    _onCopyClick = () => {
        const successful = copyNode(this._recoveryKeyNode);
        if (successful) {
            this.setState({
                copied: true,
                phase: PHASE_KEEPITSAFE,
            });
        }
    }

    _onDownloadClick = () => {
        const blob = new Blob([this._keyBackupInfo.recovery_key], {
            type: 'text/plain;charset=us-ascii',
        });
        FileSaver.saveAs(blob, 'recovery-key.txt');

        this.setState({
            downloaded: true,
            phase: PHASE_KEEPITSAFE,
        });
    }

    _createBackup = async () => {
        const { secureSecretStorage } = this.state;
        this.setState({
            phase: PHASE_BACKINGUP,
            error: null,
        });
        let info;
        try {
            if (secureSecretStorage) {
                await accessSecretStorage(async () => {
                    info = await MatrixClientPeg.get().prepareKeyBackupVersion(
                        null /* random key */,
                        { secureSecretStorage: true },
                    );
                    info = await MatrixClientPeg.get().createKeyBackupVersion(info);
                });
            } else {
                info = await MatrixClientPeg.get().createKeyBackupVersion(
                    this._keyBackupInfo,
                );
            }
            await MatrixClientPeg.get().scheduleAllGroupSessionsForBackup();
            this.setState({
                phase: PHASE_DONE,
            });
        } catch (e) {
            console.error("Error creating key backup", e);
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
    }

    _onCancel = () => {
        this.props.onFinished(false);
    }

    _onDone = () => {
        this.props.onFinished(true);
    }

    _onOptOutClick = () => {
        this.setState({phase: PHASE_OPTOUT_CONFIRM});
    }

    _onSetUpClick = () => {
        this.setState({phase: PHASE_PASSPHRASE});
    }

    _onSkipPassPhraseClick = async () => {
        this._keyBackupInfo = await MatrixClientPeg.get().prepareKeyBackupVersion();
        this.setState({
            copied: false,
            downloaded: false,
            phase: PHASE_SHOWKEY,
        });
    }

    _onPassPhraseNextClick = async (e) => {
        e.preventDefault();
        if (!this._passphraseField.current) return; // unmounting

        await this._passphraseField.current.validate({ allowEmpty: false });
        if (!this._passphraseField.current.state.valid) {
            this._passphraseField.current.focus();
            this._passphraseField.current.validate({ allowEmpty: false, focused: true });
            return;
        }

        this.setState({phase: PHASE_PASSPHRASE_CONFIRM});
    };

    _onPassPhraseConfirmNextClick = async (e) => {
        e.preventDefault();

        if (this.state.passPhrase !== this.state.passPhraseConfirm) return;

        this._keyBackupInfo = await MatrixClientPeg.get().prepareKeyBackupVersion(this.state.passPhrase);
        this.setState({
            copied: false,
            downloaded: false,
            phase: PHASE_SHOWKEY,
        });
    };

    _onSetAgainClick = () => {
        this.setState({
            passPhrase: '',
            passPhraseValid: false,
            passPhraseConfirm: '',
            phase: PHASE_PASSPHRASE,
        });
    }

    _onKeepItSafeBackClick = () => {
        this.setState({
            phase: PHASE_SHOWKEY,
        });
    }

    _onPassPhraseValidate = (result) => {
        this.setState({
            passPhraseValid: result.valid,
        });
    };

    _onPassPhraseChange = (e) => {
        this.setState({
            passPhrase: e.target.value,
        });
    }

    _onPassPhraseConfirmChange = (e) => {
        this.setState({
            passPhraseConfirm: e.target.value,
        });
    }

    _renderPhasePassPhrase() {
        const DialogButtons = sdk.getComponent('views.elements.DialogButtons');

        return <form onSubmit={this._onPassPhraseNextClick}>
            <p>{_t(
                "<b>Warning</b>: You should only set up key backup from a trusted computer.", {},
                { b: sub => <b>{sub}</b> },
            )}</p>
            <p>{_t(
                "We'll store an encrypted copy of your keys on our server. " +
                "Secure your backup with a recovery passphrase.",
            )}</p>
            <p>{_t("For maximum security, this should be different from your account password.")}</p>

            <div className="mx_CreateKeyBackupDialog_primaryContainer">
                <div className="mx_CreateKeyBackupDialog_passPhraseContainer">
                    <PassphraseField
                        className="mx_CreateKeyBackupDialog_passPhraseInput"
                        onChange={this._onPassPhraseChange}
                        minScore={PASSWORD_MIN_SCORE}
                        value={this.state.passPhrase}
                        onValidate={this._onPassPhraseValidate}
                        fieldRef={this._passphraseField}
                        autoFocus={true}
                        label={_td("Enter a recovery passphrase")}
                        labelEnterPassword={_td("Enter a recovery passphrase")}
                        labelStrongPassword={_td("Great! This recovery passphrase looks strong enough.")}
                        labelAllowedButUnsafe={_td("Great! This recovery passphrase looks strong enough.")}
                    />
                </div>
            </div>

            <DialogButtons
                primaryButton={_t('Next')}
                onPrimaryButtonClick={this._onPassPhraseNextClick}
                hasCancel={false}
                disabled={!this.state.passPhraseValid}
            />

            <details>
                <summary>{_t("Advanced")}</summary>
                <AccessibleButton kind='primary' onClick={this._onSkipPassPhraseClick} >
                    {_t("Set up with a recovery key")}
                </AccessibleButton>
            </details>
        </form>;
    }

    _renderPhasePassPhraseConfirm() {
        const AccessibleButton = sdk.getComponent('elements.AccessibleButton');

        let matchText;
        let changeText;
        if (this.state.passPhraseConfirm === this.state.passPhrase) {
            matchText = _t("That matches!");
            changeText = _t("Use a different passphrase?");
        } else if (!this.state.passPhrase.startsWith(this.state.passPhraseConfirm)) {
            // only tell them they're wrong if they've actually gone wrong.
            // Security concious readers will note that if you left element-web unattended
            // on this screen, this would make it easy for a malicious person to guess
            // your passphrase one letter at a time, but they could get this faster by
            // just opening the browser's developer tools and reading it.
            // Note that not having typed anything at all will not hit this clause and
            // fall through so empty box === no hint.
            matchText = _t("That doesn't match.");
            changeText = _t("Go back to set it again.");
        }

        let passPhraseMatch = null;
        if (matchText) {
            passPhraseMatch = <div className="mx_CreateKeyBackupDialog_passPhraseMatch">
                <div>{matchText}</div>
                <div>
                    <AccessibleButton element="span" className="mx_linkButton" onClick={this._onSetAgainClick}>
                        {changeText}
                    </AccessibleButton>
                </div>
            </div>;
        }
        const DialogButtons = sdk.getComponent('views.elements.DialogButtons');
        return <form onSubmit={this._onPassPhraseConfirmNextClick}>
            <p>{_t(
                "Please enter your recovery passphrase a second time to confirm.",
            )}</p>
            <div className="mx_CreateKeyBackupDialog_primaryContainer">
                <div className="mx_CreateKeyBackupDialog_passPhraseContainer">
                    <div>
                        <input type="password"
                            onChange={this._onPassPhraseConfirmChange}
                            value={this.state.passPhraseConfirm}
                            className="mx_CreateKeyBackupDialog_passPhraseInput"
                            placeholder={_t("Repeat your recovery passphrase...")}
                            autoFocus={true}
                        />
                    </div>
                    {passPhraseMatch}
                </div>
            </div>
            <DialogButtons
                primaryButton={_t('Next')}
                onPrimaryButtonClick={this._onPassPhraseConfirmNextClick}
                hasCancel={false}
                disabled={this.state.passPhrase !== this.state.passPhraseConfirm}
            />
        </form>;
    }

    _renderPhaseShowKey() {
        return <div>
            <p>{_t(
                "Your recovery key is a safety net - you can use it to restore " +
                "access to your encrypted messages if you forget your recovery passphrase.",
            )}</p>
            <p>{_t(
                "Keep a copy of it somewhere secure, like a password manager or even a safe.",
            )}</p>
            <div className="mx_CreateKeyBackupDialog_primaryContainer">
                <div className="mx_CreateKeyBackupDialog_recoveryKeyHeader">
                    {_t("Your recovery key")}
                </div>
                <div className="mx_CreateKeyBackupDialog_recoveryKeyContainer">
                    <div className="mx_CreateKeyBackupDialog_recoveryKey">
                        <code ref={this._collectRecoveryKeyNode}>{this._keyBackupInfo.recovery_key}</code>
                    </div>
                    <div className="mx_CreateKeyBackupDialog_recoveryKeyButtons">
                        <button className="mx_Dialog_primary" onClick={this._onCopyClick}>
                            {_t("Copy")}
                        </button>
                        <button className="mx_Dialog_primary" onClick={this._onDownloadClick}>
                            {_t("Download")}
                        </button>
                    </div>
                </div>
            </div>
        </div>;
    }

    _renderPhaseKeepItSafe() {
        let introText;
        if (this.state.copied) {
            introText = _t(
                "Your recovery key has been <b>copied to your clipboard</b>, paste it to:",
                {}, {b: s => <b>{s}</b>},
            );
        } else if (this.state.downloaded) {
            introText = _t(
                "Your recovery key is in your <b>Downloads</b> folder.",
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
            <DialogButtons primaryButton={_t("Continue")}
                onPrimaryButtonClick={this._createBackup}
                hasCancel={false}>
                <button onClick={this._onKeepItSafeBackClick}>{_t("Back")}</button>
            </DialogButtons>
        </div>;
    }

    _renderBusyPhase(text) {
        const Spinner = sdk.getComponent('views.elements.Spinner');
        return <div>
            <Spinner />
        </div>;
    }

    _renderPhaseDone() {
        const DialogButtons = sdk.getComponent('views.elements.DialogButtons');
        return <div>
            <p>{_t(
                "Your keys are being backed up (the first backup could take a few minutes).",
            )}</p>
            <DialogButtons primaryButton={_t('OK')}
                onPrimaryButtonClick={this._onDone}
                hasCancel={false}
            />
        </div>;
    }

    _renderPhaseOptOutConfirm() {
        const DialogButtons = sdk.getComponent('views.elements.DialogButtons');
        return <div>
            {_t(
                "Without setting up Secure Message Recovery, you won't be able to restore your " +
                "encrypted message history if you log out or use another session.",
            )}
            <DialogButtons primaryButton={_t('Set up Secure Message Recovery')}
                onPrimaryButtonClick={this._onSetUpClick}
                hasCancel={false}
            >
                <button onClick={this._onCancel}>I understand, continue without</button>
            </DialogButtons>
        </div>;
    }

    _titleForPhase(phase) {
        switch (phase) {
            case PHASE_PASSPHRASE:
                return _t('Secure your backup with a recovery passphrase');
            case PHASE_PASSPHRASE_CONFIRM:
                return _t('Confirm your recovery passphrase');
            case PHASE_OPTOUT_CONFIRM:
                return _t('Warning!');
            case PHASE_SHOWKEY:
            case PHASE_KEEPITSAFE:
                return _t('Make a copy of your recovery key');
            case PHASE_BACKINGUP:
                return _t('Starting backup...');
            case PHASE_DONE:
                return _t('Success!');
            default:
                return _t("Create key backup");
        }
    }

    render() {
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
    }
}

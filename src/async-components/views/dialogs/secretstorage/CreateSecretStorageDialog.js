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

import React from 'react';
import PropTypes from 'prop-types';
import * as sdk from '../../../../index';
import {MatrixClientPeg} from '../../../../MatrixClientPeg';
import { scorePassword } from '../../../../utils/PasswordScorer';
import FileSaver from 'file-saver';
import { _t } from '../../../../languageHandler';
import Modal from '../../../../Modal';
import { promptForBackupPassphrase } from '../../../../CrossSigningManager';

const PHASE_LOADING = 0;
const PHASE_MIGRATE = 1;
const PHASE_PASSPHRASE = 2;
const PHASE_PASSPHRASE_CONFIRM = 3;
const PHASE_SHOWKEY = 4;
const PHASE_KEEPITSAFE = 5;
const PHASE_STORING = 6;
const PHASE_DONE = 7;
const PHASE_CONFIRM_SKIP = 8;

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

/*
 * Walks the user through the process of creating a passphrase to guard Secure
 * Secret Storage in account data.
 */
export default class CreateSecretStorageDialog extends React.PureComponent {
    static propTypes = {
        hasCancel: PropTypes.bool,
        accountPassword: PropTypes.string,
        force: PropTypes.bool,
    };

    static defaultProps = {
        hasCancel: true,
        force: false,
    };

    constructor(props) {
        super(props);

        this._keyInfo = null;
        this._encodedRecoveryKey = null;
        this._recoveryKeyNode = null;
        this._setZxcvbnResultTimeout = null;

        this.state = {
            phase: PHASE_LOADING,
            passPhrase: '',
            passPhraseConfirm: '',
            copied: false,
            downloaded: false,
            zxcvbnResult: null,
            backupInfo: null,
            backupSigStatus: null,
            // does the server offer a UI auth flow with just m.login.password
            // for /keys/device_signing/upload?
            canUploadKeysWithPasswordOnly: null,
            accountPassword: props.accountPassword || "",
            accountPasswordCorrect: null,
            // status of the key backup toggle switch
            useKeyBackup: true,
        };

        this._fetchBackupInfo();
        this._queryKeyUploadAuth();

        MatrixClientPeg.get().on('crypto.keyBackupStatus', this._onKeyBackupStatusChange);
    }

    componentWillUnmount() {
        MatrixClientPeg.get().removeListener('crypto.keyBackupStatus', this._onKeyBackupStatusChange);
        if (this._setZxcvbnResultTimeout !== null) {
            clearTimeout(this._setZxcvbnResultTimeout);
        }
    }

    async _fetchBackupInfo() {
        const backupInfo = await MatrixClientPeg.get().getKeyBackupVersion();
        const backupSigStatus = (
            // we may not have started crypto yet, in which case we definitely don't trust the backup
            MatrixClientPeg.get().isCryptoEnabled() && await MatrixClientPeg.get().isKeyBackupTrusted(backupInfo)
        );

        const { force } = this.props;
        const phase = (backupInfo && !force) ? PHASE_MIGRATE : PHASE_PASSPHRASE;

        this.setState({
            phase,
            backupInfo,
            backupSigStatus,
        });

        return {
            backupInfo,
            backupSigStatus,
        };
    }

    async _queryKeyUploadAuth() {
        try {
            await MatrixClientPeg.get().uploadDeviceSigningKeys(null, {});
            // We should never get here: the server should always require
            // UI auth to upload device signing keys. If we do, we upload
            // no keys which would be a no-op.
            console.log("uploadDeviceSigningKeys unexpectedly succeeded without UI auth!");
        } catch (error) {
            if (!error.data.flows) {
                console.log("uploadDeviceSigningKeys advertised no flows!");
            }
            const canUploadKeysWithPasswordOnly = error.data.flows.some(f => {
                return f.stages.length === 1 && f.stages[0] === 'm.login.password';
            });
            this.setState({
                canUploadKeysWithPasswordOnly,
            });
        }
    }

    _onKeyBackupStatusChange = () => {
        if (this.state.phase === PHASE_MIGRATE) this._fetchBackupInfo();
    }

    _collectRecoveryKeyNode = (n) => {
        this._recoveryKeyNode = n;
    }

    _onUseKeyBackupChange = (enabled) => {
        this.setState({
            useKeyBackup: enabled,
        });
    }

    _onMigrateFormSubmit = (e) => {
        e.preventDefault();
        if (this.state.backupSigStatus.usable) {
            this._bootstrapSecretStorage();
        } else {
            this._restoreBackup();
        }
    }

    _onCopyClick = () => {
        selectText(this._recoveryKeyNode);
        const successful = document.execCommand('copy');
        if (successful) {
            this.setState({
                copied: true,
                phase: PHASE_KEEPITSAFE,
            });
        }
    }

    _onDownloadClick = () => {
        const blob = new Blob([this._encodedRecoveryKey], {
            type: 'text/plain;charset=us-ascii',
        });
        FileSaver.saveAs(blob, 'recovery-key.txt');

        this.setState({
            downloaded: true,
            phase: PHASE_KEEPITSAFE,
        });
    }

    _doBootstrapUIAuth = async (makeRequest) => {
        if (this.state.canUploadKeysWithPasswordOnly && this.state.accountPassword) {
            await makeRequest({
                type: 'm.login.password',
                identifier: {
                    type: 'm.id.user',
                    user: MatrixClientPeg.get().getUserId(),
                },
                // https://github.com/matrix-org/synapse/issues/5665
                user: MatrixClientPeg.get().getUserId(),
                password: this.state.accountPassword,
            });
        } else {
            const InteractiveAuthDialog = sdk.getComponent("dialogs.InteractiveAuthDialog");
            const { finished } = Modal.createTrackedDialog(
                'Cross-signing keys dialog', '', InteractiveAuthDialog,
                {
                    title: _t("Setting up keys"),
                    matrixClient: MatrixClientPeg.get(),
                    makeRequest,
                },
            );
            const [confirmed] = await finished;
            if (!confirmed) {
                throw new Error("Cross-signing key upload auth canceled");
            }
        }
    }

    _bootstrapSecretStorage = async () => {
        this.setState({
            phase: PHASE_STORING,
            error: null,
        });

        const cli = MatrixClientPeg.get();

        const { force } = this.props;

        try {
            if (force) {
                await cli.bootstrapSecretStorage({
                    authUploadDeviceSigningKeys: this._doBootstrapUIAuth,
                    createSecretStorageKey: async () => this._keyInfo,
                    setupNewKeyBackup: true,
                    setupNewSecretStorage: true,
                });
            } else {
                await cli.bootstrapSecretStorage({
                    authUploadDeviceSigningKeys: this._doBootstrapUIAuth,
                    createSecretStorageKey: async () => this._keyInfo,
                    keyBackupInfo: this.state.backupInfo,
                    setupNewKeyBackup: !this.state.backupInfo && this.state.useKeyBackup,
                    getKeyBackupPassphrase: promptForBackupPassphrase,
                });
            }
            this.setState({
                phase: PHASE_DONE,
            });
        } catch (e) {
            if (this.state.canUploadKeysWithPasswordOnly && e.httpStatus === 401 && e.data.flows) {
                this.setState({
                    accountPassword: '',
                    accountPasswordCorrect: false,
                    phase: PHASE_MIGRATE,
                });
            } else {
                this.setState({ error: e });
            }
            console.error("Error bootstrapping secret storage", e);
        }
    }

    _onCancel = () => {
        this.props.onFinished(false);
    }

    _onDone = () => {
        this.props.onFinished(true);
    }

    _restoreBackup = async () => {
        const RestoreKeyBackupDialog = sdk.getComponent('dialogs.keybackup.RestoreKeyBackupDialog');
        const { finished } = Modal.createTrackedDialog(
            'Restore Backup', '', RestoreKeyBackupDialog, {showSummary: false}, null,
            /* priority = */ false, /* static = */ false,
        );

        await finished;
        const { backupSigStatus } = await this._fetchBackupInfo();
        if (
            backupSigStatus.usable &&
            this.state.canUploadKeysWithPasswordOnly &&
            this.state.accountPassword
        ) {
            this._bootstrapSecretStorage();
        }
    }

    _onSkipSetupClick = () => {
        this.setState({phase: PHASE_CONFIRM_SKIP});
    }

    _onSetUpClick = () => {
        this.setState({phase: PHASE_PASSPHRASE});
    }

    _onSkipPassPhraseClick = async () => {
        const [keyInfo, encodedRecoveryKey] =
            await MatrixClientPeg.get().createRecoveryKeyFromPassphrase();
        this._keyInfo = keyInfo;
        this._encodedRecoveryKey = encodedRecoveryKey;
        this.setState({
            copied: false,
            downloaded: false,
            phase: PHASE_SHOWKEY,
        });
    }

    _onPassPhraseNextClick = async (e) => {
        e.preventDefault();

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
            this.setState({phase: PHASE_PASSPHRASE_CONFIRM});
        }
    };

    _onPassPhraseConfirmNextClick = async (e) => {
        e.preventDefault();

        if (this.state.passPhrase !== this.state.passPhraseConfirm) return;

        const [keyInfo, encodedRecoveryKey] =
            await MatrixClientPeg.get().createRecoveryKeyFromPassphrase(this.state.passPhrase);
        this._keyInfo = keyInfo;
        this._encodedRecoveryKey = encodedRecoveryKey;
        this.setState({
            copied: false,
            downloaded: false,
            phase: PHASE_SHOWKEY,
        });
    }

    _onSetAgainClick = () => {
        this.setState({
            passPhrase: '',
            passPhraseConfirm: '',
            phase: PHASE_PASSPHRASE,
            zxcvbnResult: null,
        });
    }

    _onKeepItSafeBackClick = () => {
        this.setState({
            phase: PHASE_SHOWKEY,
        });
    }

    _onPassPhraseChange = (e) => {
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
    }

    _onPassPhraseConfirmChange = (e) => {
        this.setState({
            passPhraseConfirm: e.target.value,
        });
    }

    _passPhraseIsValid() {
        return this.state.zxcvbnResult && this.state.zxcvbnResult.score >= PASSWORD_MIN_SCORE;
    }

    _onAccountPasswordChange = (e) => {
        this.setState({
            accountPassword: e.target.value,
        });
    }

    _renderPhaseMigrate() {
        // TODO: This is a temporary screen so people who have the labs flag turned on and
        // click the button are aware they're making a change to their account.
        // Once we're confident enough in this (and it's supported enough) we can do
        // it automatically.
        // https://github.com/vector-im/riot-web/issues/11696
        const DialogButtons = sdk.getComponent('views.elements.DialogButtons');
        const Field = sdk.getComponent('views.elements.Field');

        let authPrompt;
        let nextCaption = _t("Next");
        if (this.state.canUploadKeysWithPasswordOnly) {
            authPrompt = <div>
                <div>{_t("Enter your account password to confirm the upgrade:")}</div>
                <div><Field
                    type="password"
                    id="mx_CreateSecretStorage_accountPassword"
                    label={_t("Password")}
                    value={this.state.accountPassword}
                    onChange={this._onAccountPasswordChange}
                    flagInvalid={this.state.accountPasswordCorrect === false}
                    autoFocus={true}
                /></div>
            </div>;
        } else if (!this.state.backupSigStatus.usable) {
            authPrompt = <div>
                <div>{_t("Restore your key backup to upgrade your encryption")}</div>
            </div>;
            nextCaption = _t("Restore");
        } else {
            authPrompt = <p>
                {_t("You'll need to authenticate with the server to confirm the upgrade.")}
            </p>;
        }

        return <form onSubmit={this._onMigrateFormSubmit}>
            <p>{_t(
                "Upgrade this session to allow it to verify other sessions, " +
                "granting them access to encrypted messages and marking them " +
                "as trusted for other users.",
            )}</p>
            <div>{authPrompt}</div>
            <DialogButtons
                primaryButton={nextCaption}
                onPrimaryButtonClick={this._onMigrateFormSubmit}
                hasCancel={false}
                primaryDisabled={this.state.canUploadKeysWithPasswordOnly && !this.state.accountPassword}
            >
                <button type="button" className="danger" onClick={this._onSkipSetupClick}>
                    {_t('Skip')}
                </button>
            </DialogButtons>
        </form>;
    }

    _renderPhasePassPhrase() {
        const DialogButtons = sdk.getComponent('views.elements.DialogButtons');
        const Field = sdk.getComponent('views.elements.Field');
        const AccessibleButton = sdk.getComponent('elements.AccessibleButton');
        const LabelledToggleSwitch = sdk.getComponent('views.elements.LabelledToggleSwitch');

        let strengthMeter;
        let helpText;
        if (this.state.zxcvbnResult) {
            if (this.state.zxcvbnResult.score >= PASSWORD_MIN_SCORE) {
                helpText = _t("Great! This passphrase looks strong enough.");
            } else {
                // We take the warning from zxcvbn or failing that, the first
                // suggestion. In practice The first is generally the most relevant
                // and it's probably better to present the user with one thing to
                // improve about their password than a whole collection - it can
                // spit out a warning and multiple suggestions which starts getting
                // very information-dense.
                const suggestion = (
                    this.state.zxcvbnResult.feedback.warning ||
                    this.state.zxcvbnResult.feedback.suggestions[0]
                );
                const suggestionBlock = <div>{suggestion || _t("Keep going...")}</div>;

                helpText = <div>
                    {suggestionBlock}
                </div>;
            }
            strengthMeter = <div>
                <progress max={PASSWORD_MIN_SCORE} value={this.state.zxcvbnResult.score} />
            </div>;
        }

        return <form onSubmit={this._onPassPhraseNextClick}>
            <p>{_t(
                "Set up encryption on this session to allow it to verify other sessions, " +
                "granting them access to encrypted messages and marking them as trusted for other users.",
            )}</p>
            <p>{_t(
                "Secure your encryption keys with a passphrase. For maximum security " +
                "this should be different to your account password:",
            )}</p>

            <div className="mx_CreateSecretStorageDialog_passPhraseContainer">
                <Field
                    type="password"
                    id="mx_CreateSecretStorageDialog_passPhraseField"
                    className="mx_CreateSecretStorageDialog_passPhraseField"
                    onChange={this._onPassPhraseChange}
                    value={this.state.passPhrase}
                    label={_t("Enter a passphrase")}
                    autoFocus={true}
                    autoComplete="new-password"
                />
                <div className="mx_CreateSecretStorageDialog_passPhraseHelp">
                    {strengthMeter}
                    {helpText}
                </div>
            </div>

            <LabelledToggleSwitch
                label={ _t("Back up my encryption keys, securing them with the same passphrase")}
                onChange={this._onUseKeyBackupChange} value={this.state.useKeyBackup}
            />

            <DialogButtons
                primaryButton={_t('Continue')}
                onPrimaryButtonClick={this._onPassPhraseNextClick}
                hasCancel={false}
                disabled={!this._passPhraseIsValid()}
            >
                <button type="button"
                    onClick={this._onSkipSetupClick}
                    className="danger"
                >{_t("Skip")}</button>
            </DialogButtons>

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
        const Field = sdk.getComponent('views.elements.Field');

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
            passPhraseMatch = <div>
                <div>{matchText}</div>
                <div>
                    <AccessibleButton element="span" className="mx_linkButton" onClick={this._onSetAgainClick}>
                        {_t("Go back to set it again.")}
                    </AccessibleButton>
                </div>
            </div>;
        }
        const DialogButtons = sdk.getComponent('views.elements.DialogButtons');
        return <form onSubmit={this._onPassPhraseConfirmNextClick}>
            <p>{_t(
                "Enter your passphrase a second time to confirm it.",
            )}</p>
            <div className="mx_CreateSecretStorageDialog_passPhraseContainer">
                <Field
                    type="password"
                    id="mx_CreateSecretStorageDialog_passPhraseField"
                    onChange={this._onPassPhraseConfirmChange}
                    value={this.state.passPhraseConfirm}
                    className="mx_CreateSecretStorageDialog_passPhraseField"
                    label={_t("Confirm your passphrase")}
                    autoFocus={true}
                    autoComplete="new-password"
                />
                <div className="mx_CreateSecretStorageDialog_passPhraseMatch">
                    {passPhraseMatch}
                </div>
            </div>
            <DialogButtons
                primaryButton={_t('Continue')}
                onPrimaryButtonClick={this._onPassPhraseConfirmNextClick}
                hasCancel={false}
                disabled={this.state.passPhrase !== this.state.passPhraseConfirm}
            >
                <button type="button"
                    onClick={this._onSkipSetupClick}
                    className="danger"
                >{_t("Skip")}</button>
            </DialogButtons>
        </form>;
    }

    _renderPhaseShowKey() {
        const AccessibleButton = sdk.getComponent('elements.AccessibleButton');
        return <div>
            <p>{_t(
                "Your recovery key is a safety net - you can use it to restore " +
                "access to your encrypted messages if you forget your passphrase.",
            )}</p>
            <p>{_t(
                "Keep a copy of it somewhere secure, like a password manager or even a safe.",
            )}</p>
            <div className="mx_CreateSecretStorageDialog_primaryContainer">
                <div className="mx_CreateSecretStorageDialog_recoveryKeyHeader">
                    {_t("Your recovery key")}
                </div>
                <div className="mx_CreateSecretStorageDialog_recoveryKeyContainer">
                    <div className="mx_CreateSecretStorageDialog_recoveryKey">
                        <code ref={this._collectRecoveryKeyNode}>{this._encodedRecoveryKey}</code>
                    </div>
                    <div className="mx_CreateSecretStorageDialog_recoveryKeyButtons">
                        <AccessibleButton kind='primary' className="mx_Dialog_primary" onClick={this._onCopyClick}>
                            {_t("Copy")}
                        </AccessibleButton>
                        <AccessibleButton kind='primary' className="mx_Dialog_primary" onClick={this._onDownloadClick}>
                            {_t("Download")}
                        </AccessibleButton>
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
                onPrimaryButtonClick={this._bootstrapSecretStorage}
                hasCancel={false}>
                <button onClick={this._onKeepItSafeBackClick}>{_t("Back")}</button>
            </DialogButtons>
        </div>;
    }

    _renderBusyPhase() {
        const Spinner = sdk.getComponent('views.elements.Spinner');
        return <div>
            <Spinner />
        </div>;
    }

    _renderPhaseDone() {
        const DialogButtons = sdk.getComponent('views.elements.DialogButtons');
        return <div>
            <p>{_t(
                "You can now verify your other devices, " +
                "and other users to keep your chats safe.",
            )}</p>
            <DialogButtons primaryButton={_t('OK')}
                onPrimaryButtonClick={this._onDone}
                hasCancel={false}
            />
        </div>;
    }

    _renderPhaseSkipConfirm() {
        const DialogButtons = sdk.getComponent('views.elements.DialogButtons');
        return <div>
            {_t(
                "Without completing security on this session, it won’t have " +
                "access to encrypted messages.",
        )}
            <DialogButtons primaryButton={_t('Go back')}
                onPrimaryButtonClick={this._onSetUpClick}
                hasCancel={false}
            >
                <button type="button" className="danger" onClick={this._onCancel}>{_t('Skip')}</button>
            </DialogButtons>
        </div>;
    }

    _titleForPhase(phase) {
        switch (phase) {
            case PHASE_MIGRATE:
                return _t('Upgrade your encryption');
            case PHASE_PASSPHRASE:
                return _t('Set up encryption');
            case PHASE_PASSPHRASE_CONFIRM:
                return _t('Confirm passphrase');
            case PHASE_CONFIRM_SKIP:
                return _t('Are you sure?');
            case PHASE_SHOWKEY:
            case PHASE_KEEPITSAFE:
                return _t('Make a copy of your recovery key');
            case PHASE_STORING:
                return _t('Setting up keys');
            case PHASE_DONE:
                return _t("You're done!");
            default:
                return '';
        }
    }

    render() {
        const BaseDialog = sdk.getComponent('views.dialogs.BaseDialog');

        let content;
        if (this.state.error) {
            const DialogButtons = sdk.getComponent('views.elements.DialogButtons');
            content = <div>
                <p>{_t("Unable to set up secret storage")}</p>
                <div className="mx_Dialog_buttons">
                    <DialogButtons primaryButton={_t('Retry')}
                        onPrimaryButtonClick={this._bootstrapSecretStorage}
                        hasCancel={true}
                        onCancel={this._onCancel}
                    />
                </div>
            </div>;
        } else {
            switch (this.state.phase) {
                case PHASE_LOADING:
                    content = this._renderBusyPhase();
                    break;
                case PHASE_MIGRATE:
                    content = this._renderPhaseMigrate();
                    break;
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
                case PHASE_STORING:
                    content = this._renderBusyPhase();
                    break;
                case PHASE_DONE:
                    content = this._renderPhaseDone();
                    break;
                case PHASE_CONFIRM_SKIP:
                    content = this._renderPhaseSkipConfirm();
                    break;
            }
        }

        let headerImage;
        if (this._titleForPhase(this.state.phase)) {
            headerImage = require("../../../../../res/img/e2e/normal.svg");
        }

        return (
            <BaseDialog className='mx_CreateSecretStorageDialog'
                onFinished={this.props.onFinished}
                title={this._titleForPhase(this.state.phase)}
                headerImage={headerImage}
                hasCancel={this.props.hasCancel && [PHASE_PASSPHRASE].includes(this.state.phase)}
                fixedWidth={false}
            >
            <div>
                {content}
            </div>
            </BaseDialog>
        );
    }
}

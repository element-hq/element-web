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
import PropTypes from 'prop-types';
import * as sdk from '../../../../index';
import {MatrixClientPeg} from '../../../../MatrixClientPeg';
import FileSaver from 'file-saver';
import {_t, _td} from '../../../../languageHandler';
import Modal from '../../../../Modal';
import { promptForBackupPassphrase } from '../../../../CrossSigningManager';
import {copyNode} from "../../../../utils/strings";
import {SSOAuthEntry} from "../../../../components/views/auth/InteractiveAuthEntryComponents";
import PassphraseField from "../../../../components/views/auth/PassphraseField";
import StyledRadioButton from '../../../../components/views/elements/StyledRadioButton';
import AccessibleButton from "../../../../components/views/elements/AccessibleButton";
import DialogButtons from "../../../../components/views/elements/DialogButtons";
import InlineSpinner from "../../../../components/views/elements/InlineSpinner";

const PHASE_LOADING = 0;
const PHASE_LOADERROR = 1;
const PHASE_CHOOSE_KEY_PASSPHRASE = 2;
const PHASE_MIGRATE = 3;
const PHASE_PASSPHRASE = 4;
const PHASE_PASSPHRASE_CONFIRM = 5;
const PHASE_SHOWKEY = 6;
const PHASE_STORING = 8;
const PHASE_CONFIRM_SKIP = 10;

const PASSWORD_MIN_SCORE = 4; // So secure, many characters, much complex, wow, etc, etc.

// these end up as strings from being values in the radio buttons, so just use strings
const CREATE_STORAGE_OPTION_KEY = 'key';
const CREATE_STORAGE_OPTION_PASSPHRASE = 'passphrase';

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

        this._recoveryKey = null;
        this._recoveryKeyNode = null;
        this._backupKey = null;

        this.state = {
            phase: PHASE_LOADING,
            passPhrase: '',
            passPhraseValid: false,
            passPhraseConfirm: '',
            copied: false,
            downloaded: false,
            setPassphrase: false,
            backupInfo: null,
            backupSigStatus: null,
            // does the server offer a UI auth flow with just m.login.password
            // for /keys/device_signing/upload?
            canUploadKeysWithPasswordOnly: null,
            accountPassword: props.accountPassword || "",
            accountPasswordCorrect: null,

            passPhraseKeySelected: CREATE_STORAGE_OPTION_KEY,
        };

        this._passphraseField = createRef();

        this._fetchBackupInfo();
        if (this.state.accountPassword) {
            // If we have an account password in memory, let's simplify and
            // assume it means password auth is also supported for device
            // signing key upload as well. This avoids hitting the server to
            // test auth flows, which may be slow under high load.
            this.state.canUploadKeysWithPasswordOnly = true;
        } else {
            this._queryKeyUploadAuth();
        }

        MatrixClientPeg.get().on('crypto.keyBackupStatus', this._onKeyBackupStatusChange);
    }

    componentWillUnmount() {
        MatrixClientPeg.get().removeListener('crypto.keyBackupStatus', this._onKeyBackupStatusChange);
    }

    async _fetchBackupInfo() {
        try {
            const backupInfo = await MatrixClientPeg.get().getKeyBackupVersion();
            const backupSigStatus = (
                // we may not have started crypto yet, in which case we definitely don't trust the backup
                MatrixClientPeg.get().isCryptoEnabled() && await MatrixClientPeg.get().isKeyBackupTrusted(backupInfo)
            );

            const { force } = this.props;
            const phase = (backupInfo && !force) ? PHASE_MIGRATE : PHASE_CHOOSE_KEY_PASSPHRASE;

            this.setState({
                phase,
                backupInfo,
                backupSigStatus,
            });

            return {
                backupInfo,
                backupSigStatus,
            };
        } catch (e) {
            this.setState({phase: PHASE_LOADERROR});
        }
    }

    async _queryKeyUploadAuth() {
        try {
            await MatrixClientPeg.get().uploadDeviceSigningKeys(null, {});
            // We should never get here: the server should always require
            // UI auth to upload device signing keys. If we do, we upload
            // no keys which would be a no-op.
            console.log("uploadDeviceSigningKeys unexpectedly succeeded without UI auth!");
        } catch (error) {
            if (!error.data || !error.data.flows) {
                console.log("uploadDeviceSigningKeys advertised no flows!");
                return;
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

    _onKeyPassphraseChange = e => {
        this.setState({
            passPhraseKeySelected: e.target.value,
        });
    }

    _collectRecoveryKeyNode = (n) => {
        this._recoveryKeyNode = n;
    }

    _onChooseKeyPassphraseFormSubmit = async () => {
        if (this.state.passPhraseKeySelected === CREATE_STORAGE_OPTION_KEY) {
            this._recoveryKey =
                await MatrixClientPeg.get().createRecoveryKeyFromPassphrase();
            this.setState({
                copied: false,
                downloaded: false,
                setPassphrase: false,
                phase: PHASE_SHOWKEY,
            });
        } else {
            this.setState({
                copied: false,
                downloaded: false,
                phase: PHASE_PASSPHRASE,
            });
        }
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
        const successful = copyNode(this._recoveryKeyNode);
        if (successful) {
            this.setState({
                copied: true,
            });
        }
    }

    _onDownloadClick = () => {
        const blob = new Blob([this._recoveryKey.encodedPrivateKey], {
            type: 'text/plain;charset=us-ascii',
        });
        FileSaver.saveAs(blob, 'recovery-key.txt');

        this.setState({
            downloaded: true,
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
                // TODO: Remove `user` once servers support proper UIA
                // See https://github.com/matrix-org/synapse/issues/5665
                user: MatrixClientPeg.get().getUserId(),
                password: this.state.accountPassword,
            });
        } else {
            const InteractiveAuthDialog = sdk.getComponent("dialogs.InteractiveAuthDialog");

            const dialogAesthetics = {
                [SSOAuthEntry.PHASE_PREAUTH]: {
                    title: _t("Use Single Sign On to continue"),
                    body: _t("To continue, use Single Sign On to prove your identity."),
                    continueText: _t("Single Sign On"),
                    continueKind: "primary",
                },
                [SSOAuthEntry.PHASE_POSTAUTH]: {
                    title: _t("Confirm encryption setup"),
                    body: _t("Click the button below to confirm setting up encryption."),
                    continueText: _t("Confirm"),
                    continueKind: "primary",
                },
            };

            const { finished } = Modal.createTrackedDialog(
                'Cross-signing keys dialog', '', InteractiveAuthDialog,
                {
                    title: _t("Setting up keys"),
                    matrixClient: MatrixClientPeg.get(),
                    makeRequest,
                    aestheticsForStagePhases: {
                        [SSOAuthEntry.LOGIN_TYPE]: dialogAesthetics,
                        [SSOAuthEntry.UNSTABLE_LOGIN_TYPE]: dialogAesthetics,
                    },
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
                console.log("Forcing secret storage reset"); // log something so we can debug this later
                await cli.bootstrapSecretStorage({
                    authUploadDeviceSigningKeys: this._doBootstrapUIAuth,
                    createSecretStorageKey: async () => this._recoveryKey,
                    setupNewKeyBackup: true,
                    setupNewSecretStorage: true,
                });
            } else {
                await cli.bootstrapSecretStorage({
                    authUploadDeviceSigningKeys: this._doBootstrapUIAuth,
                    createSecretStorageKey: async () => this._recoveryKey,
                    keyBackupInfo: this.state.backupInfo,
                    setupNewKeyBackup: !this.state.backupInfo,
                    getKeyBackupPassphrase: () => {
                        // We may already have the backup key if we earlier went
                        // through the restore backup path, so pass it along
                        // rather than prompting again.
                        if (this._backupKey) {
                            return this._backupKey;
                        }
                        return promptForBackupPassphrase();
                    },
                });
            }
            this.props.onFinished(true);
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
        // It's possible we'll need the backup key later on for bootstrapping,
        // so let's stash it here, rather than prompting for it twice.
        const keyCallback = k => this._backupKey = k;

        const RestoreKeyBackupDialog = sdk.getComponent('dialogs.keybackup.RestoreKeyBackupDialog');
        const { finished } = Modal.createTrackedDialog(
            'Restore Backup', '', RestoreKeyBackupDialog,
            {
                showSummary: false,
                keyCallback,
            },
            null, /* priority = */ false, /* static = */ false,
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

    _onLoadRetryClick = () => {
        this.setState({phase: PHASE_LOADING});
        this._fetchBackupInfo();
    }

    _onShowKeyContinueClick = () => {
        this._bootstrapSecretStorage();
    }

    _onCancelClick = () => {
        this.setState({phase: PHASE_CONFIRM_SKIP});
    }

    _onGoBackClick = () => {
        this.setState({phase: PHASE_CHOOSE_KEY_PASSPHRASE});
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

        this._recoveryKey =
            await MatrixClientPeg.get().createRecoveryKeyFromPassphrase(this.state.passPhrase);
        this.setState({
            copied: false,
            downloaded: false,
            setPassphrase: true,
            phase: PHASE_SHOWKEY,
        });
    }

    _onSetAgainClick = () => {
        this.setState({
            passPhrase: '',
            passPhraseValid: false,
            passPhraseConfirm: '',
            phase: PHASE_PASSPHRASE,
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

    _onAccountPasswordChange = (e) => {
        this.setState({
            accountPassword: e.target.value,
        });
    }

    _renderPhaseChooseKeyPassphrase() {
        return <form onSubmit={this._onChooseKeyPassphraseFormSubmit}>
            <p className="mx_CreateSecretStorageDialog_centeredBody">{_t(
                "Safeguard against losing access to encrypted messages & data by " +
                "backing up encryption keys on your server.",
            )}</p>
            <div className="mx_CreateSecretStorageDialog_primaryContainer" role="radiogroup" onChange={this._onKeyPassphraseChange}>
                <StyledRadioButton
                    key={CREATE_STORAGE_OPTION_KEY}
                    value={CREATE_STORAGE_OPTION_KEY}
                    name="keyPassphrase"
                    checked={this.state.passPhraseKeySelected === CREATE_STORAGE_OPTION_KEY}
                    outlined
                >
                    <div className="mx_CreateSecretStorageDialog_optionTitle">
                        <span className="mx_CreateSecretStorageDialog_optionIcon mx_CreateSecretStorageDialog_optionIcon_secureBackup"></span>
                        {_t("Generate a Security Key")}
                    </div>
                    <div>{_t("We’ll generate a Security Key for you to store somewhere safe, like a password manager or a safe.")}</div>
                </StyledRadioButton>
                <StyledRadioButton
                    key={CREATE_STORAGE_OPTION_PASSPHRASE}
                    value={CREATE_STORAGE_OPTION_PASSPHRASE}
                    name="keyPassphrase"
                    checked={this.state.passPhraseKeySelected === CREATE_STORAGE_OPTION_PASSPHRASE}
                    outlined
                >
                    <div className="mx_CreateSecretStorageDialog_optionTitle">
                        <span className="mx_CreateSecretStorageDialog_optionIcon mx_CreateSecretStorageDialog_optionIcon_securePhrase"></span>
                        {_t("Enter a Security Phrase")}
                    </div>
                    <div>{_t("Use a secret phrase only you know, and optionally save a Security Key to use for backup.")}</div>
                </StyledRadioButton>
            </div>
            <DialogButtons
                primaryButton={_t("Continue")}
                onPrimaryButtonClick={this._onChooseKeyPassphraseFormSubmit}
                onCancel={this._onCancelClick}
                hasCancel={true}
            />
        </form>;
    }

    _renderPhaseMigrate() {
        // TODO: This is a temporary screen so people who have the labs flag turned on and
        // click the button are aware they're making a change to their account.
        // Once we're confident enough in this (and it's supported enough) we can do
        // it automatically.
        // https://github.com/vector-im/riot-web/issues/11696
        const Field = sdk.getComponent('views.elements.Field');

        let authPrompt;
        let nextCaption = _t("Next");
        if (this.state.canUploadKeysWithPasswordOnly) {
            authPrompt = <div>
                <div>{_t("Enter your account password to confirm the upgrade:")}</div>
                <div><Field
                    type="password"
                    label={_t("Password")}
                    value={this.state.accountPassword}
                    onChange={this._onAccountPasswordChange}
                    forceValidity={this.state.accountPasswordCorrect === false ? false : null}
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
                <button type="button" className="danger" onClick={this._onCancelClick}>
                    {_t('Skip')}
                </button>
            </DialogButtons>
        </form>;
    }

    _renderPhasePassPhrase() {
        return <form onSubmit={this._onPassPhraseNextClick}>
            <p>{_t(
                "Enter a security phrase only you know, as it’s used to safeguard your data. " +
                "To be secure, you shouldn’t re-use your account password.",
            )}</p>

            <div className="mx_CreateSecretStorageDialog_passPhraseContainer">
                <PassphraseField
                    className="mx_CreateSecretStorageDialog_passPhraseField"
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

            <DialogButtons
                primaryButton={_t('Continue')}
                onPrimaryButtonClick={this._onPassPhraseNextClick}
                hasCancel={false}
                disabled={!this.state.passPhraseValid}
            >
                <button type="button"
                    onClick={this._onCancelClick}
                    className="danger"
                >{_t("Cancel")}</button>
            </DialogButtons>
        </form>;
    }

    _renderPhasePassPhraseConfirm() {
        const Field = sdk.getComponent('views.elements.Field');

        let matchText;
        let changeText;
        if (this.state.passPhraseConfirm === this.state.passPhrase) {
            matchText = _t("That matches!");
            changeText = _t("Use a different passphrase?");
        } else if (!this.state.passPhrase.startsWith(this.state.passPhraseConfirm)) {
            // only tell them they're wrong if they've actually gone wrong.
            // Security concious readers will note that if you left riot-web unattended
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
            passPhraseMatch = <div>
                <div>{matchText}</div>
                <div>
                    <AccessibleButton element="span" className="mx_linkButton" onClick={this._onSetAgainClick}>
                        {changeText}
                    </AccessibleButton>
                </div>
            </div>;
        }
        return <form onSubmit={this._onPassPhraseConfirmNextClick}>
            <p>{_t(
                "Enter your recovery passphrase a second time to confirm it.",
            )}</p>
            <div className="mx_CreateSecretStorageDialog_passPhraseContainer">
                <Field
                    type="password"
                    onChange={this._onPassPhraseConfirmChange}
                    value={this.state.passPhraseConfirm}
                    className="mx_CreateSecretStorageDialog_passPhraseField"
                    label={_t("Confirm your recovery passphrase")}
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
                    onClick={this._onCancelClick}
                    className="danger"
                >{_t("Skip")}</button>
            </DialogButtons>
        </form>;
    }

    _renderPhaseShowKey() {
        let continueButton;
        if (this.state.phase === PHASE_SHOWKEY) {
            continueButton = <DialogButtons primaryButton={_t("Continue")}
                disabled={!this.state.downloaded && !this.state.copied && !this.state.setPassphrase}
                onPrimaryButtonClick={this._onShowKeyContinueClick}
                hasCancel={false}
            />;
        } else {
            continueButton = <div className="mx_CreateSecretStorageDialog_continueSpinner">
                <InlineSpinner />
            </div>;
        }
        return <div>
            <p>{_t(
                "Store your Security Key somewhere safe, like a password manager or a safe, " +
                "as it’s used to safeguard your encrypted data.",
            )}</p>
            <div className="mx_CreateSecretStorageDialog_primaryContainer">
                <div className="mx_CreateSecretStorageDialog_recoveryKeyContainer">
                    <div className="mx_CreateSecretStorageDialog_recoveryKey">
                        <code ref={this._collectRecoveryKeyNode}>{this._recoveryKey.encodedPrivateKey}</code>
                    </div>
                    <div className="mx_CreateSecretStorageDialog_recoveryKeyButtons">
                        <AccessibleButton kind='primary' className="mx_Dialog_primary"
                            onClick={this._onDownloadClick}
                            disabled={this.state.phase === PHASE_STORING}
                        >
                            {_t("Download")}
                        </AccessibleButton>
                        <span>{_t("or")}</span>
                        <AccessibleButton
                            kind='primary'
                            className="mx_Dialog_primary mx_CreateSecretStorageDialog_recoveryKeyButtons_copyBtn"
                            onClick={this._onCopyClick}
                            disabled={this.state.phase === PHASE_STORING}
                        >
                            {this.state.copied ? _t("Copied!") : _t("Copy")}
                        </AccessibleButton>
                    </div>
                </div>
            </div>
            {continueButton}
        </div>;
    }

    _renderBusyPhase() {
        const Spinner = sdk.getComponent('views.elements.Spinner');
        return <div>
            <Spinner />
        </div>;
    }

    _renderPhaseLoadError() {
        return <div>
            <p>{_t("Unable to query secret storage status")}</p>
            <div className="mx_Dialog_buttons">
                <DialogButtons primaryButton={_t('Retry')}
                    onPrimaryButtonClick={this._onLoadRetryClick}
                    hasCancel={true}
                    onCancel={this._onCancel}
                />
            </div>
        </div>;
    }

    _renderPhaseSkipConfirm() {
        return <div>
            <p>{_t(
                "If you cancel now, you may lose encrypted messages & data if you lose access to your logins.",
            )}</p>
            <p>{_t(
                "You can also set up Secure Backup & manage your keys in Settings.",
            )}</p>
            <DialogButtons primaryButton={_t('Go back')}
                onPrimaryButtonClick={this._onGoBackClick}
                hasCancel={false}
            >
                <button type="button" className="danger" onClick={this._onCancel}>{_t('Cancel')}</button>
            </DialogButtons>
        </div>;
    }

    _titleForPhase(phase) {
        switch (phase) {
            case PHASE_CHOOSE_KEY_PASSPHRASE:
                return _t('Set up Secure backup');
            case PHASE_MIGRATE:
                return _t('Upgrade your encryption');
            case PHASE_PASSPHRASE:
                return _t('Set a Security Phrase');
            case PHASE_PASSPHRASE_CONFIRM:
                return _t('Confirm Security Phrase');
            case PHASE_CONFIRM_SKIP:
                return _t('Are you sure?');
            case PHASE_SHOWKEY:
                return _t('Save your Security Key');
            case PHASE_STORING:
                return _t('Setting up keys');
            default:
                return '';
        }
    }

    render() {
        const BaseDialog = sdk.getComponent('views.dialogs.BaseDialog');

        let content;
        if (this.state.error) {
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
                case PHASE_LOADERROR:
                    content = this._renderPhaseLoadError();
                    break;
                case PHASE_CHOOSE_KEY_PASSPHRASE:
                    content = this._renderPhaseChooseKeyPassphrase();
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
                case PHASE_STORING:
                    content = this._renderBusyPhase();
                    break;
                case PHASE_CONFIRM_SKIP:
                    content = this._renderPhaseSkipConfirm();
                    break;
            }
        }

        let titleClass = null;
        switch (this.state.phase) {
            case PHASE_PASSPHRASE:
            case PHASE_PASSPHRASE_CONFIRM:
                titleClass = [
                    'mx_CreateSecretStorageDialog_titleWithIcon',
                    'mx_CreateSecretStorageDialog_securePhraseTitle',
                ];
                break;
            case PHASE_SHOWKEY:
                titleClass = [
                    'mx_CreateSecretStorageDialog_titleWithIcon',
                    'mx_CreateSecretStorageDialog_secureBackupTitle',
                ];
                break;
            case PHASE_CHOOSE_KEY_PASSPHRASE:
                titleClass = 'mx_CreateSecretStorageDialog_centeredTitle';
                break;
        }

        return (
            <BaseDialog className='mx_CreateSecretStorageDialog'
                onFinished={this.props.onFinished}
                title={this._titleForPhase(this.state.phase)}
                titleClass={titleClass}
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

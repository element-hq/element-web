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
import {_t} from '../../../../languageHandler';
import Modal from '../../../../Modal';
import { promptForBackupPassphrase } from '../../../../CrossSigningManager';
import {copyNode} from "../../../../utils/strings";
import {SSOAuthEntry} from "../../../../components/views/auth/InteractiveAuthEntryComponents";
import AccessibleButton from "../../../../components/views/elements/AccessibleButton";
import DialogButtons from "../../../../components/views/elements/DialogButtons";
import InlineSpinner from "../../../../components/views/elements/InlineSpinner";


const PHASE_LOADING = 0;
const PHASE_LOADERROR = 1;
const PHASE_MIGRATE = 2;
const PHASE_INTRO = 3;
const PHASE_SHOWKEY = 4;
const PHASE_STORING = 5;
const PHASE_CONFIRM_SKIP = 6;

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
            downloaded: false,
            copied: false,
            backupInfo: null,
            backupInfoFetched: false,
            backupInfoFetchError: null,
            backupSigStatus: null,
            // does the server offer a UI auth flow with just m.login.password
            // for /keys/device_signing/upload? (If we have an account password, we
            // assume that it can)
            canUploadKeysWithPasswordOnly: null,
            canUploadKeyCheckInProgress: false,
            accountPassword: props.accountPassword || "",
            accountPasswordCorrect: null,
            // No toggle for this: if we really don't want one, remove it & just hard code true
            useKeyBackup: true,
        };

        if (props.accountPassword) {
            // If we have an account password, we assume we can upload keys with
            // just a password (otherwise leave it as null so we poll to check)
            this.state.canUploadKeysWithPasswordOnly = true;
        }

        this._passphraseField = createRef();

        this.loadData();

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

            this.setState({
                backupInfoFetched: true,
                backupInfo,
                backupSigStatus,
                backupInfoFetchError: null,
            });

            return {
                backupInfo,
                backupSigStatus,
            };
        } catch (e) {
            this.setState({backupInfoFetchError: e});
        }
    }

    async _queryKeyUploadAuth() {
        try {
            this.setState({canUploadKeyCheckInProgress: true});
            await MatrixClientPeg.get().uploadDeviceSigningKeys(null, {});
            // We should never get here: the server should always require
            // UI auth to upload device signing keys. If we do, we upload
            // no keys which would be a no-op.
            console.log("uploadDeviceSigningKeys unexpectedly succeeded without UI auth!");
            this.setState({canUploadKeyCheckInProgress: false});
        } catch (error) {
            if (!error.data || !error.data.flows) {
                console.log("uploadDeviceSigningKeys advertised no flows!");
                this.setState({
                    canUploadKeyCheckInProgress: false,
                });
                return;
            }
            const canUploadKeysWithPasswordOnly = error.data.flows.some(f => {
                return f.stages.length === 1 && f.stages[0] === 'm.login.password';
            });
            this.setState({
                canUploadKeysWithPasswordOnly,
                canUploadKeyCheckInProgress: false,
            });
        }
    }

    async _createRecoveryKey() {
        this._recoveryKey = await MatrixClientPeg.get().createRecoveryKeyFromPassphrase();
        this.setState({
            phase: PHASE_SHOWKEY,
        });
    }

    _onKeyBackupStatusChange = () => {
        if (this.state.phase === PHASE_MIGRATE) this._fetchBackupInfo();
    }

    _collectRecoveryKeyNode = (n) => {
        this._recoveryKeyNode = n;
    }

    _onMigrateFormSubmit = (e) => {
        e.preventDefault();
        if (this.state.backupSigStatus.usable) {
            this._bootstrapSecretStorage();
        } else {
            this._restoreBackup();
        }
    }

    _onIntroContinueClick = () => {
        this._createRecoveryKey();
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
            // we use LOADING here rather than STORING as STORING still shows the 'show key'
            // screen which is not relevant: LOADING is just a generic spinner.
            phase: PHASE_LOADING,
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
                    setupNewKeyBackup: this.state.useKeyBackup,
                    setupNewSecretStorage: true,
                });
                if (!this.state.useKeyBackup && this.state.backupInfo) {
                    // If the user is resetting their cross-signing keys and doesn't want
                    // key backup (but had it enabled before), delete the key backup as it's
                    // no longer valid.
                    console.log("Deleting invalid key backup (secrets have been reset; key backup not requested)");
                    await cli.deleteKeyBackupVersion(this.state.backupInfo.version);
                }
            } else {
                await cli.bootstrapSecretStorage({
                    authUploadDeviceSigningKeys: this._doBootstrapUIAuth,
                    createSecretStorageKey: async () => this._recoveryKey,
                    keyBackupInfo: this.state.backupInfo,
                    setupNewKeyBackup: !this.state.backupInfo && this.state.useKeyBackup,
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

    _onShowKeyContinueClick = () => {
        this._bootstrapSecretStorage();
    }

    _onLoadRetryClick = () => {
        this.loadData();
    }

    async loadData() {
        this.setState({phase: PHASE_LOADING});
        const proms = [];

        if (!this.state.backupInfoFetched) proms.push(this._fetchBackupInfo());
        if (this.state.canUploadKeysWithPasswordOnly === null) proms.push(this._queryKeyUploadAuth());

        await Promise.all(proms);
        if (this.state.canUploadKeysWithPasswordOnly === null || this.state.backupInfoFetchError) {
            this.setState({phase: PHASE_LOADERROR});
        } else if (this.state.backupInfo && !this.props.force) {
            this.setState({phase: PHASE_MIGRATE});
        } else {
            this.setState({phase: PHASE_INTRO});
        }
    }

    _onSkipSetupClick = () => {
        this.setState({phase: PHASE_CONFIRM_SKIP});
    }

    _onGoBackClick = () => {
        if (this.state.backupInfo && !this.props.force) {
            this.setState({phase: PHASE_MIGRATE});
        } else {
            this.setState({phase: PHASE_INTRO});
        }
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
        const Field = sdk.getComponent('views.elements.Field');

        let authPrompt;
        let nextCaption = _t("Next");
        if (!this.state.backupSigStatus.usable) {
            authPrompt = null;
            nextCaption = _t("Upload");
        } else if (this.state.canUploadKeysWithPasswordOnly && !this.props.accountPassword) {
            authPrompt = <div>
                <div>{_t("Enter your account password to confirm the upgrade:")}</div>
                <div><Field
                    type="password"
                    label={_t("Password")}
                    value={this.state.accountPassword}
                    onChange={this._onAccountPasswordChange}
                    flagInvalid={this.state.accountPasswordCorrect === false}
                    autoFocus={true}
                /></div>
            </div>;
        } else {
            authPrompt = <p>
                {_t("You'll need to authenticate with the server to confirm the upgrade.")}
            </p>;
        }

        return <form onSubmit={this._onMigrateFormSubmit}>
            <p>{_t(
                "Upgrade your Recovery Key to store encryption keys & secrets " +
                "with your account data. If you lose access to this login you'll " +
                "need it to unlock your data.",
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

    _renderPhaseShowKey() {
        let continueButton;
        if (this.state.phase === PHASE_SHOWKEY) {
            continueButton = <DialogButtons primaryButton={_t("Continue")}
                disabled={!this.state.downloaded && !this.state.copied}
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
                "Store your Recovery Key somewhere safe, it can be used to unlock your encrypted messages & data.",
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

    _renderPhaseIntro() {
        let cancelButton;
        if (this.props.force) {
            // if this is a forced key reset then aborting will just leave the old keys
            // in place, and is thereforece just 'cancel'
            cancelButton = <button type="button" onClick={this._onCancel}>{_t('Cancel')}</button>;
        } else {
            // if it's setting up from scratch then aborting leaves the user without
            // crypto set up, so they skipping the setup.
            cancelButton = <button type="button"
                className="danger" onClick={this._onSkipSetupClick}
            >{_t('Skip')}</button>;
        }

        return <div>
            <p>{_t(
                "Create a Recovery Key to store encryption keys & secrets with your account data. " +
                "If you lose access to this login you’ll need it to unlock your data.",
            )}</p>
            <div className="mx_Dialog_buttons">
                <DialogButtons primaryButton={_t('Continue')}
                    onPrimaryButtonClick={this._onIntroContinueClick}
                    hasCancel={false}
                >
                    {cancelButton}
                </DialogButtons>
            </div>
        </div>;
    }

    _renderPhaseSkipConfirm() {
        return <div>
            {_t(
                "Without completing security on this session, it won’t have " +
                "access to encrypted messages.",
        )}
            <DialogButtons primaryButton={_t('Go back')}
                onPrimaryButtonClick={this._onGoBackClick}
                hasCancel={false}
            >
                <button type="button" className="danger" onClick={this._onCancel}>{_t('Skip')}</button>
            </DialogButtons>
        </div>;
    }

    _titleForPhase(phase) {
        switch (phase) {
            case PHASE_INTRO:
                return _t('Create a Recovery Key');
            case PHASE_MIGRATE:
                return _t('Upgrade your Recovery Key');
            case PHASE_CONFIRM_SKIP:
                return _t('Are you sure?');
            case PHASE_SHOWKEY:
            case PHASE_STORING:
                return _t('Store your Recovery Key');
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
                case PHASE_INTRO:
                    content = this._renderPhaseIntro();
                    break;
                case PHASE_MIGRATE:
                    content = this._renderPhaseMigrate();
                    break;
                case PHASE_SHOWKEY:
                case PHASE_STORING:
                    content = this._renderPhaseShowKey();
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
                hasCancel={this.props.hasCancel}
                fixedWidth={false}
            >
            <div>
                {content}
            </div>
            </BaseDialog>
        );
    }
}

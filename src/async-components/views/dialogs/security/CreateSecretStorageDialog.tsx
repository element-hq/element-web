/*
Copyright 2018, 2019 New Vector Ltd
Copyright 2019, 2020, 2023 The Matrix.org Foundation C.I.C.

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

import React, { createRef } from "react";
import FileSaver from "file-saver";
import { logger } from "matrix-js-sdk/src/logger";
import { AuthDict, CrossSigningKeys, MatrixError, UIAFlow, UIAResponse } from "matrix-js-sdk/src/matrix";
import { CryptoEvent } from "matrix-js-sdk/src/crypto";
import classNames from "classnames";
import { BackupTrustInfo, GeneratedSecretStorageKey, KeyBackupInfo } from "matrix-js-sdk/src/crypto-api";

import { MatrixClientPeg } from "../../../../MatrixClientPeg";
import { _t, _td } from "../../../../languageHandler";
import Modal from "../../../../Modal";
import { promptForBackupPassphrase } from "../../../../SecurityManager";
import { copyNode } from "../../../../utils/strings";
import { SSOAuthEntry } from "../../../../components/views/auth/InteractiveAuthEntryComponents";
import PassphraseField from "../../../../components/views/auth/PassphraseField";
import StyledRadioButton from "../../../../components/views/elements/StyledRadioButton";
import AccessibleButton from "../../../../components/views/elements/AccessibleButton";
import DialogButtons from "../../../../components/views/elements/DialogButtons";
import InlineSpinner from "../../../../components/views/elements/InlineSpinner";
import RestoreKeyBackupDialog from "../../../../components/views/dialogs/security/RestoreKeyBackupDialog";
import {
    getSecureBackupSetupMethods,
    isSecureBackupRequired,
    SecureBackupSetupMethod,
} from "../../../../utils/WellKnownUtils";
import SecurityCustomisations from "../../../../customisations/Security";
import Field from "../../../../components/views/elements/Field";
import BaseDialog from "../../../../components/views/dialogs/BaseDialog";
import Spinner from "../../../../components/views/elements/Spinner";
import InteractiveAuthDialog from "../../../../components/views/dialogs/InteractiveAuthDialog";
import { IValidationResult } from "../../../../components/views/elements/Validation";
import { Icon as CheckmarkIcon } from "../../../../../res/img/element-icons/check.svg";
import PassphraseConfirmField from "../../../../components/views/auth/PassphraseConfirmField";

// I made a mistake while converting this and it has to be fixed!
enum Phase {
    Loading = "loading",
    LoadError = "load_error",
    ChooseKeyPassphrase = "choose_key_passphrase",
    Migrate = "migrate",
    Passphrase = "passphrase",
    PassphraseConfirm = "passphrase_confirm",
    ShowKey = "show_key",
    Storing = "storing",
    Stored = "stored",
    ConfirmSkip = "confirm_skip",
}

const PASSWORD_MIN_SCORE = 4; // So secure, many characters, much complex, wow, etc, etc.

interface IProps {
    hasCancel?: boolean;
    accountPassword?: string;
    forceReset?: boolean;
    onFinished(ok?: boolean): void;
}

interface IState {
    phase: Phase;
    passPhrase: string;
    passPhraseValid: boolean;
    passPhraseConfirm: string;
    copied: boolean;
    downloaded: boolean;
    setPassphrase: boolean;

    /** Information on the current key backup version, as returned by the server.
     *
     * `null` could mean any of:
     *    * we haven't yet requested the data from the server.
     *    * we were unable to reach the server.
     *    * the server returned key backup version data we didn't understand or was malformed.
     *    * there is actually no backup on the server.
     */
    backupInfo: KeyBackupInfo | null;

    /**
     * Information on whether the backup in `backupInfo` is correctly signed, and whether we have the right key to
     * decrypt it.
     *
     * `undefined` if `backupInfo` is null, or if crypto is not enabled in the client.
     */
    backupTrustInfo: BackupTrustInfo | undefined;

    // does the server offer a UI auth flow with just m.login.password
    // for /keys/device_signing/upload?
    canUploadKeysWithPasswordOnly: boolean | null;
    accountPassword: string;
    accountPasswordCorrect: boolean | null;
    canSkip: boolean;
    passPhraseKeySelected: string;
    error?: boolean;
}

/**
 * Walks the user through the process of creating a 4S passphrase and bootstrapping secret storage.
 *
 * If the user already has a key backup, follows a "migration" flow (aka "Upgrade your encryption") which
 * prompts the user to enter their backup decryption password (a Curve25519 private key, possibly derived
 * from a passphrase), and uses that as the (AES) 4S encryption key.
 */
export default class CreateSecretStorageDialog extends React.PureComponent<IProps, IState> {
    public static defaultProps: Partial<IProps> = {
        hasCancel: true,
        forceReset: false,
    };
    private recoveryKey?: GeneratedSecretStorageKey;
    private backupKey?: Uint8Array;
    private recoveryKeyNode = createRef<HTMLElement>();
    private passphraseField = createRef<Field>();

    public constructor(props: IProps) {
        super(props);

        const cli = MatrixClientPeg.safeGet();

        let passPhraseKeySelected: SecureBackupSetupMethod;
        const setupMethods = getSecureBackupSetupMethods(cli);
        if (setupMethods.includes(SecureBackupSetupMethod.Key)) {
            passPhraseKeySelected = SecureBackupSetupMethod.Key;
        } else {
            passPhraseKeySelected = SecureBackupSetupMethod.Passphrase;
        }

        const accountPassword = props.accountPassword || "";
        let canUploadKeysWithPasswordOnly: boolean | null = null;
        if (accountPassword) {
            // If we have an account password in memory, let's simplify and
            // assume it means password auth is also supported for device
            // signing key upload as well. This avoids hitting the server to
            // test auth flows, which may be slow under high load.
            canUploadKeysWithPasswordOnly = true;
        } else {
            this.queryKeyUploadAuth();
        }

        this.state = {
            phase: Phase.Loading,
            passPhrase: "",
            passPhraseValid: false,
            passPhraseConfirm: "",
            copied: false,
            downloaded: false,
            setPassphrase: false,
            backupInfo: null,
            backupTrustInfo: undefined,
            // does the server offer a UI auth flow with just m.login.password
            // for /keys/device_signing/upload?
            accountPasswordCorrect: null,
            canSkip: !isSecureBackupRequired(cli),
            canUploadKeysWithPasswordOnly,
            passPhraseKeySelected,
            accountPassword,
        };

        cli.on(CryptoEvent.KeyBackupStatus, this.onKeyBackupStatusChange);

        this.getInitialPhase();
    }

    public componentWillUnmount(): void {
        MatrixClientPeg.get()?.removeListener(CryptoEvent.KeyBackupStatus, this.onKeyBackupStatusChange);
    }

    private getInitialPhase(): void {
        const keyFromCustomisations = SecurityCustomisations.createSecretStorageKey?.();
        if (keyFromCustomisations) {
            logger.log("Created key via customisations, jumping to bootstrap step");
            this.recoveryKey = {
                privateKey: keyFromCustomisations,
            };
            this.bootstrapSecretStorage();
            return;
        }

        this.fetchBackupInfo();
    }

    /**
     * Attempt to get information on the current backup from the server, and update the state.
     *
     * Updates {@link IState.backupInfo} and {@link IState.backupTrustInfo}, and picks an appropriate phase for
     * {@link IState.phase}.
     *
     * @returns If the backup data was retrieved successfully, the trust info for the backup. Otherwise, undefined.
     */
    private async fetchBackupInfo(): Promise<BackupTrustInfo | undefined> {
        try {
            const cli = MatrixClientPeg.safeGet();
            const backupInfo = await cli.getKeyBackupVersion();
            const backupTrustInfo =
                // we may not have started crypto yet, in which case we definitely don't trust the backup
                backupInfo ? await cli.getCrypto()?.isKeyBackupTrusted(backupInfo) : undefined;

            const { forceReset } = this.props;
            const phase = backupInfo && !forceReset ? Phase.Migrate : Phase.ChooseKeyPassphrase;

            this.setState({
                phase,
                backupInfo,
                backupTrustInfo,
            });

            return backupTrustInfo;
        } catch (e) {
            console.error("Error fetching backup data from server", e);
            this.setState({ phase: Phase.LoadError });
            return undefined;
        }
    }

    private async queryKeyUploadAuth(): Promise<void> {
        try {
            await MatrixClientPeg.safeGet().uploadDeviceSigningKeys(undefined, {} as CrossSigningKeys);
            // We should never get here: the server should always require
            // UI auth to upload device signing keys. If we do, we upload
            // no keys which would be a no-op.
            logger.log("uploadDeviceSigningKeys unexpectedly succeeded without UI auth!");
        } catch (error) {
            if (!(error instanceof MatrixError) || !error.data || !error.data.flows) {
                logger.log("uploadDeviceSigningKeys advertised no flows!");
                return;
            }
            const canUploadKeysWithPasswordOnly = error.data.flows.some((f: UIAFlow) => {
                return f.stages.length === 1 && f.stages[0] === "m.login.password";
            });
            this.setState({
                canUploadKeysWithPasswordOnly,
            });
        }
    }

    private onKeyBackupStatusChange = (): void => {
        if (this.state.phase === Phase.Migrate) this.fetchBackupInfo();
    };

    private onKeyPassphraseChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
        this.setState({
            passPhraseKeySelected: e.target.value,
        });
    };

    private onChooseKeyPassphraseFormSubmit = async (): Promise<void> => {
        if (this.state.passPhraseKeySelected === SecureBackupSetupMethod.Key) {
            this.recoveryKey = await MatrixClientPeg.safeGet().getCrypto()!.createRecoveryKeyFromPassphrase();
            this.setState({
                copied: false,
                downloaded: false,
                setPassphrase: false,
                phase: Phase.ShowKey,
            });
        } else {
            this.setState({
                copied: false,
                downloaded: false,
                phase: Phase.Passphrase,
            });
        }
    };

    private onMigrateFormSubmit = (e: React.FormEvent): void => {
        e.preventDefault();
        if (this.state.backupTrustInfo?.trusted) {
            this.bootstrapSecretStorage();
        } else {
            this.restoreBackup();
        }
    };

    private onCopyClick = (): void => {
        const successful = copyNode(this.recoveryKeyNode.current);
        if (successful) {
            this.setState({
                copied: true,
            });
        }
    };

    private onDownloadClick = (): void => {
        if (!this.recoveryKey) return;
        const blob = new Blob([this.recoveryKey.encodedPrivateKey!], {
            type: "text/plain;charset=us-ascii",
        });
        FileSaver.saveAs(blob, "security-key.txt");

        this.setState({
            downloaded: true,
        });
    };

    private doBootstrapUIAuth = async (
        makeRequest: (authData: AuthDict) => Promise<UIAResponse<void>>,
    ): Promise<void> => {
        if (this.state.canUploadKeysWithPasswordOnly && this.state.accountPassword) {
            await makeRequest({
                type: "m.login.password",
                identifier: {
                    type: "m.id.user",
                    user: MatrixClientPeg.safeGet().getSafeUserId(),
                },
                // TODO: Remove `user` once servers support proper UIA
                // See https://github.com/matrix-org/synapse/issues/5665
                user: MatrixClientPeg.safeGet().getSafeUserId(),
                password: this.state.accountPassword,
            });
        } else {
            const dialogAesthetics = {
                [SSOAuthEntry.PHASE_PREAUTH]: {
                    title: _t("auth|uia|sso_title"),
                    body: _t("auth|uia|sso_preauth_body"),
                    continueText: _t("auth|sso"),
                    continueKind: "primary",
                },
                [SSOAuthEntry.PHASE_POSTAUTH]: {
                    title: _t("encryption|confirm_encryption_setup_title"),
                    body: _t("encryption|confirm_encryption_setup_body"),
                    continueText: _t("action|confirm"),
                    continueKind: "primary",
                },
            };

            const { finished } = Modal.createDialog(InteractiveAuthDialog, {
                title: _t("encryption|bootstrap_title"),
                matrixClient: MatrixClientPeg.safeGet(),
                makeRequest,
                aestheticsForStagePhases: {
                    [SSOAuthEntry.LOGIN_TYPE]: dialogAesthetics,
                    [SSOAuthEntry.UNSTABLE_LOGIN_TYPE]: dialogAesthetics,
                },
            });
            const [confirmed] = await finished;
            if (!confirmed) {
                throw new Error("Cross-signing key upload auth canceled");
            }
        }
    };

    private bootstrapSecretStorage = async (): Promise<void> => {
        this.setState({
            phase: Phase.Storing,
            error: undefined,
        });

        const cli = MatrixClientPeg.safeGet();
        const crypto = cli.getCrypto()!;

        const { forceReset } = this.props;

        try {
            if (forceReset) {
                logger.log("Forcing secret storage reset");
                await crypto.bootstrapSecretStorage({
                    createSecretStorageKey: async () => this.recoveryKey!,
                    setupNewKeyBackup: true,
                    setupNewSecretStorage: true,
                });
            } else {
                // For password authentication users after 2020-09, this cross-signing
                // step will be a no-op since it is now setup during registration or login
                // when needed. We should keep this here to cover other cases such as:
                //   * Users with existing sessions prior to 2020-09 changes
                //   * SSO authentication users which require interactive auth to upload
                //     keys (and also happen to skip all post-authentication flows at the
                //     moment via token login)
                await crypto.bootstrapCrossSigning({
                    authUploadDeviceSigningKeys: this.doBootstrapUIAuth,
                });
                await crypto.bootstrapSecretStorage({
                    createSecretStorageKey: async () => this.recoveryKey!,
                    keyBackupInfo: this.state.backupInfo!,
                    setupNewKeyBackup: !this.state.backupInfo,
                    getKeyBackupPassphrase: async (): Promise<Uint8Array> => {
                        // We may already have the backup key if we earlier went
                        // through the restore backup path, so pass it along
                        // rather than prompting again.
                        if (this.backupKey) {
                            return this.backupKey;
                        }
                        return promptForBackupPassphrase();
                    },
                });
            }

            this.setState({
                phase: Phase.Stored,
            });
        } catch (e) {
            if (
                this.state.canUploadKeysWithPasswordOnly &&
                e instanceof MatrixError &&
                e.httpStatus === 401 &&
                e.data.flows
            ) {
                this.setState({
                    accountPassword: "",
                    accountPasswordCorrect: false,
                    phase: Phase.Migrate,
                });
            } else {
                this.setState({ error: true });
            }
            logger.error("Error bootstrapping secret storage", e);
        }
    };

    private onCancel = (): void => {
        this.props.onFinished(false);
    };

    private restoreBackup = async (): Promise<void> => {
        // It's possible we'll need the backup key later on for bootstrapping,
        // so let's stash it here, rather than prompting for it twice.
        const keyCallback = (k: Uint8Array): void => {
            this.backupKey = k;
        };

        const { finished } = Modal.createDialog(
            RestoreKeyBackupDialog,
            {
                showSummary: false,
                keyCallback,
            },
            undefined,
            /* priority = */ false,
            /* static = */ false,
        );

        await finished;
        const backupTrustInfo = await this.fetchBackupInfo();
        if (backupTrustInfo?.trusted && this.state.canUploadKeysWithPasswordOnly && this.state.accountPassword) {
            this.bootstrapSecretStorage();
        }
    };

    private onLoadRetryClick = (): void => {
        this.setState({ phase: Phase.Loading });
        this.fetchBackupInfo();
    };

    private onShowKeyContinueClick = (): void => {
        this.bootstrapSecretStorage();
    };

    private onCancelClick = (): void => {
        this.setState({ phase: Phase.ConfirmSkip });
    };

    private onGoBackClick = (): void => {
        this.setState({ phase: Phase.ChooseKeyPassphrase });
    };

    private onPassPhraseNextClick = async (e: React.FormEvent): Promise<void> => {
        e.preventDefault();
        if (!this.passphraseField.current) return; // unmounting

        await this.passphraseField.current.validate({ allowEmpty: false });
        if (!this.passphraseField.current.state.valid) {
            this.passphraseField.current.focus();
            this.passphraseField.current.validate({ allowEmpty: false, focused: true });
            return;
        }

        this.setState({ phase: Phase.PassphraseConfirm });
    };

    private onPassPhraseConfirmNextClick = async (e: React.FormEvent): Promise<void> => {
        e.preventDefault();

        if (this.state.passPhrase !== this.state.passPhraseConfirm) return;

        this.recoveryKey = await MatrixClientPeg.safeGet()
            .getCrypto()!
            .createRecoveryKeyFromPassphrase(this.state.passPhrase);
        this.setState({
            copied: false,
            downloaded: false,
            setPassphrase: true,
            phase: Phase.ShowKey,
        });
    };

    private onSetAgainClick = (): void => {
        this.setState({
            passPhrase: "",
            passPhraseValid: false,
            passPhraseConfirm: "",
            phase: Phase.Passphrase,
        });
    };

    private onPassPhraseValidate = (result: IValidationResult): void => {
        this.setState({
            passPhraseValid: !!result.valid,
        });
    };

    private onPassPhraseChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
        this.setState({
            passPhrase: e.target.value,
        });
    };

    private onPassPhraseConfirmChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
        this.setState({
            passPhraseConfirm: e.target.value,
        });
    };

    private onAccountPasswordChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
        this.setState({
            accountPassword: e.target.value,
        });
    };

    private renderOptionKey(): JSX.Element {
        return (
            <StyledRadioButton
                key={SecureBackupSetupMethod.Key}
                value={SecureBackupSetupMethod.Key}
                name="keyPassphrase"
                checked={this.state.passPhraseKeySelected === SecureBackupSetupMethod.Key}
                onChange={this.onKeyPassphraseChange}
                outlined
            >
                <div className="mx_CreateSecretStorageDialog_optionTitle">
                    <span className="mx_CreateSecretStorageDialog_optionIcon mx_CreateSecretStorageDialog_optionIcon_secureBackup" />
                    {_t("settings|key_backup|setup_secure_backup|generate_security_key_title")}
                </div>
                <div>{_t("settings|key_backup|setup_secure_backup|generate_security_key_description")}</div>
            </StyledRadioButton>
        );
    }

    private renderOptionPassphrase(): JSX.Element {
        return (
            <StyledRadioButton
                key={SecureBackupSetupMethod.Passphrase}
                value={SecureBackupSetupMethod.Passphrase}
                name="keyPassphrase"
                checked={this.state.passPhraseKeySelected === SecureBackupSetupMethod.Passphrase}
                onChange={this.onKeyPassphraseChange}
                outlined
            >
                <div className="mx_CreateSecretStorageDialog_optionTitle">
                    <span className="mx_CreateSecretStorageDialog_optionIcon mx_CreateSecretStorageDialog_optionIcon_securePhrase" />
                    {_t("settings|key_backup|setup_secure_backup|enter_phrase_title")}
                </div>
                <div>{_t("settings|key_backup|setup_secure_backup|use_phrase_only_you_know")}</div>
            </StyledRadioButton>
        );
    }

    private renderPhaseChooseKeyPassphrase(): JSX.Element {
        const setupMethods = getSecureBackupSetupMethods(MatrixClientPeg.safeGet());
        const optionKey = setupMethods.includes(SecureBackupSetupMethod.Key) ? this.renderOptionKey() : null;
        const optionPassphrase = setupMethods.includes(SecureBackupSetupMethod.Passphrase)
            ? this.renderOptionPassphrase()
            : null;

        return (
            <form onSubmit={this.onChooseKeyPassphraseFormSubmit}>
                <p className="mx_CreateSecretStorageDialog_centeredBody">
                    {_t("settings|key_backup|setup_secure_backup|description")}
                </p>
                <div className="mx_CreateSecretStorageDialog_primaryContainer" role="radiogroup">
                    {optionKey}
                    {optionPassphrase}
                </div>
                <DialogButtons
                    primaryButton={_t("action|continue")}
                    onPrimaryButtonClick={this.onChooseKeyPassphraseFormSubmit}
                    onCancel={this.onCancelClick}
                    hasCancel={this.state.canSkip}
                />
            </form>
        );
    }

    private renderPhaseMigrate(): JSX.Element {
        let authPrompt;
        let nextCaption = _t("action|next");
        if (this.state.canUploadKeysWithPasswordOnly) {
            authPrompt = (
                <div>
                    <div>{_t("settings|key_backup|setup_secure_backup|requires_password_confirmation")}</div>
                    <div>
                        <Field
                            id="mx_CreateSecretStorageDialog_password"
                            type="password"
                            label={_t("common|password")}
                            value={this.state.accountPassword}
                            onChange={this.onAccountPasswordChange}
                            forceValidity={this.state.accountPasswordCorrect === false ? false : undefined}
                            autoFocus={true}
                        />
                    </div>
                </div>
            );
        } else if (!this.state.backupTrustInfo?.trusted) {
            authPrompt = (
                <div>
                    <div>{_t("settings|key_backup|setup_secure_backup|requires_key_restore")}</div>
                </div>
            );
            nextCaption = _t("action|restore");
        } else {
            authPrompt = <p>{_t("settings|key_backup|setup_secure_backup|requires_server_authentication")}</p>;
        }

        return (
            <form onSubmit={this.onMigrateFormSubmit}>
                <p>{_t("settings|key_backup|setup_secure_backup|session_upgrade_description")}</p>
                <div>{authPrompt}</div>
                <DialogButtons
                    primaryButton={nextCaption}
                    onPrimaryButtonClick={this.onMigrateFormSubmit}
                    hasCancel={false}
                    primaryDisabled={!!this.state.canUploadKeysWithPasswordOnly && !this.state.accountPassword}
                >
                    <button type="button" className="danger" onClick={this.onCancelClick}>
                        {_t("action|skip")}
                    </button>
                </DialogButtons>
            </form>
        );
    }

    private renderPhasePassPhrase(): JSX.Element {
        return (
            <form onSubmit={this.onPassPhraseNextClick}>
                <p>{_t("settings|key_backup|setup_secure_backup|enter_phrase_description")}</p>

                <div className="mx_CreateSecretStorageDialog_passPhraseContainer">
                    <PassphraseField
                        id="mx_passPhraseInput"
                        className="mx_CreateSecretStorageDialog_passPhraseField"
                        onChange={this.onPassPhraseChange}
                        minScore={PASSWORD_MIN_SCORE}
                        value={this.state.passPhrase}
                        onValidate={this.onPassPhraseValidate}
                        fieldRef={this.passphraseField}
                        autoFocus={true}
                        label={_td("settings|key_backup|setup_secure_backup|enter_phrase_title")}
                        labelEnterPassword={_td("settings|key_backup|setup_secure_backup|enter_phrase_title")}
                        labelStrongPassword={_td("settings|key_backup|setup_secure_backup|phrase_strong_enough")}
                        labelAllowedButUnsafe={_td("settings|key_backup|setup_secure_backup|phrase_strong_enough")}
                    />
                </div>

                <DialogButtons
                    primaryButton={_t("action|continue")}
                    onPrimaryButtonClick={this.onPassPhraseNextClick}
                    hasCancel={false}
                    disabled={!this.state.passPhraseValid}
                >
                    <button type="button" onClick={this.onCancelClick} className="danger">
                        {_t("action|cancel")}
                    </button>
                </DialogButtons>
            </form>
        );
    }

    private renderPhasePassPhraseConfirm(): JSX.Element {
        let matchText;
        let changeText;
        if (this.state.passPhraseConfirm === this.state.passPhrase) {
            matchText = _t("settings|key_backup|setup_secure_backup|pass_phrase_match_success");
            changeText = _t("settings|key_backup|setup_secure_backup|use_different_passphrase");
        } else if (!this.state.passPhrase.startsWith(this.state.passPhraseConfirm)) {
            // only tell them they're wrong if they've actually gone wrong.
            // Security conscious readers will note that if you left element-web unattended
            // on this screen, this would make it easy for a malicious person to guess
            // your passphrase one letter at a time, but they could get this faster by
            // just opening the browser's developer tools and reading it.
            // Note that not having typed anything at all will not hit this clause and
            // fall through so empty box === no hint.
            matchText = _t("settings|key_backup|setup_secure_backup|pass_phrase_match_failed");
            changeText = _t("settings|key_backup|setup_secure_backup|set_phrase_again");
        }

        let passPhraseMatch: JSX.Element | undefined;
        if (matchText) {
            passPhraseMatch = (
                <div>
                    <div>{matchText}</div>
                    <AccessibleButton kind="link" onClick={this.onSetAgainClick}>
                        {changeText}
                    </AccessibleButton>
                </div>
            );
        }
        return (
            <form onSubmit={this.onPassPhraseConfirmNextClick}>
                <p>{_t("settings|key_backup|setup_secure_backup|enter_phrase_to_confirm")}</p>
                <div className="mx_CreateSecretStorageDialog_passPhraseContainer">
                    <PassphraseConfirmField
                        id="mx_passPhraseInput"
                        onChange={this.onPassPhraseConfirmChange}
                        value={this.state.passPhraseConfirm}
                        className="mx_CreateSecretStorageDialog_passPhraseField"
                        label={_td("settings|key_backup|setup_secure_backup|confirm_security_phrase")}
                        labelRequired={_td("settings|key_backup|setup_secure_backup|confirm_security_phrase")}
                        labelInvalid={_td("settings|key_backup|setup_secure_backup|pass_phrase_match_failed")}
                        autoFocus={true}
                        password={this.state.passPhrase}
                    />
                    <div className="mx_CreateSecretStorageDialog_passPhraseMatch">{passPhraseMatch}</div>
                </div>
                <DialogButtons
                    primaryButton={_t("action|continue")}
                    onPrimaryButtonClick={this.onPassPhraseConfirmNextClick}
                    hasCancel={false}
                    disabled={this.state.passPhrase !== this.state.passPhraseConfirm}
                >
                    <button type="button" onClick={this.onCancelClick} className="danger">
                        {_t("action|skip")}
                    </button>
                </DialogButtons>
            </form>
        );
    }

    private renderPhaseShowKey(): JSX.Element {
        let continueButton: JSX.Element;
        if (this.state.phase === Phase.ShowKey) {
            continueButton = (
                <DialogButtons
                    primaryButton={_t("action|continue")}
                    disabled={!this.state.downloaded && !this.state.copied && !this.state.setPassphrase}
                    onPrimaryButtonClick={this.onShowKeyContinueClick}
                    hasCancel={false}
                />
            );
        } else {
            continueButton = (
                <div className="mx_CreateSecretStorageDialog_continueSpinner">
                    <InlineSpinner />
                </div>
            );
        }

        return (
            <div>
                <p>{_t("settings|key_backup|setup_secure_backup|security_key_safety_reminder")}</p>
                <div className="mx_CreateSecretStorageDialog_primaryContainer mx_CreateSecretStorageDialog_recoveryKeyPrimarycontainer">
                    <div className="mx_CreateSecretStorageDialog_recoveryKeyContainer">
                        <div className="mx_CreateSecretStorageDialog_recoveryKey">
                            <code ref={this.recoveryKeyNode}>{this.recoveryKey?.encodedPrivateKey}</code>
                        </div>
                        <div className="mx_CreateSecretStorageDialog_recoveryKeyButtons">
                            <AccessibleButton
                                kind="primary"
                                className="mx_Dialog_primary"
                                onClick={this.onDownloadClick}
                                disabled={this.state.phase === Phase.Storing}
                            >
                                {_t("action|download")}
                            </AccessibleButton>
                            <span>
                                {_t("settings|key_backup|setup_secure_backup|download_or_copy", {
                                    downloadButton: "",
                                    copyButton: "",
                                })}
                            </span>
                            <AccessibleButton
                                kind="primary"
                                className="mx_Dialog_primary mx_CreateSecretStorageDialog_recoveryKeyButtons_copyBtn"
                                onClick={this.onCopyClick}
                                disabled={this.state.phase === Phase.Storing}
                            >
                                {this.state.copied ? _t("common|copied") : _t("action|copy")}
                            </AccessibleButton>
                        </div>
                    </div>
                </div>
                {continueButton}
            </div>
        );
    }

    private renderBusyPhase(): JSX.Element {
        return (
            <div>
                <Spinner />
            </div>
        );
    }

    private renderStoredPhase(): JSX.Element {
        return (
            <>
                <p className="mx_Dialog_content">
                    {_t("settings|key_backup|setup_secure_backup|backup_setup_success_description")}
                </p>
                <DialogButtons
                    primaryButton={_t("action|done")}
                    onPrimaryButtonClick={() => this.props.onFinished(true)}
                    hasCancel={false}
                />
            </>
        );
    }

    private renderPhaseLoadError(): JSX.Element {
        return (
            <div>
                <p>{_t("settings|key_backup|setup_secure_backup|secret_storage_query_failure")}</p>
                <div className="mx_Dialog_buttons">
                    <DialogButtons
                        primaryButton={_t("action|retry")}
                        onPrimaryButtonClick={this.onLoadRetryClick}
                        hasCancel={this.state.canSkip}
                        onCancel={this.onCancel}
                    />
                </div>
            </div>
        );
    }

    private renderPhaseSkipConfirm(): JSX.Element {
        return (
            <div>
                <p>{_t("settings|key_backup|setup_secure_backup|cancel_warning")}</p>
                <p>{_t("settings|key_backup|setup_secure_backup|settings_reminder")}</p>
                <DialogButtons
                    primaryButton={_t("action|go_back")}
                    onPrimaryButtonClick={this.onGoBackClick}
                    hasCancel={false}
                >
                    <button type="button" className="danger" onClick={this.onCancel}>
                        {_t("action|cancel")}
                    </button>
                </DialogButtons>
            </div>
        );
    }

    private titleForPhase(phase: Phase): string {
        switch (phase) {
            case Phase.ChooseKeyPassphrase:
                return _t("encryption|set_up_toast_title");
            case Phase.Migrate:
                return _t("settings|key_backup|setup_secure_backup|title_upgrade_encryption");
            case Phase.Passphrase:
                return _t("settings|key_backup|setup_secure_backup|title_set_phrase");
            case Phase.PassphraseConfirm:
                return _t("settings|key_backup|setup_secure_backup|title_confirm_phrase");
            case Phase.ConfirmSkip:
                return _t("common|are_you_sure");
            case Phase.ShowKey:
                return _t("settings|key_backup|setup_secure_backup|title_save_key");
            case Phase.Storing:
                return _t("encryption|bootstrap_title");
            case Phase.Stored:
                return _t("settings|key_backup|setup_secure_backup|backup_setup_success_title");
            default:
                return "";
        }
    }

    private get topComponent(): React.ReactNode | null {
        if (this.state.phase === Phase.Stored) {
            return <CheckmarkIcon className="mx_Icon mx_Icon_circle-40 mx_Icon_accent mx_Icon_bg-accent-light" />;
        }

        return null;
    }

    private get classNames(): string {
        return classNames("mx_CreateSecretStorageDialog", {
            mx_SuccessDialog: this.state.phase === Phase.Stored,
        });
    }

    public render(): React.ReactNode {
        let content;
        if (this.state.error) {
            content = (
                <div>
                    <p>{_t("settings|key_backup|setup_secure_backup|unable_to_setup")}</p>
                    <div className="mx_Dialog_buttons">
                        <DialogButtons
                            primaryButton={_t("action|retry")}
                            onPrimaryButtonClick={this.bootstrapSecretStorage}
                            hasCancel={this.state.canSkip}
                            onCancel={this.onCancel}
                        />
                    </div>
                </div>
            );
        } else {
            switch (this.state.phase) {
                case Phase.Loading:
                    content = this.renderBusyPhase();
                    break;
                case Phase.LoadError:
                    content = this.renderPhaseLoadError();
                    break;
                case Phase.ChooseKeyPassphrase:
                    content = this.renderPhaseChooseKeyPassphrase();
                    break;
                case Phase.Migrate:
                    content = this.renderPhaseMigrate();
                    break;
                case Phase.Passphrase:
                    content = this.renderPhasePassPhrase();
                    break;
                case Phase.PassphraseConfirm:
                    content = this.renderPhasePassPhraseConfirm();
                    break;
                case Phase.ShowKey:
                    content = this.renderPhaseShowKey();
                    break;
                case Phase.Storing:
                    content = this.renderBusyPhase();
                    break;
                case Phase.Stored:
                    content = this.renderStoredPhase();
                    break;
                case Phase.ConfirmSkip:
                    content = this.renderPhaseSkipConfirm();
                    break;
            }
        }

        let titleClass: string | string[] | undefined;
        switch (this.state.phase) {
            case Phase.Passphrase:
            case Phase.PassphraseConfirm:
                titleClass = [
                    "mx_CreateSecretStorageDialog_titleWithIcon",
                    "mx_CreateSecretStorageDialog_securePhraseTitle",
                ];
                break;
            case Phase.ShowKey:
                titleClass = [
                    "mx_CreateSecretStorageDialog_titleWithIcon",
                    "mx_CreateSecretStorageDialog_secureBackupTitle",
                ];
                break;
            case Phase.ChooseKeyPassphrase:
                titleClass = "mx_CreateSecretStorageDialog_centeredTitle";
                break;
        }

        return (
            <BaseDialog
                className={this.classNames}
                onFinished={this.props.onFinished}
                top={this.topComponent}
                title={this.titleForPhase(this.state.phase)}
                titleClass={titleClass}
                hasCancel={this.props.hasCancel && [Phase.Passphrase].includes(this.state.phase)}
                fixedWidth={false}
            >
                <div>{content}</div>
            </BaseDialog>
        );
    }
}

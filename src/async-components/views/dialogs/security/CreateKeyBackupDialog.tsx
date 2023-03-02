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

import React, { createRef } from "react";
import FileSaver from "file-saver";
import { IPreparedKeyBackupVersion } from "matrix-js-sdk/src/crypto/backup";
import { logger } from "matrix-js-sdk/src/logger";

import { MatrixClientPeg } from "../../../../MatrixClientPeg";
import { _t, _td } from "../../../../languageHandler";
import { accessSecretStorage } from "../../../../SecurityManager";
import AccessibleButton from "../../../../components/views/elements/AccessibleButton";
import { copyNode } from "../../../../utils/strings";
import PassphraseField from "../../../../components/views/auth/PassphraseField";
import Field from "../../../../components/views/elements/Field";
import Spinner from "../../../../components/views/elements/Spinner";
import BaseDialog from "../../../../components/views/dialogs/BaseDialog";
import DialogButtons from "../../../../components/views/elements/DialogButtons";
import { IValidationResult } from "../../../../components/views/elements/Validation";

enum Phase {
    Passphrase = "passphrase",
    PassphraseConfirm = "passphrase_confirm",
    ShowKey = "show_key",
    KeepItSafe = "keep_it_safe",
    BackingUp = "backing_up",
    Done = "done",
    OptOutConfirm = "opt_out_confirm",
}

const PASSWORD_MIN_SCORE = 4; // So secure, many characters, much complex, wow, etc, etc.

interface IProps {
    onFinished(done?: boolean): void;
}

interface IState {
    secureSecretStorage: boolean | null;
    phase: Phase;
    passPhrase: string;
    passPhraseValid: boolean;
    passPhraseConfirm: string;
    copied: boolean;
    downloaded: boolean;
    error?: string;
}

/*
 * Walks the user through the process of creating an e2e key backup
 * on the server.
 */
export default class CreateKeyBackupDialog extends React.PureComponent<IProps, IState> {
    private keyBackupInfo: Pick<IPreparedKeyBackupVersion, "recovery_key" | "algorithm" | "auth_data">;
    private recoveryKeyNode = createRef<HTMLElement>();
    private passphraseField = createRef<Field>();

    public constructor(props: IProps) {
        super(props);

        this.state = {
            secureSecretStorage: null,
            phase: Phase.Passphrase,
            passPhrase: "",
            passPhraseValid: false,
            passPhraseConfirm: "",
            copied: false,
            downloaded: false,
        };
    }

    public async componentDidMount(): Promise<void> {
        const cli = MatrixClientPeg.get();
        const secureSecretStorage = await cli.doesServerSupportUnstableFeature("org.matrix.e2e_cross_signing");
        this.setState({ secureSecretStorage });

        // If we're using secret storage, skip ahead to the backing up step, as
        // `accessSecretStorage` will handle passphrases as needed.
        if (secureSecretStorage) {
            this.setState({ phase: Phase.BackingUp });
            this.createBackup();
        }
    }

    private onCopyClick = (): void => {
        const successful = copyNode(this.recoveryKeyNode.current);
        if (successful) {
            this.setState({
                copied: true,
                phase: Phase.KeepItSafe,
            });
        }
    };

    private onDownloadClick = (): void => {
        const blob = new Blob([this.keyBackupInfo.recovery_key], {
            type: "text/plain;charset=us-ascii",
        });
        FileSaver.saveAs(blob, "security-key.txt");

        this.setState({
            downloaded: true,
            phase: Phase.KeepItSafe,
        });
    };

    private createBackup = async (): Promise<void> => {
        const { secureSecretStorage } = this.state;
        this.setState({
            phase: Phase.BackingUp,
            error: undefined,
        });
        let info;
        try {
            if (secureSecretStorage) {
                await accessSecretStorage(async (): Promise<void> => {
                    info = await MatrixClientPeg.get().prepareKeyBackupVersion(null /* random key */, {
                        secureSecretStorage: true,
                    });
                    info = await MatrixClientPeg.get().createKeyBackupVersion(info);
                });
            } else {
                info = await MatrixClientPeg.get().createKeyBackupVersion(this.keyBackupInfo);
            }
            await MatrixClientPeg.get().scheduleAllGroupSessionsForBackup();
            this.setState({
                phase: Phase.Done,
            });
        } catch (e) {
            logger.error("Error creating key backup", e);
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
    };

    private onCancel = (): void => {
        this.props.onFinished(false);
    };

    private onDone = (): void => {
        this.props.onFinished(true);
    };

    private onSetUpClick = (): void => {
        this.setState({ phase: Phase.Passphrase });
    };

    private onSkipPassPhraseClick = async (): Promise<void> => {
        this.keyBackupInfo = await MatrixClientPeg.get().prepareKeyBackupVersion();
        this.setState({
            copied: false,
            downloaded: false,
            phase: Phase.ShowKey,
        });
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

        this.keyBackupInfo = await MatrixClientPeg.get().prepareKeyBackupVersion(this.state.passPhrase);
        this.setState({
            copied: false,
            downloaded: false,
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

    private onKeepItSafeBackClick = (): void => {
        this.setState({
            phase: Phase.ShowKey,
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

    private renderPhasePassPhrase(): JSX.Element {
        return (
            <form onSubmit={this.onPassPhraseNextClick}>
                <p>
                    {_t(
                        "<b>Warning</b>: you should only set up key backup from a trusted computer.",
                        {},
                        { b: (sub) => <b>{sub}</b> },
                    )}
                </p>
                <p>
                    {_t(
                        "We'll store an encrypted copy of your keys on our server. " +
                            "Secure your backup with a Security Phrase.",
                    )}
                </p>
                <p>{_t("For maximum security, this should be different from your account password.")}</p>

                <div className="mx_CreateKeyBackupDialog_primaryContainer">
                    <div className="mx_CreateKeyBackupDialog_passPhraseContainer">
                        <PassphraseField
                            className="mx_CreateKeyBackupDialog_passPhraseInput"
                            onChange={this.onPassPhraseChange}
                            minScore={PASSWORD_MIN_SCORE}
                            value={this.state.passPhrase}
                            onValidate={this.onPassPhraseValidate}
                            fieldRef={this.passphraseField}
                            autoFocus={true}
                            label={_td("Enter a Security Phrase")}
                            labelEnterPassword={_td("Enter a Security Phrase")}
                            labelStrongPassword={_td("Great! This Security Phrase looks strong enough.")}
                            labelAllowedButUnsafe={_td("Great! This Security Phrase looks strong enough.")}
                        />
                    </div>
                </div>

                <DialogButtons
                    primaryButton={_t("Next")}
                    onPrimaryButtonClick={this.onPassPhraseNextClick}
                    hasCancel={false}
                    disabled={!this.state.passPhraseValid}
                />

                <details>
                    <summary>{_t("Advanced")}</summary>
                    <AccessibleButton kind="primary" onClick={this.onSkipPassPhraseClick}>
                        {_t("Set up with a Security Key")}
                    </AccessibleButton>
                </details>
            </form>
        );
    }

    private renderPhasePassPhraseConfirm(): JSX.Element {
        let matchText;
        let changeText;
        if (this.state.passPhraseConfirm === this.state.passPhrase) {
            matchText = _t("That matches!");
            changeText = _t("Use a different passphrase?");
        } else if (!this.state.passPhrase.startsWith(this.state.passPhraseConfirm)) {
            // only tell them they're wrong if they've actually gone wrong.
            // Security conscious readers will note that if you left element-web unattended
            // on this screen, this would make it easy for a malicious person to guess
            // your passphrase one letter at a time, but they could get this faster by
            // just opening the browser's developer tools and reading it.
            // Note that not having typed anything at all will not hit this clause and
            // fall through so empty box === no hint.
            matchText = _t("That doesn't match.");
            changeText = _t("Go back to set it again.");
        }

        let passPhraseMatch: JSX.Element | undefined;
        if (matchText) {
            passPhraseMatch = (
                <div className="mx_CreateKeyBackupDialog_passPhraseMatch">
                    <div>{matchText}</div>
                    <AccessibleButton kind="link" onClick={this.onSetAgainClick}>
                        {changeText}
                    </AccessibleButton>
                </div>
            );
        }
        return (
            <form onSubmit={this.onPassPhraseConfirmNextClick}>
                <p>{_t("Enter your Security Phrase a second time to confirm it.")}</p>
                <div className="mx_CreateKeyBackupDialog_primaryContainer">
                    <div className="mx_CreateKeyBackupDialog_passPhraseContainer">
                        <div>
                            <input
                                type="password"
                                onChange={this.onPassPhraseConfirmChange}
                                value={this.state.passPhraseConfirm}
                                className="mx_CreateKeyBackupDialog_passPhraseInput"
                                placeholder={_t("Repeat your Security Phrase…")}
                                autoFocus={true}
                            />
                        </div>
                        {passPhraseMatch}
                    </div>
                </div>
                <DialogButtons
                    primaryButton={_t("Next")}
                    onPrimaryButtonClick={this.onPassPhraseConfirmNextClick}
                    hasCancel={false}
                    disabled={this.state.passPhrase !== this.state.passPhraseConfirm}
                />
            </form>
        );
    }

    private renderPhaseShowKey(): JSX.Element {
        return (
            <div>
                <p>
                    {_t(
                        "Your Security Key is a safety net - you can use it to restore " +
                            "access to your encrypted messages if you forget your Security Phrase.",
                    )}
                </p>
                <p>{_t("Keep a copy of it somewhere secure, like a password manager or even a safe.")}</p>
                <div className="mx_CreateKeyBackupDialog_primaryContainer">
                    <div className="mx_CreateKeyBackupDialog_recoveryKeyHeader">{_t("Your Security Key")}</div>
                    <div className="mx_CreateKeyBackupDialog_recoveryKeyContainer">
                        <div className="mx_CreateKeyBackupDialog_recoveryKey">
                            <code ref={this.recoveryKeyNode}>{this.keyBackupInfo.recovery_key}</code>
                        </div>
                        <div className="mx_CreateKeyBackupDialog_recoveryKeyButtons">
                            <button className="mx_Dialog_primary" onClick={this.onCopyClick}>
                                {_t("Copy")}
                            </button>
                            <button className="mx_Dialog_primary" onClick={this.onDownloadClick}>
                                {_t("Download")}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    private renderPhaseKeepItSafe(): JSX.Element {
        let introText;
        if (this.state.copied) {
            introText = _t(
                "Your Security Key has been <b>copied to your clipboard</b>, paste it to:",
                {},
                { b: (s) => <b>{s}</b> },
            );
        } else if (this.state.downloaded) {
            introText = _t("Your Security Key is in your <b>Downloads</b> folder.", {}, { b: (s) => <b>{s}</b> });
        }
        return (
            <div>
                {introText}
                <ul>
                    <li>{_t("<b>Print it</b> and store it somewhere safe", {}, { b: (s) => <b>{s}</b> })}</li>
                    <li>{_t("<b>Save it</b> on a USB key or backup drive", {}, { b: (s) => <b>{s}</b> })}</li>
                    <li>{_t("<b>Copy it</b> to your personal cloud storage", {}, { b: (s) => <b>{s}</b> })}</li>
                </ul>
                <DialogButtons
                    primaryButton={_t("Continue")}
                    onPrimaryButtonClick={this.createBackup}
                    hasCancel={false}
                >
                    <button onClick={this.onKeepItSafeBackClick}>{_t("Back")}</button>
                </DialogButtons>
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

    private renderPhaseDone(): JSX.Element {
        return (
            <div>
                <p>{_t("Your keys are being backed up (the first backup could take a few minutes).")}</p>
                <DialogButtons primaryButton={_t("OK")} onPrimaryButtonClick={this.onDone} hasCancel={false} />
            </div>
        );
    }

    private renderPhaseOptOutConfirm(): JSX.Element {
        return (
            <div>
                {_t(
                    "Without setting up Secure Message Recovery, you won't be able to restore your " +
                        "encrypted message history if you log out or use another session.",
                )}
                <DialogButtons
                    primaryButton={_t("Set up Secure Message Recovery")}
                    onPrimaryButtonClick={this.onSetUpClick}
                    hasCancel={false}
                >
                    <button onClick={this.onCancel}>I understand, continue without</button>
                </DialogButtons>
            </div>
        );
    }

    private titleForPhase(phase: Phase): string {
        switch (phase) {
            case Phase.Passphrase:
                return _t("Secure your backup with a Security Phrase");
            case Phase.PassphraseConfirm:
                return _t("Confirm your Security Phrase");
            case Phase.OptOutConfirm:
                return _t("Warning!");
            case Phase.ShowKey:
            case Phase.KeepItSafe:
                return _t("Make a copy of your Security Key");
            case Phase.BackingUp:
                return _t("Starting backup…");
            case Phase.Done:
                return _t("Success!");
            default:
                return _t("Create key backup");
        }
    }

    public render(): React.ReactNode {
        let content;
        if (this.state.error) {
            content = (
                <div>
                    <p>{_t("Unable to create key backup")}</p>
                    <DialogButtons
                        primaryButton={_t("Retry")}
                        onPrimaryButtonClick={this.createBackup}
                        hasCancel={true}
                        onCancel={this.onCancel}
                    />
                </div>
            );
        } else {
            switch (this.state.phase) {
                case Phase.Passphrase:
                    content = this.renderPhasePassPhrase();
                    break;
                case Phase.PassphraseConfirm:
                    content = this.renderPhasePassPhraseConfirm();
                    break;
                case Phase.ShowKey:
                    content = this.renderPhaseShowKey();
                    break;
                case Phase.KeepItSafe:
                    content = this.renderPhaseKeepItSafe();
                    break;
                case Phase.BackingUp:
                    content = this.renderBusyPhase();
                    break;
                case Phase.Done:
                    content = this.renderPhaseDone();
                    break;
                case Phase.OptOutConfirm:
                    content = this.renderPhaseOptOutConfirm();
                    break;
            }
        }

        return (
            <BaseDialog
                className="mx_CreateKeyBackupDialog"
                onFinished={this.props.onFinished}
                title={this.titleForPhase(this.state.phase)}
                hasCancel={[Phase.Passphrase, Phase.Done].includes(this.state.phase)}
            >
                <div>{content}</div>
            </BaseDialog>
        );
    }
}

/*
Copyright 2024 New Vector Ltd.
Copyright 2018-2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { debounce } from "lodash";
import classNames from "classnames";
import React, { type ChangeEvent, type FormEvent } from "react";
import { logger } from "matrix-js-sdk/src/logger";
import { decodeRecoveryKey } from "matrix-js-sdk/src/crypto-api";
import { type SecretStorage } from "matrix-js-sdk/src/matrix";

import { MatrixClientPeg } from "../../../../MatrixClientPeg";
import Field from "../../elements/Field";
import AccessibleButton, { type ButtonEvent } from "../../elements/AccessibleButton";
import { _t } from "../../../../languageHandler";
import { accessSecretStorage } from "../../../../SecurityManager";
import Modal from "../../../../Modal";
import DialogButtons from "../../elements/DialogButtons";
import BaseDialog from "../BaseDialog";
import { chromeFileInputFix } from "../../../../utils/BrowserWorkarounds";

// Maximum acceptable size of a key file. It's 59 characters including the spaces we encode,
// so this should be plenty and allow for people putting extra whitespace in the file because
// maybe that's a thing people would do?
const KEY_FILE_MAX_SIZE = 128;

// Don't shout at the user that their key is invalid every time they type a key: wait a short time
const VALIDATION_THROTTLE_MS = 200;

export type KeyParams = { passphrase?: string; recoveryKey?: string };

interface IProps {
    keyInfo: SecretStorage.SecretStorageKeyDescription;
    checkPrivateKey: (k: KeyParams) => Promise<boolean>;
    onFinished(result?: false | KeyParams): void;
}

interface IState {
    recoveryKey: string;
    recoveryKeyValid: boolean | null;
    recoveryKeyCorrect: boolean | null;
    recoveryKeyFileError: boolean | null;
    forceRecoveryKey: boolean;
    passPhrase: string;
    keyMatches: boolean | null;
    resetting: boolean;
}

/*
 * Access Secure Secret Storage by requesting the user's passphrase.
 */
export default class AccessSecretStorageDialog extends React.PureComponent<IProps, IState> {
    private fileUpload = React.createRef<HTMLInputElement>();
    private inputRef = React.createRef<HTMLInputElement>();

    public constructor(props: IProps) {
        super(props);

        this.state = {
            recoveryKey: "",
            recoveryKeyValid: null,
            recoveryKeyCorrect: null,
            recoveryKeyFileError: null,
            forceRecoveryKey: false,
            passPhrase: "",
            keyMatches: null,
            resetting: false,
        };
    }

    private onCancel = (): void => {
        if (this.state.resetting) {
            this.setState({ resetting: false });
        }
        this.props.onFinished(false);
    };

    private onUseRecoveryKeyClick = (): void => {
        this.setState({
            forceRecoveryKey: true,
        });
    };

    private validateRecoveryKeyOnChange = debounce(async (): Promise<void> => {
        await this.validateRecoveryKey();
    }, VALIDATION_THROTTLE_MS);

    private async validateRecoveryKey(): Promise<void> {
        if (this.state.recoveryKey === "") {
            this.setState({
                recoveryKeyValid: null,
                recoveryKeyCorrect: null,
            });
            return;
        }

        try {
            const cli = MatrixClientPeg.safeGet();
            const decodedKey = decodeRecoveryKey(this.state.recoveryKey);
            const correct = await cli.secretStorage.checkKey(decodedKey, this.props.keyInfo);
            this.setState({
                recoveryKeyValid: true,
                recoveryKeyCorrect: correct,
            });
        } catch {
            this.setState({
                recoveryKeyValid: false,
                recoveryKeyCorrect: false,
            });
        }
    }

    private onRecoveryKeyChange = (ev: ChangeEvent<HTMLInputElement>): void => {
        this.setState({
            recoveryKey: ev.target.value,
            recoveryKeyFileError: null,
        });

        // also clear the file upload control so that the user can upload the same file
        // the did before (otherwise the onchange wouldn't fire)
        if (this.fileUpload.current) this.fileUpload.current.value = "";

        // We don't use Field's validation here because a) we want it in a separate place rather
        // than in a tooltip and b) we want it to display feedback based on the uploaded file
        // as well as the text box. Ideally we would refactor Field's validation logic so we could
        // re-use some of it.
        this.validateRecoveryKeyOnChange();
    };

    private onRecoveryKeyFileChange = async (ev: ChangeEvent<HTMLInputElement>): Promise<void> => {
        if (!ev.target.files?.length) return;

        const f = ev.target.files[0];

        if (f.size > KEY_FILE_MAX_SIZE) {
            this.setState({
                recoveryKeyFileError: true,
                recoveryKeyCorrect: false,
                recoveryKeyValid: false,
            });
        } else {
            const contents = await f.text();
            // test it's within the base58 alphabet. We could be more strict here, eg. require the
            // right number of characters, but it's really just to make sure that what we're reading is
            // text because we'll put it in the text field.
            if (/^[123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz\s]+$/.test(contents)) {
                this.setState({
                    recoveryKeyFileError: null,
                    recoveryKey: contents.trim(),
                });
                await this.validateRecoveryKey();
            } else {
                this.setState({
                    recoveryKeyFileError: true,
                    recoveryKeyCorrect: false,
                    recoveryKeyValid: false,
                    recoveryKey: "",
                });
            }
        }
    };

    private onRecoveryKeyFileUploadClick = (): void => {
        this.fileUpload.current?.click();
    };

    private onPassPhraseNext = async (ev: FormEvent<HTMLFormElement> | React.MouseEvent): Promise<void> => {
        ev.preventDefault();

        if (this.state.passPhrase.length <= 0) {
            this.inputRef.current?.focus();
            return;
        }

        this.setState({ keyMatches: null });
        const input = { passphrase: this.state.passPhrase };
        const keyMatches = await this.props.checkPrivateKey(input);
        if (keyMatches) {
            this.props.onFinished(input);
        } else {
            this.setState({ keyMatches });
            this.inputRef.current?.focus();
        }
    };

    private onRecoveryKeyNext = async (ev: FormEvent<HTMLFormElement> | React.MouseEvent): Promise<void> => {
        ev.preventDefault();

        if (!this.state.recoveryKeyValid) return;

        this.setState({ keyMatches: null });
        const input = { recoveryKey: this.state.recoveryKey };
        const keyMatches = await this.props.checkPrivateKey(input);
        if (keyMatches) {
            this.props.onFinished(input);
        } else {
            this.setState({ keyMatches });
        }
    };

    private onPassPhraseChange = (ev: ChangeEvent<HTMLInputElement>): void => {
        this.setState({
            passPhrase: ev.target.value,
            keyMatches: null,
        });
    };

    private onResetAllClick = (ev: ButtonEvent): void => {
        ev.preventDefault();
        this.setState({ resetting: true });
    };

    private onConfirmResetAllClick = async (): Promise<void> => {
        // Hide ourselves so the user can interact with the reset dialogs.
        // We don't conclude the promise chain (onFinished) yet to avoid confusing
        // any upstream code flows.
        //
        // Note: this will unmount us, so don't call `setState` or anything in the
        // rest of this function.
        Modal.toggleCurrentDialogVisibility();

        try {
            // Force reset secret storage (which resets the key backup)
            await accessSecretStorage(
                async (): Promise<void> => {
                    // Now we can indicate that the user is done pressing buttons, finally.
                    // Upstream flows will detect the new secret storage, key backup, etc and use it.
                    this.props.onFinished({});
                },
                { forceReset: true, resetCrossSigning: true },
            );
        } catch (e) {
            logger.error(e);
            this.props.onFinished(false);
        }
    };

    private getKeyValidationText(): string {
        if (this.state.recoveryKeyFileError) {
            return _t("encryption|access_secret_storage_dialog|key_validation_text|wrong_file_type");
        } else if (this.state.recoveryKeyCorrect) {
            return _t("encryption|access_secret_storage_dialog|key_validation_text|recovery_key_is_correct");
        } else if (this.state.recoveryKeyValid) {
            return _t("encryption|access_secret_storage_dialog|key_validation_text|wrong_security_key");
        } else if (this.state.recoveryKeyValid === null) {
            return "";
        } else {
            return _t("encryption|access_secret_storage_dialog|key_validation_text|invalid_security_key");
        }
    }

    public render(): React.ReactNode {
        const hasPassphrase = this.props.keyInfo?.passphrase?.salt && this.props.keyInfo?.passphrase?.iterations;

        const resetLine = (
            <strong className="mx_AccessSecretStorageDialog_reset">
                {_t("encryption|reset_all_button", undefined, {
                    a: (sub) => (
                        <AccessibleButton
                            kind="link_inline"
                            onClick={this.onResetAllClick}
                            className="mx_AccessSecretStorageDialog_reset_link"
                        >
                            {sub}
                        </AccessibleButton>
                    ),
                })}
            </strong>
        );

        let content;
        let title;
        let titleClass;
        if (this.state.resetting) {
            title = _t("encryption|access_secret_storage_dialog|reset_title");
            titleClass = ["mx_AccessSecretStorageDialog_titleWithIcon mx_AccessSecretStorageDialog_resetBadge"];
            content = (
                <div>
                    <p>{_t("encryption|access_secret_storage_dialog|reset_warning_1")}</p>
                    <p>{_t("encryption|access_secret_storage_dialog|reset_warning_2")}</p>
                    <DialogButtons
                        primaryButton={_t("action|reset")}
                        onPrimaryButtonClick={this.onConfirmResetAllClick}
                        hasCancel={true}
                        onCancel={this.onCancel}
                        focus={false}
                        primaryButtonClass="danger"
                    />
                </div>
            );
        } else if (hasPassphrase && !this.state.forceRecoveryKey) {
            title = _t("encryption|access_secret_storage_dialog|security_phrase_title");
            titleClass = ["mx_AccessSecretStorageDialog_titleWithIcon mx_AccessSecretStorageDialog_securePhraseTitle"];

            let keyStatus;
            if (this.state.keyMatches === false) {
                keyStatus = (
                    <div className="mx_AccessSecretStorageDialog_keyStatus">
                        {"\uD83D\uDC4E "}
                        {_t("encryption|access_secret_storage_dialog|security_phrase_incorrect_error")}
                    </div>
                );
            } else {
                keyStatus = <div className="mx_AccessSecretStorageDialog_keyStatus" />;
            }

            content = (
                <div>
                    <p>
                        {_t(
                            "encryption|access_secret_storage_dialog|enter_phrase_or_key_prompt",
                            {},
                            {
                                button: (s) => (
                                    <AccessibleButton kind="link_inline" onClick={this.onUseRecoveryKeyClick}>
                                        {s}
                                    </AccessibleButton>
                                ),
                            },
                        )}
                    </p>

                    <form className="mx_AccessSecretStorageDialog_primaryContainer" onSubmit={this.onPassPhraseNext}>
                        <Field
                            inputRef={this.inputRef}
                            id="mx_passPhraseInput"
                            className="mx_AccessSecretStorageDialog_passPhraseInput"
                            type="password"
                            label={_t("encryption|access_secret_storage_dialog|security_phrase_title")}
                            value={this.state.passPhrase}
                            onChange={this.onPassPhraseChange}
                            autoFocus={true}
                            autoComplete="new-password"
                        />
                        {keyStatus}
                        <DialogButtons
                            primaryButton={_t("action|continue")}
                            onPrimaryButtonClick={this.onPassPhraseNext}
                            hasCancel={true}
                            onCancel={this.onCancel}
                            focus={false}
                            primaryDisabled={this.state.passPhrase.length === 0}
                            additive={resetLine}
                        />
                    </form>
                </div>
            );
        } else {
            title = _t("encryption|access_secret_storage_dialog|security_key_title");
            titleClass = ["mx_AccessSecretStorageDialog_titleWithIcon mx_AccessSecretStorageDialog_secureBackupTitle"];

            const feedbackClasses = classNames({
                "mx_AccessSecretStorageDialog_recoveryKeyFeedback": true,
                "mx_AccessSecretStorageDialog_recoveryKeyFeedback--valid": this.state.recoveryKeyCorrect === true,
                "mx_AccessSecretStorageDialog_recoveryKeyFeedback--invalid": this.state.recoveryKeyCorrect === false,
            });
            const recoveryKeyFeedback = <div className={feedbackClasses}>{this.getKeyValidationText()}</div>;

            content = (
                <div>
                    <p>{_t("encryption|access_secret_storage_dialog|use_security_key_prompt")}</p>

                    <form
                        className="mx_AccessSecretStorageDialog_primaryContainer"
                        onSubmit={this.onRecoveryKeyNext}
                        spellCheck={false}
                        autoComplete="off"
                    >
                        <div className="mx_AccessSecretStorageDialog_recoveryKeyEntry">
                            <div className="mx_AccessSecretStorageDialog_recoveryKeyEntry_textInput">
                                <Field
                                    type="password"
                                    id="mx_securityKey"
                                    label={_t("encryption|access_secret_storage_dialog|security_key_title")}
                                    value={this.state.recoveryKey}
                                    onChange={this.onRecoveryKeyChange}
                                    autoFocus={true}
                                    forceValidity={this.state.recoveryKeyCorrect ?? undefined}
                                    autoComplete="off"
                                />
                            </div>
                            <span className="mx_AccessSecretStorageDialog_recoveryKeyEntry_entryControlSeparatorText">
                                {_t("encryption|access_secret_storage_dialog|separator", {
                                    recoveryFile: "",
                                    securityKey: "",
                                })}
                            </span>
                            <div>
                                <input
                                    type="file"
                                    className="mx_AccessSecretStorageDialog_recoveryKeyEntry_fileInput"
                                    ref={this.fileUpload}
                                    onClick={chromeFileInputFix}
                                    onChange={this.onRecoveryKeyFileChange}
                                />
                                <AccessibleButton kind="primary" onClick={this.onRecoveryKeyFileUploadClick}>
                                    {_t("action|upload")}
                                </AccessibleButton>
                            </div>
                        </div>
                        {recoveryKeyFeedback}
                        <DialogButtons
                            primaryButton={_t("action|continue")}
                            onPrimaryButtonClick={this.onRecoveryKeyNext}
                            hasCancel={true}
                            cancelButton={_t("action|go_back")}
                            cancelButtonClass="warning"
                            onCancel={this.onCancel}
                            focus={false}
                            primaryDisabled={!this.state.recoveryKeyValid}
                            additive={resetLine}
                        />
                    </form>
                </div>
            );
        }

        return (
            <BaseDialog
                className="mx_AccessSecretStorageDialog"
                onFinished={this.props.onFinished}
                title={title}
                titleClass={titleClass}
            >
                <div>{content}</div>
            </BaseDialog>
        );
    }
}

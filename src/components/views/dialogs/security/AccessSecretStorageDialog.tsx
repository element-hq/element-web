/*
Copyright 2024 New Vector Ltd.
Copyright 2018-2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { debounce } from "lodash";
import classNames from "classnames";
import React, { type ChangeEvent, type FormEvent } from "react";
import { type SecretStorage } from "matrix-js-sdk/src/matrix";

import Field from "../../elements/Field";
import { _t } from "../../../../languageHandler";
import DialogButtons from "../../elements/DialogButtons";
import BaseDialog from "../BaseDialog";

// Don't shout at the user that their key is invalid every time they type a key: wait a short time
const VALIDATION_THROTTLE_MS = 200;

export type KeyParams = { passphrase?: string; recoveryKey?: string };

interface IProps {
    /**
     * Information about the Secret Storage key that we want to get.
     */
    keyInfo: SecretStorage.SecretStorageKeyDescription;
    /**
     * Callback to check whether the given key is correct.
     */
    checkPrivateKey: (k: KeyParams) => Promise<boolean>;
    /**
     * Callback for when the user is done with this dialog.  `result` will
     * contain information about the key that was entered, or will be `false` if
     * the user cancelled.
     */
    onFinished(result?: false | KeyParams): void;
}

interface IState {
    //! The recovery key/phrase that the user entered
    recoveryKey: string;
    //! Is the recovery key/phrase correct?  `null` means no key/phrase has been entered
    recoveryKeyCorrect: boolean | null;
}

/*
 * Access Secure Secret Storage by requesting the user's passphrase.
 */
export default class AccessSecretStorageDialog extends React.PureComponent<IProps, IState> {
    private inputRef = React.createRef<HTMLInputElement>();

    public constructor(props: IProps) {
        super(props);

        this.state = {
            recoveryKey: "",
            recoveryKeyCorrect: null,
        };
    }

    private onCancel = (): void => {
        this.props.onFinished(false);
    };

    private validateRecoveryKeyOnChange = debounce(async (): Promise<void> => {
        // FIXME: don't call this if we're already validating
        await this.validateRecoveryKey(this.state.recoveryKey);
    }, VALIDATION_THROTTLE_MS);

    /**
     * Checks whether the security key/phrase is correct.
     *
     * Sets `state.recoveryKeyCorrect` accordingly, and if the key/phrase is
     * correct, returns a `KeyParams` structure.
     */
    private async validateRecoveryKey(recoveryKey: string): Promise<KeyParams | undefined> {
        if (recoveryKey === "") {
            this.setState({
                recoveryKeyCorrect: null,
            });
        }

        const hasPassphrase = this.props.keyInfo?.passphrase?.salt && this.props.keyInfo?.passphrase?.iterations;

        // If the user has a passphrase, we want to try validating it both as a
        // key and as a passphrase.  We first try to validate it as a key, since
        // that check is faster.

        try {
            const input = { recoveryKey: this.state.recoveryKey };
            const recoveryKeyCorrect = await this.props.checkPrivateKey(input);
            if (recoveryKeyCorrect) {
                this.setState({ recoveryKeyCorrect });
                return input;
            }
        } catch {}

        if (hasPassphrase) {
            try {
                const input = { passphrase: this.state.recoveryKey };
                const recoveryKeyCorrect = await this.props.checkPrivateKey(input);
                if (recoveryKeyCorrect) {
                    this.setState({ recoveryKeyCorrect });
                    return input;
                }
            } catch {}
        }

        this.setState({
            recoveryKeyCorrect: false,
        });
    }

    private onRecoveryKeyChange = (ev: ChangeEvent<HTMLInputElement>): void => {
        this.setState({
            recoveryKey: ev.target.value,
        });

        // We don't use Field's validation here because we want it in a separate place rather
        // than in a tooltip. Ideally we would refactor Field's validation logic so we could
        // re-use some of it.
        this.validateRecoveryKeyOnChange();
    };

    private onRecoveryKeyNext = async (ev: FormEvent<HTMLFormElement> | React.MouseEvent): Promise<void> => {
        ev.preventDefault();

        const keyParams = await this.validateRecoveryKey(this.state.recoveryKey);

        if (this.state.recoveryKeyCorrect) {
            this.props.onFinished(keyParams);
        } else {
            this.inputRef.current?.focus();
        }
    };

    private getKeyValidationClasses(): string {
            return classNames({
                "mx_AccessSecretStorageDialog_recoveryKeyFeedback": true,
                "mx_AccessSecretStorageDialog_recoveryKeyFeedback--valid": this.state.recoveryKeyCorrect === true,
                "mx_AccessSecretStorageDialog_recoveryKeyFeedback--invalid": this.state.recoveryKeyCorrect === false,
            });
    }

    private getKeyValidationText(): string {
        if (this.state.recoveryKeyCorrect) {
            return _t("encryption|access_secret_storage_dialog|key_validation_text|recovery_key_is_correct");
        } else if (this.state.recoveryKeyCorrect === null) {
            return _t("encryption|access_secret_storage_dialog|alternatives");
        } else {
            return _t("encryption|access_secret_storage_dialog|key_validation_text|wrong_security_key");
        }
    }

    private getRecoveryKeyFeedback(): React.ReactNode {
        return <div className={this.getKeyValidationClasses()}>{this.getKeyValidationText()}</div>
    }

    public render(): React.ReactNode {
        const title = _t("encryption|access_secret_storage_dialog|security_key_title");
        const titleClass = ["mx_AccessSecretStorageDialog_titleWithIcon mx_AccessSecretStorageDialog_secureBackupTitle"];

        const recoveryKeyFeedback = this.getRecoveryKeyFeedback();
        const content = (
            <div>
                <p>{_t("encryption|access_secret_storage_dialog|privacy_warning")}</p>

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
                    </div>
                    {recoveryKeyFeedback}
                    <DialogButtons
                        primaryButton={_t("action|continue")}
                        onPrimaryButtonClick={this.onRecoveryKeyNext}
                        hasCancel={true}
                        cancelButton={_t("action|cancel")}
                        cancelButtonClass="warning"
                        onCancel={this.onCancel}
                        focus={false}
                        primaryDisabled={!this.state.recoveryKeyCorrect}
                    />
                </form>
            </div>
        );

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

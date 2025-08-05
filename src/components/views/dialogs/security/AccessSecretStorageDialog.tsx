/*
Copyright 2024 New Vector Ltd.
Copyright 2018-2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { Button, PasswordInput } from "@vector-im/compound-web";
import LockSolidIcon from "@vector-im/compound-design-tokens/assets/web/icons/lock-solid";
import { debounce } from "lodash";
import classNames from "classnames";
import React, { type ChangeEvent, type FormEvent } from "react";
import { type SecretStorage } from "matrix-js-sdk/src/matrix";

import { Flex } from "../../../../shared-components/utils/Flex";
import { _t } from "../../../../languageHandler";
import { EncryptionCard } from "../../settings/encryption/EncryptionCard";
import { EncryptionCardButtons } from "../../settings/encryption/EncryptionCardButtons";
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
        await this.validateRecoveryKey(this.state.recoveryKey);
    }, VALIDATION_THROTTLE_MS);

    /**
     * Checks whether the security key/phrase is correct.
     *
     * Sets `state.recoveryKeyCorrect` accordingly, and if the key/phrase is
     * correct, returns a `KeyParams` structure.
     */
    private async validateRecoveryKey(recoveryKey: string): Promise<KeyParams | undefined> {
        recoveryKey = recoveryKey.trim();

        if (recoveryKey === "") {
            this.setState({
                recoveryKeyCorrect: null,
            });
            return;
        }

        const hasPassphrase = this.props.keyInfo?.passphrase?.salt && this.props.keyInfo?.passphrase?.iterations;

        // If the user has a passphrase, we want to try validating it both as a
        // key and as a passphrase.  We first try to validate it as a key, since
        // that check is faster.

        try {
            const input = { recoveryKey };
            const recoveryKeyCorrect = await this.props.checkPrivateKey(input);
            if (recoveryKeyCorrect) {
                this.setState({ recoveryKeyCorrect });
                return input;
            }
        } catch {}

        if (hasPassphrase) {
            try {
                const input = { passphrase: recoveryKey };
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

        if (keyParams !== undefined) {
            this.props.onFinished(keyParams);
        } else {
            this.inputRef.current?.focus();
        }
    };

    private getRecoveryKeyFeedback(): React.ReactNode | null {
        let validationText: string;
        let classes: string | undefined;

        if (this.state.recoveryKeyCorrect) {
            // The recovery key is good. Empty feedback.
            validationText = "\xA0"; // &nbsp;
        } else if (this.state.recoveryKeyCorrect === null) {
            // The input element is empty. Tell the user they can also use a passphrase.
            validationText = _t("encryption|access_secret_storage_dialog|alternatives");
        } else {
            // The entered key is not (yet) correct. Tell them so.
            validationText = _t("encryption|access_secret_storage_dialog|key_validation_text|wrong_security_key");
            classes = classNames({
                "mx_AccessSecretStorageDialog_recoveryKeyFeedback": true,
                "mx_AccessSecretStorageDialog_recoveryKeyFeedback--invalid": true,
            });
        }

        return (
            <Flex align="center" className={classes}>
                {validationText}
            </Flex>
        );
    }

    public render(): React.ReactNode {
        const title = _t("encryption|access_secret_storage_dialog|security_key_title");

        const recoveryKeyFeedback = this.getRecoveryKeyFeedback();
        const content = (
            <div>
                <form
                    className="mx_AccessSecretStorageDialog_primaryContainer"
                    onSubmit={this.onRecoveryKeyNext}
                    spellCheck={false}
                    autoComplete="off"
                >
                    <div className="mx_AccessSecretStorageDialog_recoveryKeyEntry">
                        <PasswordInput
                            ref={this.inputRef}
                            id="mx_securityKey"
                            title={_t("encryption|access_secret_storage_dialog|security_key_label")}
                            placeholder={_t("encryption|access_secret_storage_dialog|security_key_label")}
                            value={this.state.recoveryKey}
                            onChange={this.onRecoveryKeyChange}
                            autoFocus={true}
                            autoComplete="off"
                        />
                    </div>
                    {recoveryKeyFeedback}
                    <EncryptionCardButtons>
                        <Button disabled={!this.state.recoveryKeyCorrect} onClick={this.onRecoveryKeyNext}>
                            {_t("action|continue")}
                        </Button>
                        <Button kind="tertiary" onClick={this.onCancel}>
                            {_t("action|cancel")}
                        </Button>
                    </EncryptionCardButtons>
                </form>
            </div>
        );

        // We wrap the content in `BaseDialog` mostly so that we get a `FocusLock` container; otherwise, if the
        // SettingsDialog is open, then the `FocusLock` in *that* stops us getting the focus.
        return (
            <BaseDialog fixedWidth={false} hasCancel={false}>
                <EncryptionCard
                    Icon={LockSolidIcon}
                    className="mx_AccessSecretStorageDialog"
                    title={title}
                    description={_t("encryption|access_secret_storage_dialog|privacy_warning")}
                >
                    {content}
                </EncryptionCard>
            </BaseDialog>
        );
    }
}

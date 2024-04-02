/*
Copyright 2020-2021 The Matrix.org Foundation C.I.C.

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

import React from "react";
import { IKeyBackupInfo } from "matrix-js-sdk/src/crypto/keybackup";
import { VerificationRequest } from "matrix-js-sdk/src/crypto-api";
import { logger } from "matrix-js-sdk/src/logger";
import { SecretStorageKeyDescription } from "matrix-js-sdk/src/secret-storage";

import { _t } from "../../../languageHandler";
import { MatrixClientPeg } from "../../../MatrixClientPeg";
import Modal from "../../../Modal";
import VerificationRequestDialog from "../../views/dialogs/VerificationRequestDialog";
import { SetupEncryptionStore, Phase } from "../../../stores/SetupEncryptionStore";
import EncryptionPanel from "../../views/right_panel/EncryptionPanel";
import AccessibleButton, { ButtonEvent } from "../../views/elements/AccessibleButton";
import Spinner from "../../views/elements/Spinner";

function keyHasPassphrase(keyInfo: SecretStorageKeyDescription): boolean {
    return Boolean(keyInfo.passphrase && keyInfo.passphrase.salt && keyInfo.passphrase.iterations);
}

interface IProps {
    onFinished: () => void;
}

interface IState {
    phase?: Phase;
    verificationRequest: VerificationRequest | null;
    backupInfo: IKeyBackupInfo | null;
    lostKeys: boolean;
}

export default class SetupEncryptionBody extends React.Component<IProps, IState> {
    public constructor(props: IProps) {
        super(props);
        const store = SetupEncryptionStore.sharedInstance();
        store.on("update", this.onStoreUpdate);
        store.start();
        this.state = {
            phase: store.phase,
            // this serves dual purpose as the object for the request logic and
            // the presence of it indicating that we're in 'verify mode'.
            // Because of the latter, it lives in the state.
            verificationRequest: store.verificationRequest,
            backupInfo: store.backupInfo,
            lostKeys: store.lostKeys(),
        };
    }

    private onStoreUpdate = (): void => {
        const store = SetupEncryptionStore.sharedInstance();
        if (store.phase === Phase.Finished) {
            this.props.onFinished();
            return;
        }
        this.setState({
            phase: store.phase,
            verificationRequest: store.verificationRequest,
            backupInfo: store.backupInfo,
            lostKeys: store.lostKeys(),
        });
    };

    public componentWillUnmount(): void {
        const store = SetupEncryptionStore.sharedInstance();
        store.off("update", this.onStoreUpdate);
        store.stop();
    }

    private onUsePassphraseClick = async (): Promise<void> => {
        const store = SetupEncryptionStore.sharedInstance();
        store.usePassPhrase();
    };

    private onVerifyClick = (): void => {
        const cli = MatrixClientPeg.safeGet();
        const userId = cli.getSafeUserId();
        const requestPromise = cli.getCrypto()!.requestOwnUserVerification();

        // We need to call onFinished now to close this dialog, and
        // again later to signal that the verification is complete.
        this.props.onFinished();
        Modal.createDialog(VerificationRequestDialog, {
            verificationRequestPromise: requestPromise,
            member: cli.getUser(userId) ?? undefined,
            onFinished: async (): Promise<void> => {
                const request = await requestPromise;
                request.cancel();
                this.props.onFinished();
            },
        });
    };

    private onSkipConfirmClick = (): void => {
        const store = SetupEncryptionStore.sharedInstance();
        store.skipConfirm();
    };

    private onSkipBackClick = (): void => {
        const store = SetupEncryptionStore.sharedInstance();
        store.returnAfterSkip();
    };

    private onResetClick = (ev: ButtonEvent): void => {
        ev.preventDefault();
        const store = SetupEncryptionStore.sharedInstance();
        store.reset();
    };

    private onResetConfirmClick = (): void => {
        this.props.onFinished();
        const store = SetupEncryptionStore.sharedInstance();
        store.resetConfirm();
    };

    private onResetBackClick = (): void => {
        const store = SetupEncryptionStore.sharedInstance();
        store.returnAfterReset();
    };

    private onDoneClick = (): void => {
        const store = SetupEncryptionStore.sharedInstance();
        store.done();
    };

    private onEncryptionPanelClose = (): void => {
        this.props.onFinished();
    };

    public render(): React.ReactNode {
        const cli = MatrixClientPeg.safeGet();
        const { phase, lostKeys } = this.state;

        if (this.state.verificationRequest && cli.getUser(this.state.verificationRequest.otherUserId)) {
            return (
                <EncryptionPanel
                    layout="dialog"
                    verificationRequest={this.state.verificationRequest}
                    onClose={this.onEncryptionPanelClose}
                    member={cli.getUser(this.state.verificationRequest.otherUserId)!}
                    isRoomEncrypted={false}
                />
            );
        } else if (phase === Phase.Intro) {
            if (lostKeys) {
                return (
                    <div>
                        <p>{_t("encryption|verification|no_key_or_device")}</p>

                        <div className="mx_CompleteSecurity_actionRow">
                            <AccessibleButton kind="primary" onClick={this.onResetConfirmClick}>
                                {_t("encryption|verification|reset_proceed_prompt")}
                            </AccessibleButton>
                        </div>
                    </div>
                );
            } else {
                const store = SetupEncryptionStore.sharedInstance();
                let recoveryKeyPrompt;
                if (store.keyInfo && keyHasPassphrase(store.keyInfo)) {
                    recoveryKeyPrompt = _t("encryption|verification|verify_using_key_or_phrase");
                } else if (store.keyInfo) {
                    recoveryKeyPrompt = _t("encryption|verification|verify_using_key");
                }

                let useRecoveryKeyButton;
                if (recoveryKeyPrompt) {
                    useRecoveryKeyButton = (
                        <AccessibleButton kind="primary" onClick={this.onUsePassphraseClick}>
                            {recoveryKeyPrompt}
                        </AccessibleButton>
                    );
                }

                let verifyButton;
                if (store.hasDevicesToVerifyAgainst) {
                    verifyButton = (
                        <AccessibleButton kind="primary" onClick={this.onVerifyClick}>
                            {_t("encryption|verification|verify_using_device")}
                        </AccessibleButton>
                    );
                }

                return (
                    <div>
                        <p>{_t("encryption|verification|verification_description")}</p>

                        <div className="mx_CompleteSecurity_actionRow">
                            {verifyButton}
                            {useRecoveryKeyButton}
                        </div>
                        <div className="mx_SetupEncryptionBody_reset">
                            {_t("encryption|reset_all_button", undefined, {
                                a: (sub) => (
                                    <AccessibleButton
                                        kind="link_inline"
                                        className="mx_SetupEncryptionBody_reset_link"
                                        onClick={this.onResetClick}
                                    >
                                        {sub}
                                    </AccessibleButton>
                                ),
                            })}
                        </div>
                    </div>
                );
            }
        } else if (phase === Phase.Done) {
            let message: JSX.Element;
            if (this.state.backupInfo) {
                message = <p>{_t("encryption|verification|verification_success_with_backup")}</p>;
            } else {
                message = <p>{_t("encryption|verification|verification_success_without_backup")}</p>;
            }
            return (
                <div>
                    <div className="mx_CompleteSecurity_heroIcon mx_E2EIcon_verified" />
                    {message}
                    <div className="mx_CompleteSecurity_actionRow">
                        <AccessibleButton kind="primary" onClick={this.onDoneClick}>
                            {_t("action|done")}
                        </AccessibleButton>
                    </div>
                </div>
            );
        } else if (phase === Phase.ConfirmSkip) {
            return (
                <div>
                    <p>{_t("encryption|verification|verification_skip_warning")}</p>
                    <div className="mx_CompleteSecurity_actionRow">
                        <AccessibleButton kind="danger_outline" onClick={this.onSkipConfirmClick}>
                            {_t("encryption|verification|verify_later")}
                        </AccessibleButton>
                        <AccessibleButton kind="primary" onClick={this.onSkipBackClick}>
                            {_t("action|go_back")}
                        </AccessibleButton>
                    </div>
                </div>
            );
        } else if (phase === Phase.ConfirmReset) {
            return (
                <div>
                    <p>{_t("encryption|verification|verify_reset_warning_1")}</p>
                    <p>{_t("encryption|verification|verify_reset_warning_2")}</p>

                    <div className="mx_CompleteSecurity_actionRow">
                        <AccessibleButton kind="danger_outline" onClick={this.onResetConfirmClick}>
                            {_t("encryption|verification|reset_proceed_prompt")}
                        </AccessibleButton>
                        <AccessibleButton kind="primary" onClick={this.onResetBackClick}>
                            {_t("action|go_back")}
                        </AccessibleButton>
                    </div>
                </div>
            );
        } else if (phase === Phase.Busy || phase === Phase.Loading) {
            return <Spinner />;
        } else {
            logger.log(`SetupEncryptionBody: Unknown phase ${phase}`);
        }
    }
}

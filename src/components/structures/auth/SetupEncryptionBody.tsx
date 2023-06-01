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
import { ISecretStorageKeyInfo } from "matrix-js-sdk/src/crypto/api";
import { IKeyBackupInfo } from "matrix-js-sdk/src/crypto/keybackup";
import { VerificationRequest } from "matrix-js-sdk/src/crypto/verification/request/VerificationRequest";
import { logger } from "matrix-js-sdk/src/logger";

import { _t } from "../../../languageHandler";
import { MatrixClientPeg } from "../../../MatrixClientPeg";
import Modal from "../../../Modal";
import VerificationRequestDialog from "../../views/dialogs/VerificationRequestDialog";
import { SetupEncryptionStore, Phase } from "../../../stores/SetupEncryptionStore";
import EncryptionPanel from "../../views/right_panel/EncryptionPanel";
import AccessibleButton, { ButtonEvent } from "../../views/elements/AccessibleButton";
import Spinner from "../../views/elements/Spinner";

function keyHasPassphrase(keyInfo: ISecretStorageKeyInfo): boolean {
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
        const cli = MatrixClientPeg.get();
        const userId = cli.getSafeUserId();
        const requestPromise = cli.requestVerification(userId);

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
        const cli = MatrixClientPeg.get();
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
                        <p>
                            {_t(
                                "It looks like you don't have a Security Key or any other devices you can " +
                                    "verify against.  This device will not be able to access old encrypted messages. " +
                                    "In order to verify your identity on this device, you'll need to reset " +
                                    "your verification keys.",
                            )}
                        </p>

                        <div className="mx_CompleteSecurity_actionRow">
                            <AccessibleButton kind="primary" onClick={this.onResetConfirmClick}>
                                {_t("Proceed with reset")}
                            </AccessibleButton>
                        </div>
                    </div>
                );
            } else {
                const store = SetupEncryptionStore.sharedInstance();
                let recoveryKeyPrompt;
                if (store.keyInfo && keyHasPassphrase(store.keyInfo)) {
                    recoveryKeyPrompt = _t("Verify with Security Key or Phrase");
                } else if (store.keyInfo) {
                    recoveryKeyPrompt = _t("Verify with Security Key");
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
                            {_t("Verify with another device")}
                        </AccessibleButton>
                    );
                }

                return (
                    <div>
                        <p>
                            {_t("Verify your identity to access encrypted messages and prove your identity to others.")}
                        </p>

                        <div className="mx_CompleteSecurity_actionRow">
                            {verifyButton}
                            {useRecoveryKeyButton}
                        </div>
                        <div className="mx_SetupEncryptionBody_reset">
                            {_t("Forgotten or lost all recovery methods? <a>Reset all</a>", undefined, {
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
                message = (
                    <p>
                        {_t(
                            "Your new device is now verified. It has access to your " +
                                "encrypted messages, and other users will see it as trusted.",
                        )}
                    </p>
                );
            } else {
                message = <p>{_t("Your new device is now verified. Other users will see it as trusted.")}</p>;
            }
            return (
                <div>
                    <div className="mx_CompleteSecurity_heroIcon mx_E2EIcon_verified" />
                    {message}
                    <div className="mx_CompleteSecurity_actionRow">
                        <AccessibleButton kind="primary" onClick={this.onDoneClick}>
                            {_t("Done")}
                        </AccessibleButton>
                    </div>
                </div>
            );
        } else if (phase === Phase.ConfirmSkip) {
            return (
                <div>
                    <p>
                        {_t(
                            "Without verifying, you won't have access to all your messages " +
                                "and may appear as untrusted to others.",
                        )}
                    </p>
                    <div className="mx_CompleteSecurity_actionRow">
                        <AccessibleButton kind="danger_outline" onClick={this.onSkipConfirmClick}>
                            {_t("I'll verify later")}
                        </AccessibleButton>
                        <AccessibleButton kind="primary" onClick={this.onSkipBackClick}>
                            {_t("Go Back")}
                        </AccessibleButton>
                    </div>
                </div>
            );
        } else if (phase === Phase.ConfirmReset) {
            return (
                <div>
                    <p>
                        {_t(
                            "Resetting your verification keys cannot be undone. After resetting, " +
                                "you won't have access to old encrypted messages, and any friends who " +
                                "have previously verified you will see security warnings until you " +
                                "re-verify with them.",
                        )}
                    </p>
                    <p>
                        {_t(
                            "Please only proceed if you're sure you've lost all of your other " +
                                "devices and your Security Key.",
                        )}
                    </p>

                    <div className="mx_CompleteSecurity_actionRow">
                        <AccessibleButton kind="danger_outline" onClick={this.onResetConfirmClick}>
                            {_t("Proceed with reset")}
                        </AccessibleButton>
                        <AccessibleButton kind="primary" onClick={this.onResetBackClick}>
                            {_t("Go Back")}
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

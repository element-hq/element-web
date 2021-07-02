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

import React from 'react';
import { _t } from '../../../languageHandler';
import { MatrixClientPeg } from '../../../MatrixClientPeg';
import Modal from '../../../Modal';
import VerificationRequestDialog from '../../views/dialogs/VerificationRequestDialog';
import { SetupEncryptionStore, Phase } from '../../../stores/SetupEncryptionStore';
import { replaceableComponent } from "../../../utils/replaceableComponent";
import { ISecretStorageKeyInfo } from 'matrix-js-sdk';
import EncryptionPanel from "../../views/right_panel/EncryptionPanel";
import AccessibleButton from '../../views/elements/AccessibleButton';
import Spinner from '../../views/elements/Spinner';
import { IKeyBackupInfo } from "matrix-js-sdk/src/crypto/keybackup";
import { VerificationRequest } from "matrix-js-sdk/src/crypto/verification/request/VerificationRequest";

function keyHasPassphrase(keyInfo: ISecretStorageKeyInfo): boolean {
    return Boolean(
        keyInfo.passphrase &&
        keyInfo.passphrase.salt &&
        keyInfo.passphrase.iterations,
    );
}

interface IProps {
    onFinished: (boolean) => void;
}

interface IState {
    phase: Phase;
    verificationRequest: VerificationRequest;
    backupInfo: IKeyBackupInfo;
}

@replaceableComponent("structures.auth.SetupEncryptionBody")
export default class SetupEncryptionBody extends React.Component<IProps, IState> {
    constructor(props) {
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
        };
    }

    private onStoreUpdate = () => {
        const store = SetupEncryptionStore.sharedInstance();
        if (store.phase === Phase.Finished) {
            this.props.onFinished(true);
            return;
        }
        this.setState({
            phase: store.phase,
            verificationRequest: store.verificationRequest,
            backupInfo: store.backupInfo,
        });
    };

    public componentWillUnmount() {
        const store = SetupEncryptionStore.sharedInstance();
        store.off("update", this.onStoreUpdate);
        store.stop();
    }

    private onUsePassphraseClick = async () => {
        const store = SetupEncryptionStore.sharedInstance();
        store.usePassPhrase();
    };

    private onVerifyClick = () => {
        const cli = MatrixClientPeg.get();
        const userId = cli.getUserId();
        const requestPromise = cli.requestVerification(userId);

        this.props.onFinished(true);
        Modal.createTrackedDialog('New Session Verification', 'Starting dialog', VerificationRequestDialog, {
            verificationRequestPromise: requestPromise,
            member: cli.getUser(userId),
            onFinished: async () => {
                const request = await requestPromise;
                request.cancel();
            },
        });
    };

    private onSkipClick = () => {
        const store = SetupEncryptionStore.sharedInstance();
        store.skip();
    };

    private onSkipConfirmClick = () => {
        const store = SetupEncryptionStore.sharedInstance();
        store.skipConfirm();
    };

    private onSkipBackClick = () => {
        const store = SetupEncryptionStore.sharedInstance();
        store.returnAfterSkip();
    };

    private onDoneClick = () => {
        const store = SetupEncryptionStore.sharedInstance();
        store.done();
    };

    private onEncryptionPanelClose = () => {
        this.props.onFinished(false);
    };

    public render() {
        const {
            phase,
        } = this.state;

        if (this.state.verificationRequest) {
            return <EncryptionPanel
                layout="dialog"
                verificationRequest={this.state.verificationRequest}
                onClose={this.onEncryptionPanelClose}
                member={MatrixClientPeg.get().getUser(this.state.verificationRequest.otherUserId)}
                isRoomEncrypted={false}
            />;
        } else if (phase === Phase.Intro) {
            const store = SetupEncryptionStore.sharedInstance();
            let recoveryKeyPrompt;
            if (store.keyInfo && keyHasPassphrase(store.keyInfo)) {
                recoveryKeyPrompt = _t("Use Security Key or Phrase");
            } else if (store.keyInfo) {
                recoveryKeyPrompt = _t("Use Security Key");
            }

            let useRecoveryKeyButton;
            if (recoveryKeyPrompt) {
                useRecoveryKeyButton = <AccessibleButton kind="link" onClick={this.onUsePassphraseClick}>
                    {recoveryKeyPrompt}
                </AccessibleButton>;
            }

            let verifyButton;
            if (store.hasDevicesToVerifyAgainst) {
                verifyButton = <AccessibleButton kind="primary" onClick={this.onVerifyClick}>
                    { _t("Use another login") }
                </AccessibleButton>;
            }

            return (
                <div>
                    <p>{_t(
                        "Verify your identity to access encrypted messages and prove your identity to others.",
                    )}</p>

                    <div className="mx_CompleteSecurity_actionRow">
                        {verifyButton}
                        {useRecoveryKeyButton}
                        <AccessibleButton kind="danger" onClick={this.onSkipClick}>
                            {_t("Skip")}
                        </AccessibleButton>
                    </div>
                </div>
            );
        } else if (phase === Phase.Done) {
            let message;
            if (this.state.backupInfo) {
                message = <p>{_t(
                    "Your new session is now verified. It has access to your " +
                    "encrypted messages, and other users will see it as trusted.",
                )}</p>;
            } else {
                message = <p>{_t(
                    "Your new session is now verified. Other users will see it as trusted.",
                )}</p>;
            }
            return (
                <div>
                    <div className="mx_CompleteSecurity_heroIcon mx_E2EIcon_verified" />
                    {message}
                    <div className="mx_CompleteSecurity_actionRow">
                        <AccessibleButton
                            kind="primary"
                            onClick={this.onDoneClick}
                        >
                            {_t("Done")}
                        </AccessibleButton>
                    </div>
                </div>
            );
        } else if (phase === Phase.ConfirmSkip) {
            return (
                <div>
                    <p>{_t(
                        "Without verifying, you won’t have access to all your messages " +
                        "and may appear as untrusted to others.",
                    )}</p>
                    <div className="mx_CompleteSecurity_actionRow">
                        <AccessibleButton
                            className="warning"
                            kind="secondary"
                            onClick={this.onSkipConfirmClick}
                        >
                            {_t("Skip")}
                        </AccessibleButton>
                        <AccessibleButton
                            kind="danger"
                            onClick={this.onSkipBackClick}
                        >
                            {_t("Go Back")}
                        </AccessibleButton>
                    </div>
                </div>
            );
        } else if (phase === Phase.Busy || phase === Phase.Loading) {
            return <Spinner />;
        } else {
            console.log(`SetupEncryptionBody: Unknown phase ${phase}`);
        }
    }
}

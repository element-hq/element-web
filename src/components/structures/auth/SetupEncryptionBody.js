/*
Copyright 2020 The Matrix.org Foundation C.I.C.

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
import PropTypes from 'prop-types';
import { _t } from '../../../languageHandler';
import SdkConfig from '../../../SdkConfig';
import { MatrixClientPeg } from '../../../MatrixClientPeg';
import * as sdk from '../../../index';
import {
    SetupEncryptionStore,
    PHASE_INTRO,
    PHASE_BUSY,
    PHASE_DONE,
    PHASE_CONFIRM_SKIP,
    PHASE_FINISHED,
} from '../../../stores/SetupEncryptionStore';

function keyHasPassphrase(keyInfo) {
    return (
        keyInfo.passphrase &&
        keyInfo.passphrase.salt &&
        keyInfo.passphrase.iterations
    );
}

export default class SetupEncryptionBody extends React.Component {
    static propTypes = {
        onFinished: PropTypes.func.isRequired,
    };

    constructor() {
        super();
        const store = SetupEncryptionStore.sharedInstance();
        store.on("update", this._onStoreUpdate);
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

    _onStoreUpdate = () => {
        const store = SetupEncryptionStore.sharedInstance();
        if (store.phase === PHASE_FINISHED) {
            this.props.onFinished();
            return;
        }
        this.setState({
            phase: store.phase,
            verificationRequest: store.verificationRequest,
            backupInfo: store.backupInfo,
        });
    };

    componentWillUnmount() {
        const store = SetupEncryptionStore.sharedInstance();
        store.off("update", this._onStoreUpdate);
        store.stop();
    }

    _onUsePassphraseClick = async () => {
        const store = SetupEncryptionStore.sharedInstance();
        store.usePassPhrase();
    }

    onSkipClick = () => {
        const store = SetupEncryptionStore.sharedInstance();
        store.skip();
    }

    onSkipConfirmClick = () => {
        const store = SetupEncryptionStore.sharedInstance();
        store.skipConfirm();
    }

    onSkipBackClick = () => {
        const store = SetupEncryptionStore.sharedInstance();
        store.returnAfterSkip();
    }

    onDoneClick = () => {
        const store = SetupEncryptionStore.sharedInstance();
        store.done();
    }

    render() {
        const AccessibleButton = sdk.getComponent("elements.AccessibleButton");

        const {
            phase,
        } = this.state;

        if (this.state.verificationRequest) {
            const EncryptionPanel = sdk.getComponent("views.right_panel.EncryptionPanel");
            return <EncryptionPanel
                layout="dialog"
                verificationRequest={this.state.verificationRequest}
                onClose={this.props.onFinished}
                member={MatrixClientPeg.get().getUser(this.state.verificationRequest.otherUserId)}
            />;
        } else if (phase === PHASE_INTRO) {
            const store = SetupEncryptionStore.sharedInstance();
            let recoveryKeyPrompt;
            if (store.keyInfo && keyHasPassphrase(store.keyInfo)) {
                recoveryKeyPrompt = _t("Use Recovery Key or Passphrase");
            } else if (store.keyInfo) {
                recoveryKeyPrompt = _t("Use Recovery Key");
            }

            let useRecoveryKeyButton;
            if (recoveryKeyPrompt) {
                useRecoveryKeyButton = <AccessibleButton kind="link" onClick={this._onUsePassphraseClick}>
                    {recoveryKeyPrompt}
                </AccessibleButton>;
            }

            const brand = SdkConfig.get().brand;

            return (
                <div>
                    <p>{_t(
                        "Confirm your identity by verifying this login from one of your other sessions, " +
                        "granting it access to encrypted messages.",
                    )}</p>
                    <p>{_t(
                        "This requires the latest %(brand)s on your other devices:",
                        { brand },
                    )}</p>

                    <div className="mx_CompleteSecurity_clients">
                        <div className="mx_CompleteSecurity_clients_desktop">
                            <div>{_t("%(brand)s Web", { brand })}</div>
                            <div>{_t("%(brand)s Desktop", { brand })}</div>
                        </div>
                        <div className="mx_CompleteSecurity_clients_mobile">
                            <div>{_t("%(brand)s iOS", { brand })}</div>
                            <div>{_t("%(brand)s Android", { brand })}</div>
                        </div>
                        <p>{_t("or another cross-signing capable Matrix client")}</p>
                    </div>

                    <div className="mx_CompleteSecurity_actionRow">
                        {useRecoveryKeyButton}
                        <AccessibleButton kind="danger" onClick={this.onSkipClick}>
                            {_t("Skip")}
                        </AccessibleButton>
                    </div>
                </div>
            );
        } else if (phase === PHASE_DONE) {
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
        } else if (phase === PHASE_CONFIRM_SKIP) {
            return (
                <div>
                    <p>{_t(
                        "Without completing security on this session, it won’t have " +
                        "access to encrypted messages.",
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
        } else if (phase === PHASE_BUSY) {
            const Spinner = sdk.getComponent('views.elements.Spinner');
            return <Spinner />;
        } else {
            console.log(`SetupEncryptionBody: Unknown phase ${phase}`);
        }
    }
}

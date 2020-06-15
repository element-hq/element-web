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
import { MatrixClientPeg } from '../../../MatrixClientPeg';
import * as sdk from '../../../index';
import withValidation from '../../views/elements/Validation';
import { decodeRecoveryKey } from 'matrix-js-sdk/src/crypto/recoverykey';
import {
    SetupEncryptionStore,
    PHASE_INTRO,
    PHASE_RECOVERY_KEY,
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
            recoveryKey: '',
            // whether the recovery key is a valid recovery key
            recoveryKeyValid: null,
            // whether the recovery key is the correct key or not
            recoveryKeyCorrect: null,
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

    _onResetClick = () => {
        const store = SetupEncryptionStore.sharedInstance();
        store.startKeyReset();
    }

    _onUseRecoveryKeyClick = async () => {
        const store = SetupEncryptionStore.sharedInstance();
        store.useRecoveryKey();
    }

    _onRecoveryKeyCancelClick() {
        const store = SetupEncryptionStore.sharedInstance();
        store.cancelUseRecoveryKey();
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

    _onUsePassphraseClick = () => {
        const store = SetupEncryptionStore.sharedInstance();
        store.usePassPhrase();
    }

    _onRecoveryKeyChange = (e) => {
        this.setState({recoveryKey: e.target.value});
    }

    _onRecoveryKeyValidate = async (fieldState) => {
        const result = await this._validateRecoveryKey(fieldState);
        this.setState({recoveryKeyValid: result.valid});
        return result;
    }

    _validateRecoveryKey = withValidation({
        rules: [
            {
                key: "required",
                test: async (state) => {
                    try {
                        const decodedKey = decodeRecoveryKey(state.value);
                        const correct = await MatrixClientPeg.get().checkSecretStorageKey(
                            decodedKey, SetupEncryptionStore.sharedInstance().keyInfo,
                        );
                        this.setState({
                            recoveryKeyValid: true,
                            recoveryKeyCorrect: correct,
                        });
                        return correct;
                    } catch (e) {
                        this.setState({
                            recoveryKeyValid: false,
                            recoveryKeyCorrect: false,
                        });
                        return false;
                    }
                },
                invalid: function() {
                    if (this.state.recoveryKeyValid) {
                        return _t("This isn't the recovery key for your account");
                    } else {
                        return _t("This isn't a valid recovery key");
                    }
                },
                valid: function() {
                    return _t("Looks good!");
                },
            },
        ],
    })

    _onRecoveryKeyFormSubmit = (e) => {
        e.preventDefault();
        if (!this.state.recoveryKeyCorrect) return;

        const store = SetupEncryptionStore.sharedInstance();
        store.setupWithRecoveryKey(decodeRecoveryKey(this.state.recoveryKey));
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
            if (keyHasPassphrase(store.keyInfo)) {
                recoveryKeyPrompt = _t("Use Recovery Key or Passphrase");
            } else {
                recoveryKeyPrompt = _t("Use Recovery Key");
            }
            return (
                <div>
                    <p>{_t(
                        "Confirm your identity by verifying this login from one of your other sessions, " +
                        "granting it access to encrypted messages.",
                    )}</p>
                    <p>{_t(
                        "This requires the latest Riot on your other devices:",
                    )}</p>

                    <div className="mx_CompleteSecurity_clients">
                        <div className="mx_CompleteSecurity_clients_desktop">
                            <div>Riot Web</div>
                            <div>Riot Desktop</div>
                        </div>
                        <div className="mx_CompleteSecurity_clients_mobile">
                            <div>Riot iOS</div>
                            <div>Riot X for Android</div>
                        </div>
                        <p>{_t("or another cross-signing capable Matrix client")}</p>
                    </div>

                    <div className="mx_CompleteSecurity_actionRow">
                        <AccessibleButton kind="link" onClick={this._onUseRecoveryKeyClick}>
                            {recoveryKeyPrompt}
                        </AccessibleButton>
                        <AccessibleButton kind="danger" onClick={this.onSkipClick}>
                            {_t("Skip")}
                        </AccessibleButton>
                    </div>
                    <div className="mx_CompleteSecurity_resetText">{_t(
                        "If you've forgotten your recovery key you can " +
                        "<button>set up new recovery options</button>", {}, {
                            button: sub => <AccessibleButton
                                element="span" className="mx_linkButton" onClick={this._onResetClick}
                            >
                                {sub}
                            </AccessibleButton>,
                        },
                    )}</div>
                </div>
            );
        } else if (phase === PHASE_RECOVERY_KEY) {
            const store = SetupEncryptionStore.sharedInstance();
            let keyPrompt;
            if (keyHasPassphrase(store.keyInfo)) {
                keyPrompt = _t(
                    "Enter your Recovery Key or enter a <a>Recovery Passphrase</a> to continue.", {},
                    {
                        a: sub => <AccessibleButton
                            element="span"
                            className="mx_linkButton"
                            onClick={this._onUsePassphraseClick}
                        >{sub}</AccessibleButton>,
                    },
                );
            } else {
                keyPrompt = _t("Enter your Recovery Key to continue.");
            }

            const Field = sdk.getComponent('elements.Field');
            return <form onSubmit={this._onRecoveryKeyFormSubmit}>
                <p>{keyPrompt}</p>
                <div className="mx_CompleteSecurity_recoveryKeyEntry">
                    <Field
                        type="text"
                        label={_t('Recovery Key')}
                        value={this.state.recoveryKey}
                        onChange={this._onRecoveryKeyChange}
                        onValidate={this._onRecoveryKeyValidate}
                    />
                </div>
                <div className="mx_CompleteSecurity_actionRow">
                    <AccessibleButton kind="secondary" onClick={this._onRecoveryKeyCancelClick}>
                        {_t("Cancel")}
                    </AccessibleButton>
                    <AccessibleButton kind="primary"
                        disabled={!this.state.recoveryKeyCorrect}
                        onClick={this._onRecoveryKeyFormSubmit}
                    >
                        {_t("Continue")}
                    </AccessibleButton>
                </div>
            </form>;
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

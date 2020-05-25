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

import React from 'react';
import PropTypes from "prop-types";
import * as sdk from '../../../../index';
import {MatrixClientPeg} from '../../../../MatrixClientPeg';

import { _t } from '../../../../languageHandler';
import { accessSecretStorage } from '../../../../CrossSigningManager';

/*
 * Access Secure Secret Storage by requesting the user's passphrase.
 */
export default class AccessSecretStorageDialog extends React.PureComponent {
    static propTypes = {
        // { passphrase, pubkey }
        keyInfo: PropTypes.object.isRequired,
        // Function from one of { passphrase, recoveryKey } -> boolean
        checkPrivateKey: PropTypes.func.isRequired,
    }

    constructor(props) {
        super(props);
        this.state = {
            recoveryKey: "",
            recoveryKeyValid: false,
            forceRecoveryKey: false,
            passPhrase: '',
            keyMatches: null,
        };
    }

    _onCancel = () => {
        this.props.onFinished(false);
    }

    _onUseRecoveryKeyClick = () => {
        this.setState({
            forceRecoveryKey: true,
        });
    }

    _onResetRecoveryClick = () => {
        // Re-enter the access flow, but resetting storage this time around.
        this.props.onFinished(false);
        accessSecretStorage(() => {}, /* forceReset = */ true);
    }

    _onRecoveryKeyChange = (e) => {
        this.setState({
            recoveryKey: e.target.value,
            recoveryKeyValid: MatrixClientPeg.get().isValidRecoveryKey(e.target.value),
            keyMatches: null,
        });
    }

    _onPassPhraseNext = async (e) => {
        e.preventDefault();

        if (this.state.passPhrase.length <= 0) return;

        this.setState({ keyMatches: null });
        const input = { passphrase: this.state.passPhrase };
        const keyMatches = await this.props.checkPrivateKey(input);
        if (keyMatches) {
            this.props.onFinished(input);
        } else {
            this.setState({ keyMatches });
        }
    }

    _onRecoveryKeyNext = async (e) => {
        e.preventDefault();

        if (!this.state.recoveryKeyValid) return;

        this.setState({ keyMatches: null });
        const input = { recoveryKey: this.state.recoveryKey };
        const keyMatches = await this.props.checkPrivateKey(input);
        if (keyMatches) {
            this.props.onFinished(input);
        } else {
            this.setState({ keyMatches });
        }
    }

    _onPassPhraseChange = (e) => {
        this.setState({
            passPhrase: e.target.value,
            keyMatches: null,
        });
    }

    render() {
        const BaseDialog = sdk.getComponent('views.dialogs.BaseDialog');

        const hasPassphrase = (
            this.props.keyInfo &&
            this.props.keyInfo.passphrase &&
            this.props.keyInfo.passphrase.salt &&
            this.props.keyInfo.passphrase.iterations
        );

        let content;
        let title;
        if (hasPassphrase && !this.state.forceRecoveryKey) {
            const DialogButtons = sdk.getComponent('views.elements.DialogButtons');
            const AccessibleButton = sdk.getComponent('elements.AccessibleButton');
            title = _t("Enter recovery passphrase");

            let keyStatus;
            if (this.state.keyMatches === false) {
                keyStatus = <div className="mx_AccessSecretStorageDialog_keyStatus">
                    {"\uD83D\uDC4E "}{_t(
                        "Unable to access secret storage. " +
                        "Please verify that you entered the correct recovery passphrase.",
                    )}
                </div>;
            } else {
                keyStatus = <div className="mx_AccessSecretStorageDialog_keyStatus" />;
            }

            content = <div>
                <p>{_t(
                    "<b>Warning</b>: You should only do this on a trusted computer.", {},
                    { b: sub => <b>{sub}</b> },
                )}</p>
                <p>{_t(
                    "Access your secure message history and your cross-signing " +
                    "identity for verifying other sessions by entering your recovery passphrase.",
                )}</p>

                <form className="mx_AccessSecretStorageDialog_primaryContainer" onSubmit={this._onPassPhraseNext}>
                    <input
                        type="password"
                        className="mx_AccessSecretStorageDialog_passPhraseInput"
                        onChange={this._onPassPhraseChange}
                        value={this.state.passPhrase}
                        autoFocus={true}
                        autoComplete="new-password"
                    />
                    {keyStatus}
                    <DialogButtons
                        primaryButton={_t('Next')}
                        onPrimaryButtonClick={this._onPassPhraseNext}
                        hasCancel={true}
                        onCancel={this._onCancel}
                        focus={false}
                        primaryDisabled={this.state.passPhrase.length === 0}
                    />
                </form>
                {_t(
                    "If you've forgotten your recovery passphrase you can "+
                    "<button1>use your recovery key</button1> or " +
                    "<button2>set up new recovery options</button2>."
                , {}, {
                    button1: s => <AccessibleButton className="mx_linkButton"
                        element="span"
                        onClick={this._onUseRecoveryKeyClick}
                    >
                        {s}
                    </AccessibleButton>,
                    button2: s => <AccessibleButton className="mx_linkButton"
                        element="span"
                        onClick={this._onResetRecoveryClick}
                    >
                        {s}
                    </AccessibleButton>,
                })}
            </div>;
        } else {
            title = _t("Enter recovery key");
            const DialogButtons = sdk.getComponent('views.elements.DialogButtons');
            const AccessibleButton = sdk.getComponent('elements.AccessibleButton');

            let keyStatus;
            if (this.state.recoveryKey.length === 0) {
                keyStatus = <div className="mx_AccessSecretStorageDialog_keyStatus" />;
            } else if (this.state.keyMatches === false) {
                keyStatus = <div className="mx_AccessSecretStorageDialog_keyStatus">
                    {"\uD83D\uDC4E "}{_t(
                        "Unable to access secret storage. " +
                        "Please verify that you entered the correct recovery key.",
                    )}
                </div>;
            } else if (this.state.recoveryKeyValid) {
                keyStatus = <div className="mx_AccessSecretStorageDialog_keyStatus">
                    {"\uD83D\uDC4D "}{_t("This looks like a valid recovery key!")}
                </div>;
            } else {
                keyStatus = <div className="mx_AccessSecretStorageDialog_keyStatus">
                    {"\uD83D\uDC4E "}{_t("Not a valid recovery key")}
                </div>;
            }

            content = <div>
                <p>{_t(
                    "<b>Warning</b>: You should only do this on a trusted computer.", {},
                    { b: sub => <b>{sub}</b> },
                )}</p>
                <p>{_t(
                    "Access your secure message history and your cross-signing " +
                    "identity for verifying other sessions by entering your recovery key.",
                )}</p>

                <form className="mx_AccessSecretStorageDialog_primaryContainer" onSubmit={this._onRecoveryKeyNext}>
                    <input className="mx_AccessSecretStorageDialog_recoveryKeyInput"
                        onChange={this._onRecoveryKeyChange}
                        value={this.state.recoveryKey}
                        autoFocus={true}
                    />
                    {keyStatus}
                    <DialogButtons
                        primaryButton={_t('Next')}
                        onPrimaryButtonClick={this._onRecoveryKeyNext}
                        hasCancel={true}
                        onCancel={this._onCancel}
                        focus={false}
                        primaryDisabled={!this.state.recoveryKeyValid}
                    />
                </form>
                {_t(
                    "If you've forgotten your recovery key you can "+
                    "<button>set up new recovery options</button>."
                , {}, {
                    button: s => <AccessibleButton className="mx_linkButton"
                        element="span"
                        onClick={this._onResetRecoveryClick}
                    >
                        {s}
                    </AccessibleButton>,
                })}
            </div>;
        }

        return (
            <BaseDialog className='mx_AccessSecretStorageDialog'
                onFinished={this.props.onFinished}
                title={title}
            >
            <div>
                {content}
            </div>
            </BaseDialog>
        );
    }
}

/*
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

import {MatrixClientPeg} from '../../../MatrixClientPeg';
import { _t } from '../../../languageHandler';
import * as sdk from '../../../index';
import { accessSecretStorage } from '../../../CrossSigningManager';
import Modal from '../../../Modal';

export default class CrossSigningPanel extends React.PureComponent {
    constructor(props) {
        super(props);

        this._unmounted = false;

        this.state = {
            error: null,
            crossSigningPublicKeysOnDevice: false,
            crossSigningPrivateKeysInStorage: false,
            secretStorageKeyInAccount: false,
        };
    }

    componentDidMount() {
        const cli = MatrixClientPeg.get();
        cli.on("accountData", this.onAccountData);
        cli.on("userTrustStatusChanged", this.onStatusChanged);
        cli.on("crossSigning.keysChanged", this.onStatusChanged);
        this._getUpdatedStatus();
    }

    componentWillUnmount() {
        this._unmounted = true;
        const cli = MatrixClientPeg.get();
        if (!cli) return;
        cli.removeListener("accountData", this.onAccountData);
        cli.removeListener("userTrustStatusChanged", this.onStatusChanged);
        cli.removeListener("crossSigning.keysChanged", this.onStatusChanged);
    }

    onAccountData = (event) => {
        const type = event.getType();
        if (type.startsWith("m.cross_signing") || type.startsWith("m.secret_storage")) {
            this._getUpdatedStatus();
        }
    };

    onStatusChanged = () => {
        this._getUpdatedStatus();
    };

    async _getUpdatedStatus() {
        // XXX: Add public accessors if we keep this around in production
        const cli = MatrixClientPeg.get();
        const crossSigning = cli._crypto._crossSigningInfo;
        const secretStorage = cli._crypto._secretStorage;
        const crossSigningPublicKeysOnDevice = crossSigning.getId();
        const crossSigningPrivateKeysInStorage = await crossSigning.isStoredInSecretStorage(secretStorage);
        const secretStorageKeyInAccount = await secretStorage.hasKey();

        this.setState({
            crossSigningPublicKeysOnDevice,
            crossSigningPrivateKeysInStorage,
            secretStorageKeyInAccount,
        });
    }

    /**
     * Bootstrapping secret storage may take one of these paths:
     * 1. Create secret storage from a passphrase and store cross-signing keys
     *    in secret storage.
     * 2. Access existing secret storage by requesting passphrase and accessing
     *    cross-signing keys as needed.
     * 3. All keys are loaded and there's nothing to do.
     * @param {bool} [force] Bootstrap again even if keys already present
     */
    _bootstrapSecureSecretStorage = async (force=false) => {
        this.setState({ error: null });
        try {
            await accessSecretStorage(() => undefined, force);
        } catch (e) {
            this.setState({ error: e });
            console.error("Error bootstrapping secret storage", e);
        }
        if (this._unmounted) return;
        this._getUpdatedStatus();
    }

    onDestroyStorage = (act) => {
        if (!act) return;
        this._bootstrapSecureSecretStorage(true);
    }

    _destroySecureSecretStorage = () => {
        const ConfirmDestoryCrossSigningDialog = sdk.getComponent("dialogs.ConfirmDestroyCrossSigningDialog");
        Modal.createDialog(ConfirmDestoryCrossSigningDialog, {
            onFinished: this.onDestroyStorage,
        });
    }

    render() {
        const AccessibleButton = sdk.getComponent("elements.AccessibleButton");
        const {
            error,
            crossSigningPublicKeysOnDevice,
            crossSigningPrivateKeysInStorage,
            secretStorageKeyInAccount,
        } = this.state;

        let errorSection;
        if (error) {
            errorSection = <div className="error">{error.toString()}</div>;
        }

        const enabled = (
            crossSigningPublicKeysOnDevice &&
            crossSigningPrivateKeysInStorage &&
            secretStorageKeyInAccount
        );

        let summarisedStatus;
        if (enabled) {
            summarisedStatus = <p>✅ {_t(
                "Cross-signing and secret storage are enabled.",
            )}</p>;
        } else if (crossSigningPrivateKeysInStorage) {
            summarisedStatus = <p>{_t(
                "Your account has a cross-signing identity in secret storage, but it " +
                "is not yet trusted by this session.",
            )}</p>;
        } else {
            summarisedStatus = <p>{_t(
                "Cross-signing and secret storage are not yet set up.",
            )}</p>;
        }

        let bootstrapButton;
        if (!enabled) {
            bootstrapButton = <div className="mx_CrossSigningPanel_buttonRow">
                <AccessibleButton kind="primary" onClick={this._bootstrapSecureSecretStorage}>
                    {_t("Bootstrap cross-signing and secret storage")}
                </AccessibleButton>
            </div>;
        } else {
            bootstrapButton = <div className="mx_CrossSigningPanel_buttonRow">
                <AccessibleButton kind="danger" onClick={this._destroySecureSecretStorage}>
                    {_t("Reset cross-signing and secret storage")}
                </AccessibleButton>
            </div>;
        }

        return (
            <div>
                {summarisedStatus}
                <details>
                    <summary>{_t("Advanced")}</summary>
                    <table className="mx_CrossSigningPanel_statusList"><tbody>
                        <tr>
                            <td>{_t("Cross-signing public keys:")}</td>
                            <td>{crossSigningPublicKeysOnDevice ? _t("in memory") : _t("not found")}</td>
                        </tr>
                        <tr>
                            <td>{_t("Cross-signing private keys:")}</td>
                            <td>{crossSigningPrivateKeysInStorage ? _t("in secret storage") : _t("not found")}</td>
                        </tr>
                        <tr>
                            <td>{_t("Secret storage public key:")}</td>
                            <td>{secretStorageKeyInAccount ? _t("in account data") : _t("not found")}</td>
                        </tr>
                    </tbody></table>
                </details>
                {errorSection}
                {bootstrapButton}
            </div>
        );
    }
}

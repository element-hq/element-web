/*
Copyright 2019 The Matrix.org Foundation C.I.C.

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

import MatrixClientPeg from '../../../MatrixClientPeg';
import { _t } from '../../../languageHandler';
import sdk from '../../../index';
import Modal from '../../../Modal';

export default class CrossSigningPanel extends React.PureComponent {
    constructor(props) {
        super(props);

        this._unmounted = false;

        this.state = {
            error: null,
            ...this._getUpdatedStatus(),
        };
    }

    componentDidMount() {
        const cli = MatrixClientPeg.get();
        cli.on("accountData", this.onAccountData);
    }

    componentWillUnmount() {
        this._unmounted = true;
        const cli = MatrixClientPeg.get();
        if (!cli) return;
        cli.removeListener("accountData", this.onAccountData);
    }

    onAccountData = (event) => {
        const type = event.getType();
        if (type.startsWith("m.cross_signing") || type.startsWith("m.secret_storage")) {
            this.setState(this._getUpdatedStatus());
        }
    };

    _getUpdatedStatus() {
        // XXX: Add public accessors if we keep this around in production
        const cli = MatrixClientPeg.get();
        const crossSigning = cli._crypto._crossSigningInfo;
        const secretStorage = cli._crypto._secretStorage;
        const crossSigningPublicKeysOnDevice = crossSigning.getId();
        const crossSigningPrivateKeysInStorage = crossSigning.isStoredInSecretStorage(secretStorage);
        const secretStorageKeyInAccount = secretStorage.hasKey();

        return {
            crossSigningPublicKeysOnDevice,
            crossSigningPrivateKeysInStorage,
            secretStorageKeyInAccount,
        };
    }

    /**
     * Bootstrapping secret storage may take one of these paths:
     * 1. Create secret storage from a passphrase and store cross-signing keys
     *    in secret storage.
     * 2. Access existing secret storage by requesting passphrase and accessing
     *    cross-signing keys as needed.
     * 3. All keys are loaded and there's nothing to do.
     */
    _bootstrapSecureSecretStorage = async () => {
        this.setState({ error: null });
        const cli = MatrixClientPeg.get();
        try {
            if (!cli.hasSecretStorageKey()) {
                // This dialog calls bootstrap itself after guiding the user through
                // passphrase creation.
                const { finished } = Modal.createTrackedDialogAsync('Create Secret Storage dialog', '',
                    import("../../../async-components/views/dialogs/secretstorage/CreateSecretStorageDialog"),
                    null, null, /* priority = */ false, /* static = */ true,
                );
                const [confirmed] = await finished;
                if (!confirmed) {
                    throw new Error("Secret storage creation canceled");
                }
            } else {
                const InteractiveAuthDialog = sdk.getComponent("dialogs.InteractiveAuthDialog");
                await cli.bootstrapSecretStorage({
                    authUploadDeviceSigningKeys: async (makeRequest) => {
                        const { finished } = Modal.createTrackedDialog(
                            'Cross-signing keys dialog', '', InteractiveAuthDialog,
                            {
                                title: _t("Send cross-signing keys to homeserver"),
                                matrixClient: MatrixClientPeg.get(),
                                makeRequest,
                            },
                        );
                        const [confirmed] = await finished;
                        if (!confirmed) {
                            throw new Error("Cross-signing key upload auth canceled");
                        }
                    },
                });
            }
        } catch (e) {
            this.setState({ error: e });
            console.error("Error bootstrapping secret storage", e);
        }
        if (this._unmounted) return;
        this.setState(this._getUpdatedStatus());
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

        return (
            <div>
                <table className="mx_CrossSigningPanel_statusList"><tbody>
                    <tr>
                        <td>{_t("Cross-signing public keys:")}</td>
                        <td>{crossSigningPublicKeysOnDevice ? _t("on device") : _t("not found")}</td>
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
                <div className="mx_CrossSigningPanel_buttonRow">
                    <AccessibleButton kind="primary" onClick={this._bootstrapSecureSecretStorage}>
                        {_t("Bootstrap Secure Secret Storage")}
                    </AccessibleButton>
                </div>
                {errorSection}
            </div>
        );
    }
}

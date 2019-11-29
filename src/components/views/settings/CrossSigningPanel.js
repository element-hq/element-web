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
        this.state = this._getUpdatedStatus();
    }

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

    _bootstrapSecureSecretStorage = async () => {
        try {
            const InteractiveAuthDialog = sdk.getComponent("dialogs.InteractiveAuthDialog");
            await MatrixClientPeg.get().bootstrapSecretStorage({
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
            this.setState(this._getUpdatedStatus());
        } catch (e) {
            console.error(e);
        }
    }

    render() {
        const AccessibleButton = sdk.getComponent("elements.AccessibleButton");
        const {
            crossSigningPublicKeysOnDevice,
            crossSigningPrivateKeysInStorage,
            secretStorageKeyInAccount,
        } = this.state;

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
            </div>
        );
    }
}

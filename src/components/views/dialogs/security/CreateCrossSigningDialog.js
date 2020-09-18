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
import PropTypes from 'prop-types';
import { MatrixClientPeg } from '../../../../MatrixClientPeg';
import { _t } from '../../../../languageHandler';
import Modal from '../../../../Modal';
import { SSOAuthEntry } from '../../auth/InteractiveAuthEntryComponents';
import DialogButtons from '../../elements/DialogButtons';
import BaseDialog from '../BaseDialog';
import Spinner from '../../elements/Spinner';
import InteractiveAuthDialog from '../InteractiveAuthDialog';

/*
 * Walks the user through the process of creating a cross-signing keys. In most
 * cases, only a spinner is shown, but for more complex auth like SSO, the user
 * may need to complete some steps to proceed.
 */
export default class CreateCrossSigningDialog extends React.PureComponent {
    static propTypes = {
        accountPassword: PropTypes.string,
    };

    constructor(props) {
        super(props);

        this.state = {
            error: null,
            // Does the server offer a UI auth flow with just m.login.password
            // for /keys/device_signing/upload?
            canUploadKeysWithPasswordOnly: null,
            accountPassword: props.accountPassword || "",
        };

        if (this.state.accountPassword) {
            // If we have an account password in memory, let's simplify and
            // assume it means password auth is also supported for device
            // signing key upload as well. This avoids hitting the server to
            // test auth flows, which may be slow under high load.
            this.state.canUploadKeysWithPasswordOnly = true;
        } else {
            this._queryKeyUploadAuth();
        }
    }

    componentDidMount() {
        this._bootstrapCrossSigning();
    }

    async _queryKeyUploadAuth() {
        try {
            await MatrixClientPeg.get().uploadDeviceSigningKeys(null, {});
            // We should never get here: the server should always require
            // UI auth to upload device signing keys. If we do, we upload
            // no keys which would be a no-op.
            console.log("uploadDeviceSigningKeys unexpectedly succeeded without UI auth!");
        } catch (error) {
            if (!error.data || !error.data.flows) {
                console.log("uploadDeviceSigningKeys advertised no flows!");
                return;
            }
            const canUploadKeysWithPasswordOnly = error.data.flows.some(f => {
                return f.stages.length === 1 && f.stages[0] === 'm.login.password';
            });
            this.setState({
                canUploadKeysWithPasswordOnly,
            });
        }
    }

    _doBootstrapUIAuth = async (makeRequest) => {
        if (this.state.canUploadKeysWithPasswordOnly && this.state.accountPassword) {
            await makeRequest({
                type: 'm.login.password',
                identifier: {
                    type: 'm.id.user',
                    user: MatrixClientPeg.get().getUserId(),
                },
                // TODO: Remove `user` once servers support proper UIA
                // See https://github.com/matrix-org/synapse/issues/5665
                user: MatrixClientPeg.get().getUserId(),
                password: this.state.accountPassword,
            });
        } else {
            const dialogAesthetics = {
                [SSOAuthEntry.PHASE_PREAUTH]: {
                    title: _t("Use Single Sign On to continue"),
                    body: _t("To continue, use Single Sign On to prove your identity."),
                    continueText: _t("Single Sign On"),
                    continueKind: "primary",
                },
                [SSOAuthEntry.PHASE_POSTAUTH]: {
                    title: _t("Confirm encryption setup"),
                    body: _t("Click the button below to confirm setting up encryption."),
                    continueText: _t("Confirm"),
                    continueKind: "primary",
                },
            };

            const { finished } = Modal.createTrackedDialog(
                'Cross-signing keys dialog', '', InteractiveAuthDialog,
                {
                    title: _t("Setting up keys"),
                    matrixClient: MatrixClientPeg.get(),
                    makeRequest,
                    aestheticsForStagePhases: {
                        [SSOAuthEntry.LOGIN_TYPE]: dialogAesthetics,
                        [SSOAuthEntry.UNSTABLE_LOGIN_TYPE]: dialogAesthetics,
                    },
                },
            );
            const [confirmed] = await finished;
            if (!confirmed) {
                throw new Error("Cross-signing key upload auth canceled");
            }
        }
    }

    _bootstrapCrossSigning = async () => {
        this.setState({
            error: null,
        });

        const cli = MatrixClientPeg.get();

        try {
            await cli.bootstrapCrossSigning({
                authUploadDeviceSigningKeys: this._doBootstrapUIAuth,
            });
            this.props.onFinished(true);
        } catch (e) {
            this.setState({ error: e });
            console.error("Error bootstrapping cross-signing", e);
        }
    }

    _onCancel = () => {
        this.props.onFinished(false);
    }

    render() {
        let content;
        if (this.state.error) {
            content = <div>
                <p>{_t("Unable to set up keys")}</p>
                <div className="mx_Dialog_buttons">
                    <DialogButtons primaryButton={_t('Retry')}
                        onPrimaryButtonClick={this._bootstrapCrossSigning}
                        onCancel={this._onCancel}
                    />
                </div>
            </div>;
        } else {
            content = <div>
                <Spinner />
            </div>;
        }

        return (
            <BaseDialog className="mx_CreateCrossSigningDialog"
                onFinished={this.props.onFinished}
                title={_t("Setting up keys")}
                hasCancel={false}
                fixedWidth={false}
            >
                <div>
                    {content}
                </div>
            </BaseDialog>
        );
    }
}

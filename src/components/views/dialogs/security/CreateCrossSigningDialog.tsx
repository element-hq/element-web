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

import React from "react";
import { CrossSigningKeys } from "matrix-js-sdk/src/client";
import { logger } from "matrix-js-sdk/src/logger";
import { UIAFlow } from "matrix-js-sdk/src/matrix";

import { MatrixClientPeg } from "../../../../MatrixClientPeg";
import { _t } from "../../../../languageHandler";
import Modal from "../../../../Modal";
import { SSOAuthEntry } from "../../auth/InteractiveAuthEntryComponents";
import DialogButtons from "../../elements/DialogButtons";
import BaseDialog from "../BaseDialog";
import Spinner from "../../elements/Spinner";
import InteractiveAuthDialog from "../InteractiveAuthDialog";

interface IProps {
    accountPassword?: string;
    tokenLogin?: boolean;
    onFinished: (success?: boolean) => void;
}

interface IState {
    error: Error | null;
    canUploadKeysWithPasswordOnly: boolean | null;
    accountPassword: string;
}

/*
 * Walks the user through the process of creating a cross-signing keys. In most
 * cases, only a spinner is shown, but for more complex auth like SSO, the user
 * may need to complete some steps to proceed.
 */
export default class CreateCrossSigningDialog extends React.PureComponent<IProps, IState> {
    public constructor(props: IProps) {
        super(props);

        this.state = {
            error: null,
            // Does the server offer a UI auth flow with just m.login.password
            // for /keys/device_signing/upload?
            // If we have an account password in memory, let's simplify and
            // assume it means password auth is also supported for device
            // signing key upload as well. This avoids hitting the server to
            // test auth flows, which may be slow under high load.
            canUploadKeysWithPasswordOnly: props.accountPassword ? true : null,
            accountPassword: props.accountPassword || "",
        };

        if (!this.state.accountPassword) {
            this.queryKeyUploadAuth();
        }
    }

    public componentDidMount(): void {
        this.bootstrapCrossSigning();
    }

    private async queryKeyUploadAuth(): Promise<void> {
        try {
            await MatrixClientPeg.get().uploadDeviceSigningKeys(undefined, {} as CrossSigningKeys);
            // We should never get here: the server should always require
            // UI auth to upload device signing keys. If we do, we upload
            // no keys which would be a no-op.
            logger.log("uploadDeviceSigningKeys unexpectedly succeeded without UI auth!");
        } catch (error) {
            if (!error.data || !error.data.flows) {
                logger.log("uploadDeviceSigningKeys advertised no flows!");
                return;
            }
            const canUploadKeysWithPasswordOnly = error.data.flows.some((f: UIAFlow) => {
                return f.stages.length === 1 && f.stages[0] === "m.login.password";
            });
            this.setState({
                canUploadKeysWithPasswordOnly,
            });
        }
    }

    private doBootstrapUIAuth = async (makeRequest: (authData: any) => Promise<{}>): Promise<void> => {
        if (this.state.canUploadKeysWithPasswordOnly && this.state.accountPassword) {
            await makeRequest({
                type: "m.login.password",
                identifier: {
                    type: "m.id.user",
                    user: MatrixClientPeg.get().getUserId(),
                },
                // TODO: Remove `user` once servers support proper UIA
                // See https://github.com/matrix-org/synapse/issues/5665
                user: MatrixClientPeg.get().getUserId(),
                password: this.state.accountPassword,
            });
        } else if (this.props.tokenLogin) {
            // We are hoping the grace period is active
            await makeRequest({});
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

            const { finished } = Modal.createDialog(InteractiveAuthDialog, {
                title: _t("Setting up keys"),
                matrixClient: MatrixClientPeg.get(),
                makeRequest,
                aestheticsForStagePhases: {
                    [SSOAuthEntry.LOGIN_TYPE]: dialogAesthetics,
                    [SSOAuthEntry.UNSTABLE_LOGIN_TYPE]: dialogAesthetics,
                },
            });
            const [confirmed] = await finished;
            if (!confirmed) {
                throw new Error("Cross-signing key upload auth canceled");
            }
        }
    };

    private bootstrapCrossSigning = async (): Promise<void> => {
        this.setState({
            error: null,
        });

        const cli = MatrixClientPeg.get();

        try {
            await cli.bootstrapCrossSigning({
                authUploadDeviceSigningKeys: this.doBootstrapUIAuth,
            });
            this.props.onFinished(true);
        } catch (e) {
            if (this.props.tokenLogin) {
                // ignore any failures, we are relying on grace period here
                this.props.onFinished(false);
                return;
            }

            this.setState({ error: e });
            logger.error("Error bootstrapping cross-signing", e);
        }
    };

    private onCancel = (): void => {
        this.props.onFinished(false);
    };

    public render(): React.ReactNode {
        let content;
        if (this.state.error) {
            content = (
                <div>
                    <p>{_t("Unable to set up keys")}</p>
                    <div className="mx_Dialog_buttons">
                        <DialogButtons
                            primaryButton={_t("Retry")}
                            onPrimaryButtonClick={this.bootstrapCrossSigning}
                            onCancel={this.onCancel}
                        />
                    </div>
                </div>
            );
        } else {
            content = (
                <div>
                    <Spinner />
                </div>
            );
        }

        return (
            <BaseDialog
                className="mx_CreateCrossSigningDialog"
                onFinished={this.props.onFinished}
                title={_t("Setting up keys")}
                hasCancel={false}
                fixedWidth={false}
            >
                <div>{content}</div>
            </BaseDialog>
        );
    }
}

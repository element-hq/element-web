/*
Copyright 2019 New Vector Ltd
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

import React from "react";

import dis from "../../../../dispatcher/dispatcher";
import { _t } from "../../../../languageHandler";
import Modal, { ComponentType } from "../../../../Modal";
import { Action } from "../../../../dispatcher/actions";
import BaseDialog from "../../../../components/views/dialogs/BaseDialog";
import DialogButtons from "../../../../components/views/elements/DialogButtons";

interface IProps {
    onFinished(): void;
}

export default class RecoveryMethodRemovedDialog extends React.PureComponent<IProps> {
    private onGoToSettingsClick = (): void => {
        this.props.onFinished();
        dis.fire(Action.ViewUserSettings);
    };

    private onSetupClick = (): void => {
        this.props.onFinished();
        Modal.createDialogAsync(
            import("./CreateKeyBackupDialog") as unknown as Promise<ComponentType>,
            undefined,
            undefined,
            /* priority = */ false,
            /* static = */ true,
        );
    };

    public render(): React.ReactNode {
        const title = <span className="mx_KeyBackupFailedDialog_title">{_t("Recovery Method Removed")}</span>;

        return (
            <BaseDialog className="mx_KeyBackupFailedDialog" onFinished={this.props.onFinished} title={title}>
                <div>
                    <p>
                        {_t(
                            "This session has detected that your Security Phrase and key " +
                                "for Secure Messages have been removed.",
                        )}
                    </p>
                    <p>
                        {_t(
                            "If you did this accidentally, you can setup Secure Messages on " +
                                "this session which will re-encrypt this session's message " +
                                "history with a new recovery method.",
                        )}
                    </p>
                    <p className="warning">
                        {_t(
                            "If you didn't remove the recovery method, an " +
                                "attacker may be trying to access your account. " +
                                "Change your account password and set a new recovery " +
                                "method immediately in Settings.",
                        )}
                    </p>
                    <DialogButtons
                        primaryButton={_t("Set up Secure Messages")}
                        onPrimaryButtonClick={this.onSetupClick}
                        cancelButton={_t("Go to Settings")}
                        onCancel={this.onGoToSettingsClick}
                    />
                </div>
            </BaseDialog>
        );
    }
}

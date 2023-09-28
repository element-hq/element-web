/*
Copyright 2018, 2019 New Vector Ltd
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
import { IKeyBackupInfo } from "matrix-js-sdk/src/crypto/keybackup";

import { MatrixClientPeg } from "../../../../MatrixClientPeg";
import dis from "../../../../dispatcher/dispatcher";
import { _t } from "../../../../languageHandler";
import Modal from "../../../../Modal";
import RestoreKeyBackupDialog from "../../../../components/views/dialogs/security/RestoreKeyBackupDialog";
import { Action } from "../../../../dispatcher/actions";
import DialogButtons from "../../../../components/views/elements/DialogButtons";
import BaseDialog from "../../../../components/views/dialogs/BaseDialog";

interface IProps {
    newVersionInfo: IKeyBackupInfo;
    onFinished(): void;
}

export default class NewRecoveryMethodDialog extends React.PureComponent<IProps> {
    private onOkClick = (): void => {
        this.props.onFinished();
    };

    private onGoToSettingsClick = (): void => {
        this.props.onFinished();
        dis.fire(Action.ViewUserSettings);
    };

    private onSetupClick = async (): Promise<void> => {
        Modal.createDialog(
            RestoreKeyBackupDialog,
            {
                onFinished: this.props.onFinished,
            },
            undefined,
            /* priority = */ false,
            /* static = */ true,
        );
    };

    public render(): React.ReactNode {
        const title = (
            <span className="mx_KeyBackupFailedDialog_title">
                {_t("encryption|new_recovery_method_detected|title")}
            </span>
        );

        const newMethodDetected = <p>{_t("encryption|new_recovery_method_detected|description_1")}</p>;

        const hackWarning = <p className="warning">{_t("encryption|new_recovery_method_detected|warning")}</p>;

        let content: JSX.Element | undefined;
        if (MatrixClientPeg.safeGet().getKeyBackupEnabled()) {
            content = (
                <div>
                    {newMethodDetected}
                    <p>{_t("encryption|new_recovery_method_detected|description_2")}</p>
                    {hackWarning}
                    <DialogButtons
                        primaryButton={_t("action|ok")}
                        onPrimaryButtonClick={this.onOkClick}
                        cancelButton={_t("common|go_to_settings")}
                        onCancel={this.onGoToSettingsClick}
                    />
                </div>
            );
        } else {
            content = (
                <div>
                    {newMethodDetected}
                    {hackWarning}
                    <DialogButtons
                        primaryButton={_t("common|setup_secure_messages")}
                        onPrimaryButtonClick={this.onSetupClick}
                        cancelButton={_t("common|go_to_settings")}
                        onCancel={this.onGoToSettingsClick}
                    />
                </div>
            );
        }

        return (
            <BaseDialog className="mx_KeyBackupFailedDialog" onFinished={this.props.onFinished} title={title}>
                {content}
            </BaseDialog>
        );
    }
}

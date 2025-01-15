/*
Copyright 2024 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.
Copyright 2019 New Vector Ltd

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { lazy } from "react";

import dis from "../../../../dispatcher/dispatcher";
import { _t } from "../../../../languageHandler";
import Modal from "../../../../Modal";
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
        Modal.createDialog(
            lazy(() => import("./CreateKeyBackupDialog")),
            undefined,
            undefined,
            /* priority = */ false,
            /* static = */ true,
        );
    };

    public render(): React.ReactNode {
        const title = (
            <span className="mx_KeyBackupFailedDialog_title">{_t("encryption|recovery_method_removed|title")}</span>
        );

        return (
            <BaseDialog className="mx_KeyBackupFailedDialog" onFinished={this.props.onFinished} title={title}>
                <div>
                    <p>{_t("encryption|recovery_method_removed|description_1")}</p>
                    <p>{_t("encryption|recovery_method_removed|description_2")}</p>
                    <strong className="warning">{_t("encryption|recovery_method_removed|warning")}</strong>
                    <DialogButtons
                        primaryButton={_t("common|setup_secure_messages")}
                        onPrimaryButtonClick={this.onSetupClick}
                        cancelButton={_t("common|go_to_settings")}
                        onCancel={this.onGoToSettingsClick}
                    />
                </div>
            </BaseDialog>
        );
    }
}

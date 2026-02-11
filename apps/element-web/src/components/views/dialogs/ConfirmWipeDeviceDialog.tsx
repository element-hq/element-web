/*
Copyright 2024 New Vector Ltd.
Copyright 2019 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";

import { _t } from "../../../languageHandler";
import BaseDialog from "./BaseDialog";
import DialogButtons from "../elements/DialogButtons";

interface IProps {
    onFinished: (success?: boolean) => void;
}

export default class ConfirmWipeDeviceDialog extends React.Component<IProps> {
    private onConfirm = (): void => {
        this.props.onFinished(true);
    };

    private onDecline = (): void => {
        this.props.onFinished(false);
    };

    public render(): React.ReactNode {
        return (
            <BaseDialog
                className="mx_ConfirmWipeDeviceDialog"
                hasCancel={true}
                onFinished={this.props.onFinished}
                title={_t("auth|soft_logout|clear_data_title")}
            >
                <div className="mx_ConfirmWipeDeviceDialog_content">
                    <p>{_t("auth|soft_logout|clear_data_description")}</p>
                </div>
                <DialogButtons
                    primaryButton={_t("auth|soft_logout|clear_data_button")}
                    onPrimaryButtonClick={this.onConfirm}
                    primaryButtonClass="danger"
                    cancelButton={_t("action|cancel")}
                    onCancel={this.onDecline}
                />
            </BaseDialog>
        );
    }
}

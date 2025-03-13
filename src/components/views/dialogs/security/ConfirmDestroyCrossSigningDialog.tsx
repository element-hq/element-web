/*
Copyright 2024 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";

import { _t } from "../../../../languageHandler";
import BaseDialog from "../BaseDialog";
import DialogButtons from "../../elements/DialogButtons";

interface IProps {
    onFinished: (success?: boolean) => void;
}

export default class ConfirmDestroyCrossSigningDialog extends React.Component<IProps> {
    private onConfirm = (): void => {
        this.props.onFinished(true);
    };

    private onDecline = (): void => {
        this.props.onFinished(false);
    };

    public render(): React.ReactNode {
        return (
            <BaseDialog
                className="mx_ConfirmDestroyCrossSigningDialog"
                hasCancel={true}
                onFinished={this.props.onFinished}
                title={_t("encryption|destroy_cross_signing_dialog|title")}
            >
                <div className="mx_ConfirmDestroyCrossSigningDialog_content">
                    <p>{_t("encryption|destroy_cross_signing_dialog|warning")}</p>
                </div>
                <DialogButtons
                    primaryButton={_t("encryption|destroy_cross_signing_dialog|primary_button_text")}
                    onPrimaryButtonClick={this.onConfirm}
                    primaryButtonClass="danger"
                    cancelButton={_t("action|cancel")}
                    onCancel={this.onDecline}
                />
            </BaseDialog>
        );
    }
}

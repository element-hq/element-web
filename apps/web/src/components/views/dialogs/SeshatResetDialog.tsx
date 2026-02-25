/*
Copyright 2024 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";

import { _t } from "../../../languageHandler";
import BaseDialog from "./BaseDialog";
import DialogButtons from "../elements/DialogButtons";

interface Props {
    onFinished(reset?: boolean): void;
}

export default class SeshatResetDialog extends React.PureComponent<Props> {
    public render(): React.ReactNode {
        return (
            <BaseDialog
                hasCancel={true}
                onFinished={this.props.onFinished.bind(null, false)}
                title={_t("seshat|reset_title")}
            >
                <div>
                    <p>
                        {_t("seshat|reset_description")}
                        <br />
                        {_t("seshat|reset_explainer")}
                    </p>
                </div>
                <DialogButtons
                    primaryButton={_t("seshat|reset_button")}
                    onPrimaryButtonClick={this.props.onFinished.bind(null, true)}
                    primaryButtonClass="danger"
                    cancelButton={_t("action|cancel")}
                    onCancel={this.props.onFinished.bind(null, false)}
                />
            </BaseDialog>
        );
    }
}

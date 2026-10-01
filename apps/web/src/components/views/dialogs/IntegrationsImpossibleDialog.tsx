/*
Copyright 2024 New Vector Ltd.
Copyright 2019, 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";

import { _t } from "../../../languageHandler";
import SdkConfig from "../../../SdkConfig";
import BaseDialog from "./BaseDialog";
import DialogButtons from "../elements/DialogButtons";

interface IProps {
    onFinished(): void;
}

export default class IntegrationsImpossibleDialog extends React.Component<IProps> {
    private onAcknowledgeClick = (): void => {
        this.props.onFinished();
    };

    public render(): React.ReactNode {
        const brand = SdkConfig.get().brand;

        return (
            <BaseDialog
                className="mx_IntegrationsImpossibleDialog"
                hasCancel={false}
                onFinished={this.props.onFinished}
                title={_t("integrations|impossible_dialog_title")}
            >
                <div className="mx_IntegrationsImpossibleDialog_content">
                    <p>{_t("integrations|impossible_dialog_description", { brand })}</p>
                </div>
                <DialogButtons
                    primaryButton={_t("action|ok")}
                    onPrimaryButtonClick={this.onAcknowledgeClick}
                    hasCancel={false}
                />
            </BaseDialog>
        );
    }
}

/*
Copyright 2024 New Vector Ltd.
Copyright 2019 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";

import { _t } from "../../../languageHandler";
import dis from "../../../dispatcher/dispatcher";
import { Action } from "../../../dispatcher/actions";
import BaseDialog from "./BaseDialog";
import DialogButtons from "../elements/DialogButtons";

interface IProps {
    onFinished(): void;
}

export default class IntegrationsDisabledDialog extends React.Component<IProps> {
    private onAcknowledgeClick = (): void => {
        this.props.onFinished();
    };

    private onOpenSettingsClick = (): void => {
        this.props.onFinished();
        dis.fire(Action.ViewUserSettings);
    };

    public render(): React.ReactNode {
        return (
            <BaseDialog
                className="mx_IntegrationsDisabledDialog"
                hasCancel={true}
                onFinished={this.props.onFinished}
                title={_t("integrations|disabled_dialog_title")}
            >
                <div className="mx_IntegrationsDisabledDialog_content">
                    <p>
                        {_t("integrations|disabled_dialog_description", {
                            manageIntegrations: _t("integration_manager|manage_title"),
                        })}
                    </p>
                </div>
                <DialogButtons
                    primaryButton={_t("common|settings")}
                    onPrimaryButtonClick={this.onOpenSettingsClick}
                    cancelButton={_t("action|ok")}
                    onCancel={this.onAcknowledgeClick}
                />
            </BaseDialog>
        );
    }
}

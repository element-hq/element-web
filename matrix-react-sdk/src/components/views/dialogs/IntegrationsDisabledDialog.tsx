/*
Copyright 2019 The Matrix.org Foundation C.I.C.

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
                title={_t("Integrations are disabled")}
            >
                <div className="mx_IntegrationsDisabledDialog_content">
                    <p>
                        {_t("Enable '%(manageIntegrations)s' in Settings to do this.", {
                            manageIntegrations: _t("Manage integrations"),
                        })}
                    </p>
                </div>
                <DialogButtons
                    primaryButton={_t("Settings")}
                    onPrimaryButtonClick={this.onOpenSettingsClick}
                    cancelButton={_t("OK")}
                    onCancel={this.onAcknowledgeClick}
                />
            </BaseDialog>
        );
    }
}

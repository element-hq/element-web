/*
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
                title={_t("Integrations not allowed")}
            >
                <div className="mx_IntegrationsImpossibleDialog_content">
                    <p>
                        {_t(
                            "Your %(brand)s doesn't allow you to use an integration manager to do this. " +
                                "Please contact an admin.",
                            { brand },
                        )}
                    </p>
                </div>
                <DialogButtons
                    primaryButton={_t("OK")}
                    onPrimaryButtonClick={this.onAcknowledgeClick}
                    hasCancel={false}
                />
            </BaseDialog>
        );
    }
}

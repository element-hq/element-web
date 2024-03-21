/*
Copyright 2021 The Matrix.org Foundation C.I.C.

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

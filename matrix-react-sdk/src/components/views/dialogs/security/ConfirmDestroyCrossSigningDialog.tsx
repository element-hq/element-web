/*
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
                title={_t("Destroy cross-signing keys?")}
            >
                <div className="mx_ConfirmDestroyCrossSigningDialog_content">
                    <p>
                        {_t(
                            "Deleting cross-signing keys is permanent. " +
                                "Anyone you have verified with will see security alerts. " +
                                "You almost certainly don't want to do this, unless " +
                                "you've lost every device you can cross-sign from.",
                        )}
                    </p>
                </div>
                <DialogButtons
                    primaryButton={_t("Clear cross-signing keys")}
                    onPrimaryButtonClick={this.onConfirm}
                    primaryButtonClass="danger"
                    cancelButton={_t("Cancel")}
                    onCancel={this.onDecline}
                />
            </BaseDialog>
        );
    }
}

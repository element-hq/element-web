/*
Copyright 2018 New Vector Ltd

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
import PropTypes from "prop-types";
import * as sdk from "../../../../index";
import { _t } from "../../../../languageHandler";

export default class IgnoreRecoveryReminderDialog extends React.PureComponent {
    static propTypes = {
        onDontAskAgain: PropTypes.func.isRequired,
        onFinished: PropTypes.func.isRequired,
        onSetup: PropTypes.func.isRequired,
    }

    onDontAskAgainClick = () => {
        this.props.onFinished();
        this.props.onDontAskAgain();
    }

    onSetupClick = () => {
        this.props.onFinished();
        this.props.onSetup();
    }

    render() {
        const BaseDialog = sdk.getComponent("views.dialogs.BaseDialog");
        const DialogButtons = sdk.getComponent("views.elements.DialogButtons");

        return (
            <BaseDialog className="mx_IgnoreRecoveryReminderDialog"
                onFinished={this.props.onFinished}
                title={_t("Are you sure?")}
            >
                <div>
                    <p>{_t(
                        "Without setting up Secure Message Recovery, " +
                        "you'll lose your secure message history when you " +
                        "log out.",
                    )}</p>
                    <p>{_t(
                        "If you don't want to set this up now, you can later " +
                        "in Settings.",
                    )}</p>
                    <div className="mx_Dialog_buttons">
                        <DialogButtons
                            primaryButton={_t("Set up")}
                            onPrimaryButtonClick={this.onSetupClick}
                            cancelButton={_t("Don't ask again")}
                            onCancel={this.onDontAskAgainClick}
                        />
                    </div>
                </div>
            </BaseDialog>
        );
    }
}

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

import React from 'react';
import PropTypes from 'prop-types';
import {_t} from "../../../languageHandler";
import * as sdk from "../../../index";

export default class ConfirmDestroyCrossSigningDialog extends React.Component {
    static propTypes = {
        onFinished: PropTypes.func.isRequired,
    };

    _onConfirm = () => {
        this.props.onFinished(true);
    };

    _onDecline = () => {
        this.props.onFinished(false);
    };

    render() {
        const BaseDialog = sdk.getComponent('views.dialogs.BaseDialog');
        const DialogButtons = sdk.getComponent('views.elements.DialogButtons');

        return (
            <BaseDialog
                    className='mx_ConfirmDestroyCrossSigningDialog'
                    hasCancel={true}
                    onFinished={this.props.onFinished}
                    title={_t("Destroy cross-signing keys?")}>
                <div className='mx_ConfirmDestroyCrossSigningDialog_content'>
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
                    onPrimaryButtonClick={this._onConfirm}
                    primaryButtonClass="danger"
                    cancelButton={_t("Cancel")}
                    onCancel={this._onDecline}
                />
            </BaseDialog>
        );
    }
}

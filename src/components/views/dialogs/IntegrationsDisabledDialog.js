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

import React from 'react';
import PropTypes from 'prop-types';
import {_t} from "../../../languageHandler";
import * as sdk from "../../../index";
import dis from '../../../dispatcher/dispatcher';
import {Action} from "../../../dispatcher/actions";

export default class IntegrationsDisabledDialog extends React.Component {
    static propTypes = {
        onFinished: PropTypes.func.isRequired,
    };

    _onAcknowledgeClick = () => {
        this.props.onFinished();
    };

    _onOpenSettingsClick = () => {
        this.props.onFinished();
        dis.fire(Action.ViewUserSettings);
    };

    render() {
        const BaseDialog = sdk.getComponent('views.dialogs.BaseDialog');
        const DialogButtons = sdk.getComponent('views.elements.DialogButtons');

        return (
            <BaseDialog className='mx_IntegrationsDisabledDialog' hasCancel={true}
                        onFinished={this.props.onFinished}
                        title={_t("Integrations are disabled")}>
                <div className='mx_IntegrationsDisabledDialog_content'>
                    <p>{_t("Enable 'Manage Integrations' in Settings to do this.")}</p>
                </div>
                <DialogButtons
                    primaryButton={_t("Settings")}
                    onPrimaryButtonClick={this._onOpenSettingsClick}
                    cancelButton={_t("OK")}
                    onCancel={this._onAcknowledgeClick}
                />
            </BaseDialog>
        );
    }
}

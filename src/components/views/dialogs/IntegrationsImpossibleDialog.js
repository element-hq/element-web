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

import React from 'react';
import PropTypes from 'prop-types';
import {_t} from "../../../languageHandler";
import SdkConfig from "../../../SdkConfig";
import * as sdk from "../../../index";

export default class IntegrationsImpossibleDialog extends React.Component {
    static propTypes = {
        onFinished: PropTypes.func.isRequired,
    };

    _onAcknowledgeClick = () => {
        this.props.onFinished();
    };

    render() {
        const brand = SdkConfig.get().brand;
        const BaseDialog = sdk.getComponent('views.dialogs.BaseDialog');
        const DialogButtons = sdk.getComponent('views.elements.DialogButtons');

        return (
            <BaseDialog className='mx_IntegrationsImpossibleDialog' hasCancel={false}
                        onFinished={this.props.onFinished}
                        title={_t("Integrations not allowed")}>
                <div className='mx_IntegrationsImpossibleDialog_content'>
                    <p>
                        {_t(
                            "Your %(brand)s doesn't allow you to use an Integration Manager to do this. " +
                            "Please contact an admin.",
                            { brand },
                        )}
                    </p>
                </div>
                <DialogButtons
                    primaryButton={_t("OK")}
                    onPrimaryButtonClick={this._onAcknowledgeClick}
                    hasCancel={false}
                />
            </BaseDialog>
        );
    }
}

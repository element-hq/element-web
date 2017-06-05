/*
Copyright 2016 OpenMarket Ltd

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

/*
 * Usage:
 * Modal.createDialog(NeedToRegisterDialog, {
 *   title: "some text", (default: "Registration required")
 *   description: "some more text",
 *   onFinished: someFunction,
 * });
 */

import React from 'react';
import dis from '../../../dispatcher';
import sdk from '../../../index';
import { _t } from '../../../languageHandler';

module.exports = React.createClass({
    displayName: 'NeedToRegisterDialog',
    propTypes: {
        title: React.PropTypes.string,
        description: React.PropTypes.oneOfType([
            React.PropTypes.element,
            React.PropTypes.string,
        ]),
        onFinished: React.PropTypes.func.isRequired,
    },

    onRegisterClicked: function() {
        dis.dispatch({
            action: "start_upgrade_registration",
        });
        if (this.props.onFinished) {
            this.props.onFinished();
        }
    },

    render: function() {
        const BaseDialog = sdk.getComponent('views.dialogs.BaseDialog');
        return (
            <BaseDialog className="mx_NeedToRegisterDialog"
                onFinished={this.props.onFinished}
                title={this.props.title || _t('Registration required')}
            >
                <div className="mx_Dialog_content">
                    {this.props.description || _t('A registered account is required for this action')}
                </div>
                <div className="mx_Dialog_buttons">
                    <button className="mx_Dialog_primary" onClick={this.props.onFinished} autoFocus={true}>
                        {_t("Cancel")}
                    </button>
                    <button onClick={this.onRegisterClicked}>
                        {_t("Register")}
                    </button>
                </div>
            </BaseDialog>
        );
    },
});

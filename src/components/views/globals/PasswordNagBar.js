/*
Copyright 2017 Vector Creations Ltd
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

import React from 'react';
import createReactClass from 'create-react-class';
import * as sdk from '../../../index';
import Modal from '../../../Modal';
import { _t } from '../../../languageHandler';

export default createReactClass({
    onUpdateClicked: function() {
        const SetPasswordDialog = sdk.getComponent('dialogs.SetPasswordDialog');
        Modal.createTrackedDialog('Set Password Dialog', 'Password Nag Bar', SetPasswordDialog);
    },

    render: function() {
        const toolbarClasses = "mx_MatrixToolbar mx_MatrixToolbar_clickable";
        return (
            <div className={toolbarClasses} onClick={this.onUpdateClicked}>
                <img className="mx_MatrixToolbar_warning"
                    src={require("../../../../res/img/warning.svg")}
                    width="24"
                    height="23"
                    alt=""
                />
                <div className="mx_MatrixToolbar_content">
                    { _t(
                        "To return to your account in future you need to <u>set a password</u>",
                        {},
                        { 'u': (sub) => <u>{ sub }</u> },
                    ) }
                </div>
                <button className="mx_MatrixToolbar_action">
                    { _t("Set Password") }
                </button>
            </div>
        );
    },
});

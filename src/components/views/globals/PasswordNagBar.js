/*
Copyright 2017 Vector Creations Ltd

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

'use strict';

import React from 'react';
import sdk from 'matrix-react-sdk';
import Modal from 'matrix-react-sdk/lib/Modal';
import dis from 'matrix-react-sdk/lib/dispatcher';
import { _t, _tJsx } from 'matrix-react-sdk/lib/languageHandler';

export default React.createClass({
    onUpdateClicked: function() {
        const SetPasswordDialog = sdk.getComponent('dialogs.SetPasswordDialog');
        Modal.createDialog(SetPasswordDialog, {
            onFinished: (passwordChanged) => {
                if (!passwordChanged) {
                    return;
                }
                // Notify SessionStore that the user's password was changed
                dis.dispatch({
                    action: 'password_changed',
                });
            },
        });
    },

    render: function() {
        const toolbarClasses = "mx_MatrixToolbar mx_MatrixToolbar_clickable";
        return (
            <div className={toolbarClasses} onClick={this.onUpdateClicked}>
                <img className="mx_MatrixToolbar_warning"
                    src="img/warning.svg"
                    width="24"
                    height="23"
                    alt="Warning"
                />
                <div className="mx_MatrixToolbar_content">
                    { _tJsx(
                        "To return to your account in future you need to <u>set a password</u>",
                        /<u>(.*?)<\/u>/,
                        (sub) => { return <u>{ sub }</u>; },
                    ) }
                </div>
                <button className="mx_MatrixToolbar_action">
                    { _t("Set Password") }
                </button>
            </div>
        );
    },
});

/*
Copyright 2016 OpenMarket Ltd
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

import q from 'q';
import React from 'react';
import sdk from 'matrix-react-sdk';
import {MatrixClientPeg} from 'matrix-react-sdk';
import classnames from 'classnames';

/**
 * Prompt the user to set a password
 *
 * On success, `onFinished()` when finished
 */
export default React.createClass({
    displayName: 'SetPasswordDialog',
    propTypes: {
        onFinished: React.PropTypes.func.isRequired,
    },

    getInitialState: function() {
        return {
            error: null,
        };
    },

    _onPasswordChanged: function() {
        this.props.onFinished();
    },

    _onPasswordChangeError: function(err) {
        let errMsg = err.error || "";
        if (err.httpStatus === 403) {
            errMsg = "Failed to change password. Is your password correct?";
        } else if (err.httpStatus) {
            errMsg += ` (HTTP status ${err.httpStatus})`;
        }
        this.setState({
            error: errMsg,
        });
    },

    render: function() {
        const BaseDialog = sdk.getComponent('views.dialogs.BaseDialog');
        const ChangePassword = sdk.getComponent('views.settings.ChangePassword');
        const Spinner = sdk.getComponent('elements.Spinner');

        return (
            <BaseDialog className="mx_SetPasswordDialog"
                onFinished={this.props.onFinished}
                title="Please set a new password!"
            >
                <div className="mx_Dialog_content">
                    <p>
                        This will allow you to return to your account after signing out,
                        and sign in on other devices.
                    </p>
                    <ChangePassword
                        className="mx_SetPasswordDialog_change_password"
                        rowClassName=""
                        rowLabelClassName=""
                        rowInputClassName=""
                        buttonClassName="mx_Dialog_primary mx_SetPasswordDialog_change_password_button"
                        disableConfirmation={true}
                        onError={this._onPasswordChangeError}
                        onFinished={this._onPasswordChanged} />
                    <div className="error">
                        { this.state.error }
                    </div>
                </div>
            </BaseDialog>
        );
    },
});

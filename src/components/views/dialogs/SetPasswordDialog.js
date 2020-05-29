/*
Copyright 2017 Vector Creations Ltd
Copyright 2018 New Vector Ltd
Copyright 2019 Michael Telatynski <7t3chguy@gmail.com>

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
import PropTypes from 'prop-types';
import * as sdk from '../../../index';
import { _t } from '../../../languageHandler';
import Modal from '../../../Modal';

const WarmFuzzy = function(props) {
    const BaseDialog = sdk.getComponent('views.dialogs.BaseDialog');
    let title = _t('You have successfully set a password!');
    if (props.didSetEmail) {
        title = _t('You have successfully set a password and an email address!');
    }
    const advice = _t('You can now return to your account after signing out, and sign in on other devices.');
    let extraAdvice = null;
    if (!props.didSetEmail) {
        extraAdvice = _t('Remember, you can always set an email address in user settings if you change your mind.');
    }

    return <BaseDialog className="mx_SetPasswordDialog"
        onFinished={props.onFinished}
        title={ title }
    >
        <div className="mx_Dialog_content">
            <p>
                { advice }
            </p>
            <p>
                { extraAdvice }
            </p>
        </div>
        <div className="mx_Dialog_buttons">
            <button
                className="mx_Dialog_primary"
                autoFocus={true}
                onClick={props.onFinished}>
                    { _t('Continue') }
            </button>
        </div>
    </BaseDialog>;
};

/**
 * Prompt the user to set a password
 *
 * On success, `onFinished()` when finished
 */
export default createReactClass({
    displayName: 'SetPasswordDialog',
    propTypes: {
        onFinished: PropTypes.func.isRequired,
    },

    getInitialState: function() {
        return {
            error: null,
        };
    },

    componentDidMount: function() {
        console.info('SetPasswordDialog component did mount');
    },

    _onPasswordChanged: function(res) {
        Modal.createDialog(WarmFuzzy, {
            didSetEmail: res.didSetEmail,
            onFinished: () => {
                this.props.onFinished();
            },
        });
    },

    _onPasswordChangeError: function(err) {
        let errMsg = err.error || "";
        if (err.httpStatus === 403) {
            errMsg = _t('Failed to change password. Is your password correct?');
        } else if (err.httpStatus) {
            errMsg += ' ' + _t(
                '(HTTP status %(httpStatus)s)',
                { httpStatus: err.httpStatus },
            );
        }
        this.setState({
            error: errMsg,
        });
    },

    render: function() {
        const BaseDialog = sdk.getComponent('views.dialogs.BaseDialog');
        const ChangePassword = sdk.getComponent('views.settings.ChangePassword');

        return (
            <BaseDialog className="mx_SetPasswordDialog"
                onFinished={this.props.onFinished}
                title={ _t('Please set a password!') }
            >
                <div className="mx_Dialog_content">
                    <p>
                        { _t('This will allow you to return to your account after signing out, and sign in on other sessions.') }
                    </p>
                    <ChangePassword
                        className="mx_SetPasswordDialog_change_password"
                        rowClassName=""
                        buttonClassNames="mx_Dialog_primary mx_SetPasswordDialog_change_password_button"
                        buttonKind="primary"
                        confirm={false}
                        autoFocusNewPasswordInput={true}
                        shouldAskForEmail={true}
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

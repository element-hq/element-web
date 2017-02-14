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

import React from 'react';

import sdk from '../../../index';
import MatrixClientPeg from '../../../MatrixClientPeg';

/* This file contains a collection of components which are used by the
 * InteractiveAuth to prompt the user to enter the information needed
 * for an auth stage. (The intention is that they could also be used for other
 * components, such as the registration flow).
 *
 * Call getEntryComponentForLoginType() to get a component suitable for a
 * particular login type. Each component requires the same properties:
 *
 * loginType:              the login type of the auth stage being attempted
 * authSessionId:          session id from the server
 * stageParams:            params from the server for the stage being attempted
 * errorText:              error message from a previous attempt to authenticate
 * submitAuthDict:         a function which will be called with the new auth dict
 * busy:                   a boolean indicating whether the auth logic is doing something
 *                         the user needs to wait for.
 *
 * Each component may also provide the following functions (beyond the standard React ones):
 *    focus: set the input focus appropriately in the form.
 */

export const PasswordAuthEntry = React.createClass({
    displayName: 'PasswordAuthEntry',

    statics: {
        LOGIN_TYPE: "m.login.password",
    },

    propTypes: {
        submitAuthDict: React.PropTypes.func.isRequired,
        errorText: React.PropTypes.string,
        // is the auth logic currently waiting for something to
        // happen?
        busy: React.PropTypes.bool,
    },

    getInitialState: function() {
        return {
            passwordValid: false,
        };
    },

    focus: function() {
        if (this.refs.passwordField) {
            this.refs.passwordField.focus();
        }
    },

    _onSubmit: function(e) {
        e.preventDefault();
        if (this.props.busy) return;

        this.props.submitAuthDict({
            type: PasswordAuthEntry.LOGIN_TYPE,
            user: MatrixClientPeg.get().credentials.userId,
            password: this.refs.passwordField.value,
        });
    },

    _onPasswordFieldChange: function(ev) {
        // enable the submit button iff the password is non-empty
        this.setState({
            passwordValid: Boolean(this.refs.passwordField.value),
        });
    },

    render: function() {
        let passwordBoxClass = null;

        if (this.props.errorText) {
            passwordBoxClass = 'error';
        }

        let submitButtonOrSpinner;
        if (this.props.busy) {
            const Loader = sdk.getComponent("elements.Spinner");
            submitButtonOrSpinner = <Loader />;
        } else {
            submitButtonOrSpinner = (
                <input type="submit"
                    className="mx_Dialog_primary"
                    disabled={!this.state.passwordValid}
                />
            );
        }

        return (
            <div>
                <p>To continue, please enter your password.</p>
                <p>Password:</p>
                <form onSubmit={this._onSubmit}>
                    <input
                        ref="passwordField"
                        className={passwordBoxClass}
                        onChange={this._onPasswordFieldChange}
                        type="password"
                    />
                    <div className="mx_button_row">
                        {submitButtonOrSpinner}
                    </div>
                </form>
                <div className="error">
                    {this.props.errorText}
                </div>
            </div>
        );
    },
});

export const RecaptchaAuthEntry = React.createClass({
    displayName: 'RecaptchaAuthEntry',

    statics: {
        LOGIN_TYPE: "m.login.recaptcha",
    },

    propTypes: {
        submitAuthDict: React.PropTypes.func.isRequired,
        stageParams: React.PropTypes.object.isRequired,
        errorText: React.PropTypes.string,
    },

    _onCaptchaResponse: function(response) {
        this.props.submitAuthDict({
            type: RecaptchaAuthEntry.LOGIN_TYPE,
            response: response,
        });
    },

    render: function() {
        const CaptchaForm = sdk.getComponent("views.login.CaptchaForm");
        var sitePublicKey = this.props.stageParams.public_key;
        return (
            <div>
                <CaptchaForm sitePublicKey={sitePublicKey}
                    onCaptchaResponse={this._onCaptchaResponse}
                />
                <div className="error">
                    {this.props.errorText}
                </div>
            </div>
        );
    },
});

export const FallbackAuthEntry = React.createClass({
    displayName: 'FallbackAuthEntry',

    propTypes: {
        authSessionId: React.PropTypes.string.isRequired,
        loginType: React.PropTypes.string.isRequired,
        submitAuthDict: React.PropTypes.func.isRequired,
        errorText: React.PropTypes.string,
    },

    componentWillMount: function() {
        // we have to make the user click a button, as browsers will block
        // the popup if we open it immediately.
        this._popupWindow = null;
        window.addEventListener("message", this._onReceiveMessage);
    },

    componentWillUnmount: function() {
        window.removeEventListener("message", this._onReceiveMessage);
        if (this._popupWindow) {
            this._popupWindow.close();
        }
    },

    _onShowFallbackClick: function() {
        var url = MatrixClientPeg.get().getFallbackAuthUrl(
            this.props.loginType,
            this.props.authSessionId
        );
        this._popupWindow = window.open(url);
    },

    _onReceiveMessage: function(event) {
        if (
            event.data === "authDone" &&
            event.origin === MatrixClientPeg.get().getHomeserverUrl()
        ) {
            this.props.submitAuthDict({});
        }
    },

    render: function() {
        return (
            <div>
                <a onClick={this._onShowFallbackClick}>Start authentication</a>
                <div className="error">
                    {this.props.errorText}
                </div>
            </div>
        );
    },
});

const AuthEntryComponents = [
    PasswordAuthEntry,
    RecaptchaAuthEntry,
];

export function getEntryComponentForLoginType(loginType) {
    for (var c of AuthEntryComponents) {
        if (c.LOGIN_TYPE == loginType) {
            return c;
        }
    }
    return FallbackAuthEntry;
}

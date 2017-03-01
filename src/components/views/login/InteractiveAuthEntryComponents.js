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

/* This file contains a collection of components which are used by the
 * InteractiveAuth to prompt the user to enter the information needed
 * for an auth stage. (The intention is that they could also be used for other
 * components, such as the registration flow).
 *
 * Call getEntryComponentForLoginType() to get a component suitable for a
 * particular login type. Each component requires the same properties:
 *
 * matrixClient:           A matrix client. May be a different one to the one
 *                         currently being used generally (eg. to register with
 *                         one HS whilst beign a guest on another).
 * loginType:              the login type of the auth stage being attempted
 * authSessionId:          session id from the server
 * clientSecret:           The client secret in use for ID server auth sessions
 * stageParams:            params from the server for the stage being attempted
 * errorText:              error message from a previous attempt to authenticate
 * submitAuthDict:         a function which will be called with the new auth dict
 * busy:                   a boolean indicating whether the auth logic is doing something
 *                         the user needs to wait for.
 * inputs:                 Object of inputs provided by the user, as in js-sdk
 *                         interactive-auth
 * stageState:             Stage-specific object used for communicating state information
 *                         to the UI from the state-specific auth logic.
 *                         Defined keys for stages are:
 *                             m.login.email.identity:
 *                              * emailSid: string representing the sid of the active
 *                                          verification session from the ID server, or
 *                                          null if no session is active.
 * fail:                   a function which should be called with an error object if an
 *                         error occurred during the auth stage. This will cause the auth
 *                         session to be failed and the process to go back to the start.
 * setEmailSid:            m.login.email.identity only: a function to be called with the
 *                         email sid after a token is requested.
 * makeRegistrationUrl     A function that makes a registration URL
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
        matrixClient: React.PropTypes.object,
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
            user: this.props.matrixClient.credentials.userId,
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

export const EmailIdentityAuthEntry = React.createClass({
    displayName: 'EmailIdentityAuthEntry',

    statics: {
        LOGIN_TYPE: "m.login.email.identity",
    },

    propTypes: {
        matrixClient: React.PropTypes.object,
        submitAuthDict: React.PropTypes.func.isRequired,
        authSessionId: React.PropTypes.string.isRequired,
        clientSecret: React.PropTypes.string.isRequired,
        inputs: React.PropTypes.object.isRequired,
        stageState: React.PropTypes.object.isRequired,
        fail: React.PropTypes.func.isRequired,
        setEmailSid: React.PropTypes.func.isRequired,
        makeRegistrationUrl: React.PropTypes.func.isRequired,
    },

    getInitialState: function() {
        return {
            requestingToken: false,
        };
    },

    componentWillMount: function() {
        if (this.props.stageState.emailSid === null) {
            this.setState({requestingToken: true});
            this._requestEmailToken().catch((e) => {
                this.props.fail(e);
            }).finally(() => {
                this.setState({requestingToken: false});
            }).done();
        }
    },

    /*
     * Requests a verification token by email.
     */
    _requestEmailToken: function() {
        const nextLink = this.props.makeRegistrationUrl({
            client_secret: this.props.clientSecret,
            hs_url: this.props.matrixClient.getHomeserverUrl(),
            is_url: this.props.matrixClient.getIdentityServerUrl(),
            session_id: this.props.authSessionId,
        });

        return this.props.matrixClient.requestRegisterEmailToken(
            this.props.inputs.emailAddress,
            this.props.clientSecret,
            1, // TODO: Multiple send attempts?
            nextLink,
        ).then((result) => {
            this.props.setEmailSid(result.sid);
        });
    },

    render: function() {
        if (this.state.requestingToken) {
            const Loader = sdk.getComponent("elements.Spinner");
            return <Loader />;
        } else {
            return (
                <div>
                    <p>An email has been sent to <i>{this.props.inputs.emailAddress}</i></p>
                    <p>Please check your email to continue registration.</p>
                </div>
            );
        }
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
        var url = this.props.matrixClient.getFallbackAuthUrl(
            this.props.loginType,
            this.props.authSessionId
        );
        this._popupWindow = window.open(url);
    },

    _onReceiveMessage: function(event) {
        if (
            event.data === "authDone" &&
            event.origin === this.props.matrixClient.getHomeserverUrl()
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
    EmailIdentityAuthEntry,
];

export function getEntryComponentForLoginType(loginType) {
    for (var c of AuthEntryComponents) {
        if (c.LOGIN_TYPE == loginType) {
            return c;
        }
    }
    return FallbackAuthEntry;
}

/*
Copyright 2015 OpenMarket Ltd

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

var React = require('react');

var sdk = require('matrix-react-sdk');
var MatrixClientPeg = require('matrix-react-sdk/lib/MatrixClientPeg');
var dis = require('matrix-react-sdk/lib/dispatcher');
var ServerConfig = require("./ServerConfig");
var RegistrationForm = require("./RegistrationForm");
var CaptchaForm = require("./CaptchaForm");
var MIN_PASSWORD_LENGTH = 6;

module.exports = React.createClass({
    displayName: 'Registration',

    propTypes: {
        onLoggedIn: React.PropTypes.func.isRequired,
        registerLogic: React.PropTypes.any.isRequired,
        // registration shouldn't know or care how login is done.
        onLoginClick: React.PropTypes.func.isRequired
    },

    getInitialState: function() {
        return {
            busy: false,
            errorText: null,
            enteredHomeserverUrl: this.props.registerLogic.getHomeserverUrl(),
            enteredIdentityServerUrl: this.props.registerLogic.getIdentityServerUrl()
        };
    },

    componentWillMount: function() {
        this.dispatcherRef = dis.register(this.onAction);
    },

    componentWillUnmount: function() {
        dis.unregister(this.dispatcherRef);
    },

    onHsUrlChanged: function(newHsUrl) {
        this.props.registerLogic.setHomeserverUrl(newHsUrl);
    },

    onIsUrlChanged: function(newIsUrl) {
        this.props.registerLogic.setIdentityServerUrl(newIsUrl);
    },

    onAction: function(payload) {
        if (payload.action !== "registration_step_update") {
            return;
        }
        this.forceUpdate(); // registration state has changed.
    },

    onFormSubmit: function(formVals) {
        var self = this;
        this.props.registerLogic.register(formVals).done(function(response) {
            if (!response || !response.access_token) {
                console.warn(
                    "FIXME: Register fulfilled without a final response, " +
                    "did you break the promise chain?"
                );
                // no matter, we'll grab it direct
                response = self.props.registerLogic.getCredentials();
            }
            if (!response || !response.user_id || !response.access_token) {
                console.error("Final response is missing keys.");
                self.setState({
                    errorText: "There was a problem processing the response."
                });
                return;
            }
            // TODO: do post-register stuff
            self.props.onLoggedIn({
                userId: response.user_id,
                homeserverUrl: self.props.registerLogic.getHomeserverUrl(),
                identityServerUrl: self.props.registerLogic.getIdentityServerUrl(),
                accessToken: response.access_token
            });
        }, function(err) {
            if (err.message) {
                self.setState({
                    errorText: err.message
                });
            }
            console.log(err);
        });
    },

    onFormValidationFailed: function(errCode) {
        var errMsg;
        switch (errCode) {
            case "RegistrationForm.ERR_PASSWORD_MISSING":
                errMsg = "Missing password.";
                break;
            case "RegistrationForm.ERR_PASSWORD_MISMATCH":
                errMsg = "Passwords don't match.";
                break;
            case "RegistrationForm.ERR_PASSWORD_LENGTH":
                errMsg = `Password too short (min ${MIN_PASSWORD_LENGTH}).`;
                break;
            default:
                console.error("Unknown error code: %s", errCode);
                errMsg = "An unknown error occurred.";
                break;
        }
        this.setState({
            errorText: errMsg
        });
    },

    onCaptchaLoaded: function() {
        this.props.registerLogic.tellStage("m.login.recaptcha", "loaded");
    },

    // TODO: I wonder if this should actually be a different component...
    _getPostRegisterJsx: function() {
        var ChangeDisplayName = sdk.getComponent('molecules.ChangeDisplayName');
        var ChangeAvatar = sdk.getComponent('molecules.ChangeAvatar');
        return (
            <div className="mx_Login_profile">
                Set a display name:
                <ChangeDisplayName />
                Upload an avatar:
                <ChangeAvatar
                    initialAvatarUrl={MatrixClientPeg.get().mxcUrlToHttp(this.state.avatarUrl)} />
                <button onClick={this.onProfileContinueClicked}>Continue</button>
            </div>
        );
    },

    _getRegisterContentJsx: function() {
        var currStep = this.props.registerLogic.getStep();
        var registerStep;
        switch (currStep) {
            case "Register.COMPLETE":
                return this._getPostRegisterJsx();
            case "Register.START":
            case "Register.STEP_m.login.dummy":
                registerStep = (
                    <RegistrationForm
                        showEmail={true}
                        minPasswordLength={MIN_PASSWORD_LENGTH}
                        onError={this.onFormValidationFailed}
                        onRegisterClick={this.onFormSubmit} />
                );
                break;
            case "Register.STEP_m.login.email.identity":
                registerStep = (
                    <div>
                        Please check your email to continue registration.
                    </div>
                );
                break;
            case "Register.STEP_m.login.recaptcha":
                registerStep = (
                    <CaptchaForm onCaptchaLoaded={this.onCaptchaLoaded} />
                );
                break;
            default:
                console.error("Unknown register state: %s", currStep);
                break;
        }
        return (
            <div>
                <h2>Create an account</h2>
                {registerStep}
                <div className="mx_Login_error">{this.state.errorText}</div>
                <ServerConfig ref="serverConfig"
                    withToggleButton={true}
                    defaultHsUrl={this.state.enteredHomeserverUrl}
                    defaultIsUrl={this.state.enteredIdentityServerUrl}
                    onHsUrlChanged={this.onHsUrlChanged}
                    onIsUrlChanged={this.onIsUrlChanged}
                    delayTimeMs={1000} />
                <a className="mx_Login_create" onClick={this.props.onLoginClick} href="#">
                    I already have an account
                </a>
            </div>
        );
    },

    render: function() {
        return (
            <div className="mx_Login">
                <div className="mx_Login_box">
                    <div className="mx_Login_logo">
                        <img src="img/logo.png" width="249" height="78" alt="vector"/>
                    </div>
                    {this._getRegisterContentJsx()}
                </div>
            </div>
        );
    }
});

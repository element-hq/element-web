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
var ServerConfig = require("./ServerConfig");
var RegistrationForm = require("./RegistrationForm");
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

    },

    onHsUrlChanged: function(newHsUrl) {
        this.props.registerLogic.setHomeserverUrl(newHsUrl);
        this.forceUpdate(); // registration state may have changed.
    },

    onIsUrlChanged: function(newIsUrl) {
        this.props.registerLogic.setIdentityServerUrl(newIsUrl);
        this.forceUpdate(); // registration state may have changed.
    },

    onFormSubmit: function(formVals) {
        console.log("Form vals: %s", formVals);
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
        var currState = this.props.registerLogic.getState();
        var registerStep;
        switch (currState) {
            case "Register.COMPLETE":
                return this._getPostRegisterJsx();
            case "Register.START":
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
                    <div ref="recaptchaContainer">
                        This Home Server would like to make sure you are not a robot
                        <div id="mx_recaptcha"></div>
                    </div>
                );
                break;
            default:
                console.error("Unknown register state: %s", currState);
                break;
        }
        return (
            <div>
                <h2>Create an account</h2>
                {registerStep}
                <ServerConfig ref="serverConfig"
                    withToggleButton={true}
                    defaultHsUrl={this.state.enteredHomeserverUrl}
                    defaultIsUrl={this.state.enteredIdentityServerUrl}
                    onHsUrlChanged={this.onHsUrlChanged}
                    onIsUrlChanged={this.onIsUrlChanged}
                    delayTimeMs={1000} />
                <div className="mx_Login_error">{this.state.errorText}</div>
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

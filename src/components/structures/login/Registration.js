/*
Copyright 2015, 2016 OpenMarket Ltd

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

var sdk = require('../../../index');
var MatrixClientPeg = require('../../../MatrixClientPeg');
var dis = require('../../../dispatcher');
var Signup = require("../../../Signup");
var ServerConfig = require("../../views/login/ServerConfig");
var RegistrationForm = require("../../views/login/RegistrationForm");
var CaptchaForm = require("../../views/login/CaptchaForm");

var MIN_PASSWORD_LENGTH = 6;

module.exports = React.createClass({
    displayName: 'Registration',

    propTypes: {
        onLoggedIn: React.PropTypes.func.isRequired,
        clientSecret: React.PropTypes.string,
        sessionId: React.PropTypes.string,
        registrationUrl: React.PropTypes.string,
        idSid: React.PropTypes.string,
        hsUrl: React.PropTypes.string,
        isUrl: React.PropTypes.string,
        email: React.PropTypes.string,
        // registration shouldn't know or care how login is done.
        onLoginClick: React.PropTypes.func.isRequired
    },

    getInitialState: function() {
        return {
            busy: false,
            errorText: null,
            enteredHomeserverUrl: this.props.hsUrl,
            enteredIdentityServerUrl: this.props.isUrl
        };
    },

    componentWillMount: function() {
        this.dispatcherRef = dis.register(this.onAction);
        // attach this to the instance rather than this.state since it isn't UI
        this.registerLogic = new Signup.Register(
            this.props.hsUrl, this.props.isUrl
        );
        this.registerLogic.setClientSecret(this.props.clientSecret);
        this.registerLogic.setSessionId(this.props.sessionId);
        this.registerLogic.setRegistrationUrl(this.props.registrationUrl);
        this.registerLogic.setIdSid(this.props.idSid);
        this.registerLogic.recheckState();
    },

    componentWillUnmount: function() {
        dis.unregister(this.dispatcherRef);
    },

    componentDidMount: function() {
        // may have already done an HTTP hit (e.g. redirect from an email) so
        // check for any pending response
        var promise = this.registerLogic.getPromise();
        if (promise) {
            this.onProcessingRegistration(promise);
        }
    },

    onHsUrlChanged: function(newHsUrl) {
        this.registerLogic.setHomeserverUrl(newHsUrl);
    },

    onIsUrlChanged: function(newIsUrl) {
        this.registerLogic.setIdentityServerUrl(newIsUrl);
    },

    onAction: function(payload) {
        if (payload.action !== "registration_step_update") {
            return;
        }
        this.forceUpdate(); // registration state has changed.
    },

    onFormSubmit: function(formVals) {
        var self = this;
        this.setState({
            errorText: "",
            busy: true
        });
        this.onProcessingRegistration(this.registerLogic.register(formVals));
    },

    // Promise is resolved when the registration process is FULLY COMPLETE
    onProcessingRegistration: function(promise) {
        var self = this;
        promise.done(function(response) {
            if (!response || !response.access_token) {
                console.warn(
                    "FIXME: Register fulfilled without a final response, " +
                    "did you break the promise chain?"
                );
                // no matter, we'll grab it direct
                response = self.registerLogic.getCredentials();
            }
            if (!response || !response.user_id || !response.access_token) {
                console.error("Final response is missing keys.");
                self.setState({
                    errorText: "There was a problem processing the response."
                });
                return;
            }
            self.props.onLoggedIn({
                userId: response.user_id,
                homeserverUrl: self.registerLogic.getHomeserverUrl(),
                identityServerUrl: self.registerLogic.getIdentityServerUrl(),
                accessToken: response.access_token
            });
            self.setState({
                busy: false
            });
        }, function(err) {
            if (err.message) {
                self.setState({
                    errorText: err.message
                });
            }
            self.setState({
                busy: false
            });
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

    onCaptchaLoaded: function(divIdName) {
        this.registerLogic.tellStage("m.login.recaptcha", {
            divId: divIdName
        });
        this.setState({
            busy: false // requires user input
        });
    },

    _getRegisterContentJsx: function() {
        var currStep = this.registerLogic.getStep();
        var registerStep;
        switch (currStep) {
            case "Register.COMPLETE":
                break; // NOP
            case "Register.START":
            case "Register.STEP_m.login.dummy":
                registerStep = (
                    <RegistrationForm
                        showEmail={true}
                        defaultEmail={this.props.email}
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
        var busySpinner;
        if (this.state.busy) {
            var Spinner = sdk.getComponent("elements.Spinner");
            busySpinner = (
                <Spinner />
            );
        }
        return (
            <div>
                <h2>Create an account</h2>
                {registerStep}
                <div className="mx_Login_error">{this.state.errorText}</div>
                {busySpinner}
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
        var LoginHeader = sdk.getComponent('login.LoginHeader');
        return (
            <div className="mx_Login">
                <div className="mx_Login_box">
                    <LoginHeader />
                    {this._getRegisterContentJsx()}
                </div>
            </div>
        );
    }
});

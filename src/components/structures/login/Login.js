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
var ReactDOM = require('react-dom');
var sdk = require('../../../index');
var Signup = require("../../../Signup");
var PasswordLogin = require("../../views/login/PasswordLogin");
var CasLogin = require("../../views/login/CasLogin");
var ServerConfig = require("../../views/login/ServerConfig");

/**
 * A wire component which glues together login UI components and Signup logic
 */
module.exports = React.createClass({displayName: 'Login',
    propTypes: {
        onLoggedIn: React.PropTypes.func.isRequired,

        customHsUrl: React.PropTypes.string,
        customIsUrl: React.PropTypes.string,
        defaultHsUrl: React.PropTypes.string,
        defaultIsUrl: React.PropTypes.string,
        // Secondary HS which we try to log into if the user is using
        // the default HS but login fails. Useful for migrating to a
        // different home server without confusing users.
        fallbackHsUrl: React.PropTypes.string,

        // login shouldn't know or care how registration is done.
        onRegisterClick: React.PropTypes.func.isRequired,

        // login shouldn't care how password recovery is done.
        onForgotPasswordClick: React.PropTypes.func,
        onLoginAsGuestClick: React.PropTypes.func,
        onCancelClick: React.PropTypes.func,
    },

    getInitialState: function() {
        return {
            busy: false,
            errorText: null,
            enteredHomeserverUrl: this.props.customHsUrl || this.props.defaultHsUrl,
            enteredIdentityServerUrl: this.props.customIsUrl || this.props.defaultIsUrl,

            // used for preserving username when changing homeserver
            username: "",
        };
    },

    componentWillMount: function() {
        this._initLoginLogic();
    },

    onPasswordLogin: function(username, password) {
        var self = this;
        self.setState({
            busy: true
        });

        this._loginLogic.loginViaPassword(username, password).then(function(data) {
            self.props.onLoggedIn(data);
        }, function(error) {
            self._setErrorTextFromError(error);
        }).finally(function() {
            self.setState({
                busy: false
            });
        });
    },

    onUsernameChanged: function(username) {
        this.setState({ username: username });
    },

    onHsUrlChanged: function(newHsUrl) {
        var self = this;
        this.setState({
            enteredHomeserverUrl: newHsUrl
        }, function() {
            self._initLoginLogic(newHsUrl);
        });
    },

    onIsUrlChanged: function(newIsUrl) {
        var self = this;
        this.setState({
            enteredIdentityServerUrl: newIsUrl
        }, function() {
            self._initLoginLogic(null, newIsUrl);            
        });
    },

    _initLoginLogic: function(hsUrl, isUrl) {
        var self = this;
        hsUrl = hsUrl || this.state.enteredHomeserverUrl;
        isUrl = isUrl || this.state.enteredIdentityServerUrl;

        var fallbackHsUrl = hsUrl == this.props.defaultHsUrl ? this.props.fallbackHsUrl : null;

        var loginLogic = new Signup.Login(hsUrl, isUrl, fallbackHsUrl);
        this._loginLogic = loginLogic;

        loginLogic.getFlows().then(function(flows) {
            // old behaviour was to always use the first flow without presenting
            // options. This works in most cases (we don't have a UI for multiple
            // logins so let's skip that for now).
            loginLogic.chooseFlow(0);
        }, function(err) {
            self._setErrorTextFromError(err);
        }).finally(function() {
            self.setState({
                busy: false
            });
        });

        this.setState({
            enteredHomeserverUrl: hsUrl,
            enteredIdentityServerUrl: isUrl,
            busy: true,
            errorText: null // reset err messages
        });
    },

    _getCurrentFlowStep: function() {
        return this._loginLogic ? this._loginLogic.getCurrentFlowStep() : null
    },

    _setErrorTextFromError: function(err) {
        if (err.friendlyText) {
            this.setState({
                errorText: err.friendlyText
            });
            return;
        }

        var errCode = err.errcode;
        if (!errCode && err.httpStatus) {
            errCode = "HTTP " + err.httpStatus;
        }

        var errorText = "Error: Problem communicating with the given homeserver " +
                (errCode ? "(" + errCode + ")" : "")

        if (err.cors === 'rejected') {
            if (window.location.protocol === 'https:' &&
                (this.state.enteredHomeserverUrl.startsWith("http:") || 
                 !this.state.enteredHomeserverUrl.startsWith("http")))
            {
                errorText = <span>
                    Can't connect to homeserver via HTTP when using a vector served by HTTPS.
                    Either use HTTPS or <a href='https://www.google.com/search?&q=enable%20unsafe%20scripts'>enable unsafe scripts</a>
                </span>;
            }
            else {
                errorText = <span>
                    Can't connect to homeserver - please check your connectivity and ensure
                    your <a href={ this.state.enteredHomeserverUrl }>homeserver's SSL certificate</a> is trusted.
                </span>;
            }
        }

        this.setState({
            errorText: errorText
        });
    },

    componentForStep: function(step) {
        switch (step) {
            case 'm.login.password':
                return (
                    <PasswordLogin
                        onSubmit={this.onPasswordLogin}
                        initialUsername={this.state.username}
                        onUsernameChanged={this.onUsernameChanged}
                        onForgotPasswordClick={this.props.onForgotPasswordClick} />
                );
            case 'm.login.cas':
                return (
                    <CasLogin />
                );
            default:
                if (!step) {
                    return;
                }
                return (
                    <div>
                    Sorry, this homeserver is using a login which is not
                    recognised ({step})
                    </div>
                );
        }
    },

    render: function() {
        var Loader = sdk.getComponent("elements.Spinner");
        var LoginHeader = sdk.getComponent("login.LoginHeader");
        var LoginFooter = sdk.getComponent("login.LoginFooter");
        var loader = this.state.busy ? <div className="mx_Login_loader"><Loader /></div> : null;

        var loginAsGuestJsx;
        if (this.props.onLoginAsGuestClick) {
            loginAsGuestJsx =
                <a className="mx_Login_create" onClick={this.props.onLoginAsGuestClick} href="#">
                    Login as guest
                </a>
        }

        var returnToAppJsx;
        if (this.props.onCancelClick) {
            returnToAppJsx = 
                <a className="mx_Login_create" onClick={this.props.onCancelClick} href="#">
                    Return to app
                </a>
        }

        return (
            <div className="mx_Login">
                <div className="mx_Login_box">
                    <LoginHeader />
                    <div>
                        <h2>Sign in
                            { loader }
                        </h2>
                        { this.componentForStep(this._getCurrentFlowStep()) }
                        <ServerConfig ref="serverConfig"
                            withToggleButton={true}
                            customHsUrl={this.props.customHsUrl}
                            customIsUrl={this.props.customIsUrl}
                            defaultHsUrl={this.props.defaultHsUrl}
                            defaultIsUrl={this.props.defaultIsUrl}
                            onHsUrlChanged={this.onHsUrlChanged}
                            onIsUrlChanged={this.onIsUrlChanged}
                            delayTimeMs={1000}/>
                        <div className="mx_Login_error">
                                { this.state.errorText }
                        </div>
                        <a className="mx_Login_create" onClick={this.props.onRegisterClick} href="#">
                            Create a new account
                        </a>
                        { loginAsGuestJsx }
                        { returnToAppJsx }
                        <LoginFooter />
                    </div>
                </div>
            </div>
        );
    }
});

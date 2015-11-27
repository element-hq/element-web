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
var ReactDOM = require('react-dom');
var sdk = require('matrix-react-sdk');
var Signup = require("matrix-react-sdk/lib/Signup");
var PasswordLogin = require("matrix-react-sdk/lib/components/views/login/PasswordLogin");
var CasLogin = require("matrix-react-sdk/lib/components/views/login/CasLogin");
var ServerConfig = require("../../views/login/ServerConfig");

/**
 * A wire component which glues together login UI components and Signup logic
 */
module.exports = React.createClass({displayName: 'Login',
    propTypes: {
        onLoggedIn: React.PropTypes.func.isRequired,
        homeserverUrl: React.PropTypes.string,
        identityServerUrl: React.PropTypes.string,
        // login shouldn't know or care how registration is done.
        onRegisterClick: React.PropTypes.func.isRequired
    },

    getDefaultProps: function() {
        return {
            homeserverUrl: 'https://matrix.org/',
            identityServerUrl: 'https://vector.im'
        };
    },

    getInitialState: function() {
        return {
            busy: false,
            errorText: null,
            enteredHomeserverUrl: this.props.homeserverUrl,
            enteredIdentityServerUrl: this.props.identityServerUrl
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

    onHsUrlChanged: function(newHsUrl) {
        this._initLoginLogic(newHsUrl);
    },

    onIsUrlChanged: function(newIsUrl) {
        this._initLoginLogic(null, newIsUrl);
    },

    _initLoginLogic: function(hsUrl, isUrl) {
        var self = this;
        hsUrl = hsUrl || this.state.enteredHomeserverUrl;
        isUrl = isUrl || this.state.enteredIdentityServerUrl;

        var loginLogic = new Signup.Login(hsUrl, isUrl);
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
        this.setState({
            errorText: (
                "Error: Problem communicating with the given homeserver " +
                (errCode ? "(" + errCode + ")" : "")
            )
        });
    },

    componentForStep: function(step) {
        switch (step) {
            case 'm.login.password':
                return (
                    <PasswordLogin onSubmit={this.onPasswordLogin} />
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
                    recognised by Vector ({step})
                    </div>
                );
        }
    },

    render: function() {
        var Loader = sdk.getComponent("atoms.Spinner");
        var loader = this.state.busy ? <div className="mx_Login_loader"><Loader /></div> : null;

        return (
            <div className="mx_Login">
                <div className="mx_Login_box">
                    <div className="mx_Login_logo">
                        <img src="img/logo.png" width="249" height="78" alt="vector"/>
                    </div>
                    <div>
                        <h2>Sign in</h2>
                        { this.componentForStep(this._getCurrentFlowStep()) }
                        <ServerConfig ref="serverConfig"
                            withToggleButton={true}
                            defaultHsUrl={this.props.homeserverUrl}
                            defaultIsUrl={this.props.identityServerUrl}
                            onHsUrlChanged={this.onHsUrlChanged}
                            onIsUrlChanged={this.onIsUrlChanged}
                            delayTimeMs={1000}/>
                        <div className="mx_Login_error">
                                { loader }
                                { this.state.errorText }
                        </div>
                        <a className="mx_Login_create" onClick={this.props.onRegisterClick} href="#">
                            Create a new account
                        </a>
                        <br/>
                        <div className="mx_Login_links">
                            <a href="https://medium.com/@Vector">blog</a>&nbsp;&nbsp;&middot;&nbsp;&nbsp;
                            <a href="https://twitter.com/@VectorCo">twitter</a>&nbsp;&nbsp;&middot;&nbsp;&nbsp;
                            <a href="https://github.com/vector-im/vector-web">github</a>&nbsp;&nbsp;&middot;&nbsp;&nbsp;
                            <a href="https://matrix.org">powered by Matrix</a>
                        </div>
                    </div>
                </div>
            </div>
        );
    }
});

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
var Modal = require("../../../Modal");
var MatrixClientPeg = require('../../../MatrixClientPeg');

var PasswordReset = require("../../../PasswordReset");

module.exports = React.createClass({
    displayName: 'ForgotPassword',

    propTypes: {
        defaultHsUrl: React.PropTypes.string,
        defaultIsUrl: React.PropTypes.string,
        customHsUrl: React.PropTypes.string,
        customIsUrl: React.PropTypes.string,
        onLoginClick: React.PropTypes.func,
        onRegisterClick: React.PropTypes.func,
        onComplete: React.PropTypes.func.isRequired
    },

    getInitialState: function() {
        return {
            enteredHomeserverUrl: this.props.customHsUrl || this.props.defaultHsUrl,
            enteredIdentityServerUrl: this.props.customIsUrl || this.props.defaultIsUrl,
            progress: null
        };
    },

    submitPasswordReset: function(hsUrl, identityUrl, email, password) {
        this.setState({
            progress: "sending_email"
        });
        this.reset = new PasswordReset(hsUrl, identityUrl);
        this.reset.resetPassword(email, password).done(() => {
            this.setState({
                progress: "sent_email"
            });
        }, (err) => {
            this.showErrorDialog("Failed to send email: " + err.message);
            this.setState({
                progress: null
            });
        });
    },

    onVerify: function(ev) {
        ev.preventDefault();
        if (!this.reset) {
            console.error("onVerify called before submitPasswordReset!");
            return;
        }
        this.reset.checkEmailLinkClicked().done((res) => {
            this.setState({ progress: "complete" });
        }, (err) => {
            this.showErrorDialog(err.message);
        });
    },

    onSubmitForm: function(ev) {
        ev.preventDefault();

        if (!this.state.email) {
            this.showErrorDialog("The email address linked to your account must be entered.");
        }
        else if (!this.state.password || !this.state.password2) {
            this.showErrorDialog("A new password must be entered.");
        }
        else if (this.state.password !== this.state.password2) {
            this.showErrorDialog("New passwords must match each other.");
        }
        else {
            var QuestionDialog = sdk.getComponent("dialogs.QuestionDialog");
            Modal.createDialog(QuestionDialog, {
                title: "Warning",
                description:
                    <div>
                        Resetting password will currently reset any end-to-end encryption keys on all devices,
                        making encrypted chat history unreadable, unless you first export your room keys
                        and re-import them afterwards.
                        In future this <a href="https://github.com/vector-im/riot-web/issues/2671">will be improved</a>.
                    </div>,
                button: "Continue",
                extraButtons: [
                    <button className="mx_Dialog_primary"
                            onClick={this._onExportE2eKeysClicked}>
                        Export E2E room keys
                    </button>
                ],
                onFinished: (confirmed) => {
                    if (confirmed) {
                        this.submitPasswordReset(
                            this.state.enteredHomeserverUrl, this.state.enteredIdentityServerUrl,
                            this.state.email, this.state.password
                        );
                    }
                },
            });
        }
    },

    _onExportE2eKeysClicked: function() {
        Modal.createDialogAsync(
            (cb) => {
                require.ensure(['../../../async-components/views/dialogs/ExportE2eKeysDialog'], () => {
                    cb(require('../../../async-components/views/dialogs/ExportE2eKeysDialog'));
                }, "e2e-export");
            }, {
                matrixClient: MatrixClientPeg.get(),
            }
        );
    },

    onInputChanged: function(stateKey, ev) {
        this.setState({
            [stateKey]: ev.target.value
        });
    },

    onHsUrlChanged: function(newHsUrl) {
        this.setState({
            enteredHomeserverUrl: newHsUrl
        });
    },

    onIsUrlChanged: function(newIsUrl) {
        this.setState({
            enteredIdentityServerUrl: newIsUrl
        });
    },

    showErrorDialog: function(body, title) {
        var ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
        Modal.createDialog(ErrorDialog, {
            title: title,
            description: body
        });
    },

    render: function() {
        var LoginHeader = sdk.getComponent("login.LoginHeader");
        var LoginFooter = sdk.getComponent("login.LoginFooter");
        var ServerConfig = sdk.getComponent("login.ServerConfig");
        var Spinner = sdk.getComponent("elements.Spinner");

        var resetPasswordJsx;

        if (this.state.progress === "sending_email") {
            resetPasswordJsx = <Spinner />;
        }
        else if (this.state.progress === "sent_email") {
            resetPasswordJsx = (
                <div>
                    An email has been sent to {this.state.email}. Once you&#39;ve followed
                    the link it contains, click below.
                    <br />
                    <input className="mx_Login_submit" type="button" onClick={this.onVerify}
                        value="I have verified my email address" />
                </div>
            );
        }
        else if (this.state.progress === "complete") {
            resetPasswordJsx = (
                <div>
                    <p>Your password has been reset.</p>
                    <p>You have been logged out of all devices and will no longer receive push notifications.
                    To re-enable notifications, sign in again on each device.</p>
                    <input className="mx_Login_submit" type="button" onClick={this.props.onComplete}
                        value="Return to login screen" />
                </div>
            );
        }
        else {
            resetPasswordJsx = (
            <div>
                <div className="mx_Login_prompt">
                    To reset your password, enter the email address linked to your account:
                </div>
                <div>
                    <form onSubmit={this.onSubmitForm}>
                        <input className="mx_Login_field" ref="user" type="text"
                            name="reset_email" // define a name so browser's password autofill gets less confused
                            value={this.state.email}
                            onChange={this.onInputChanged.bind(this, "email")}
                            placeholder="Email address" autoFocus />
                        <br />
                        <input className="mx_Login_field" ref="pass" type="password"
                            name="reset_password"
                            value={this.state.password}
                            onChange={this.onInputChanged.bind(this, "password")}
                            placeholder="New password" />
                        <br />
                        <input className="mx_Login_field" ref="pass" type="password"
                            name="reset_password_confirm"
                            value={this.state.password2}
                            onChange={this.onInputChanged.bind(this, "password2")}
                            placeholder="Confirm your new password" />
                        <br />
                        <input className="mx_Login_submit" type="submit" value="Send Reset Email" />
                    </form>
                    <ServerConfig ref="serverConfig"
                        withToggleButton={true}
                        defaultHsUrl={this.props.defaultHsUrl}
                        defaultIsUrl={this.props.defaultIsUrl}
                        customHsUrl={this.props.customHsUrl}
                        customIsUrl={this.props.customIsUrl}
                        onHsUrlChanged={this.onHsUrlChanged}
                        onIsUrlChanged={this.onIsUrlChanged}
                        delayTimeMs={0}/>
                    <div className="mx_Login_error">
                    </div>
                    <a className="mx_Login_create" onClick={this.props.onLoginClick} href="#">
                        Return to login
                    </a>
                    <a className="mx_Login_create" onClick={this.props.onRegisterClick} href="#">
                        Create a new account
                    </a>
                    <LoginFooter />
                </div>
            </div>
            );
        }


        return (
            <div className="mx_Login">
                <div className="mx_Login_box">
                    <LoginHeader />
                    {resetPasswordJsx}
                </div>
            </div>
        );
    }
});

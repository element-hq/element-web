/*
Copyright 2015, 2016 OpenMarket Ltd
Copyright 2017, 2018 New Vector Ltd

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
import PropTypes from 'prop-types';
import { _t } from '../../../languageHandler';
import sdk from '../../../index';
import Modal from "../../../Modal";
import MatrixClientPeg from "../../../MatrixClientPeg";
import SdkConfig from "../../../SdkConfig";

import PasswordReset from "../../../PasswordReset";
import makeLanguageSelector from "./LanguageSelector";

module.exports = React.createClass({
    displayName: 'ForgotPassword',

    propTypes: {
        defaultHsUrl: PropTypes.string,
        defaultIsUrl: PropTypes.string,
        customHsUrl: PropTypes.string,
        customIsUrl: PropTypes.string,
        onLoginClick: PropTypes.func,
        onRegisterClick: PropTypes.func,
        onComplete: PropTypes.func.isRequired,
    },

    getInitialState: function() {
        return {
            enteredHomeserverUrl: this.props.customHsUrl || this.props.defaultHsUrl,
            enteredIdentityServerUrl: this.props.customIsUrl || this.props.defaultIsUrl,
            progress: null,
            password: null,
            password2: null,
        };
    },

    submitPasswordReset: function(hsUrl, identityUrl, email, password) {
        this.setState({
            progress: "sending_email",
        });
        this.reset = new PasswordReset(hsUrl, identityUrl);
        this.reset.resetPassword(email, password).done(() => {
            this.setState({
                progress: "sent_email",
            });
        }, (err) => {
            this.showErrorDialog(_t('Failed to send email') + ": " + err.message);
            this.setState({
                progress: null,
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
            this.showErrorDialog(_t('The email address linked to your account must be entered.'));
        } else if (!this.state.password || !this.state.password2) {
            this.showErrorDialog(_t('A new password must be entered.'));
        } else if (this.state.password !== this.state.password2) {
            this.showErrorDialog(_t('New passwords must match each other.'));
        } else {
            const QuestionDialog = sdk.getComponent("dialogs.QuestionDialog");
            Modal.createTrackedDialog('Forgot Password Warning', '', QuestionDialog, {
                title: _t('Warning!'),
                description:
                    <div>
                        { _t(
                            'Resetting password will currently reset any ' +
                            'end-to-end encryption keys on all devices, ' +
                            'making encrypted chat history unreadable, ' +
                            'unless you first export your room keys and re-import ' +
                            'them afterwards. In future this will be improved.',
                        ) }
                    </div>,
                button: _t('Continue'),
                extraButtons: [
                    <button key="export_keys" className="mx_Dialog_primary"
                            onClick={this._onExportE2eKeysClicked}>
                        { _t('Export E2E room keys') }
                    </button>,
                ],
                onFinished: (confirmed) => {
                    if (confirmed) {
                        this.submitPasswordReset(
                            this.state.enteredHomeserverUrl, this.state.enteredIdentityServerUrl,
                            this.state.email, this.state.password,
                        );
                    }
                },
            });
        }
    },

    _onExportE2eKeysClicked: function() {
        Modal.createTrackedDialogAsync('Export E2E Keys', 'Forgot Password', (cb) => {
            require.ensure(['../../../async-components/views/dialogs/ExportE2eKeysDialog'], () => {
                cb(require('../../../async-components/views/dialogs/ExportE2eKeysDialog'));
            }, "e2e-export");
        }, {
            matrixClient: MatrixClientPeg.get(),
        });
    },

    onInputChanged: function(stateKey, ev) {
        this.setState({
            [stateKey]: ev.target.value,
        });
    },

    onServerConfigChange: function(config) {
        const newState = {};
        if (config.hsUrl !== undefined) {
            newState.enteredHomeserverUrl = config.hsUrl;
        }
        if (config.isUrl !== undefined) {
            newState.enteredIdentityServerUrl = config.isUrl;
        }
        this.setState(newState);
    },

    showErrorDialog: function(body, title) {
        const ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
        Modal.createTrackedDialog('Forgot Password Error', '', ErrorDialog, {
            title: title,
            description: body,
        });
    },

    render: function() {
        const LoginPage = sdk.getComponent("login.LoginPage");
        const LoginHeader = sdk.getComponent("login.LoginHeader");
        const LoginFooter = sdk.getComponent("login.LoginFooter");
        const ServerConfig = sdk.getComponent("login.ServerConfig");
        const Spinner = sdk.getComponent("elements.Spinner");

        let resetPasswordJsx;

        if (this.state.progress === "sending_email") {
            resetPasswordJsx = <Spinner />;
        } else if (this.state.progress === "sent_email") {
            resetPasswordJsx = (
                <div className="mx_Login_prompt">
                    { _t("An email has been sent to %(emailAddress)s. Once you've followed the link it contains, " +
                        "click below.", { emailAddress: this.state.email }) }
                    <br />
                    <input className="mx_Login_submit" type="button" onClick={this.onVerify}
                        value={_t('I have verified my email address')} />
                </div>
            );
        } else if (this.state.progress === "complete") {
            resetPasswordJsx = (
                <div className="mx_Login_prompt">
                    <p>{ _t('Your password has been reset') }.</p>
                    <p>{ _t('You have been logged out of all devices and will no longer receive push notifications. ' +
                        'To re-enable notifications, sign in again on each device') }.</p>
                    <input className="mx_Login_submit" type="button" onClick={this.props.onComplete}
                        value={_t('Return to login screen')} />
                </div>
            );
        } else {
            let serverConfigSection;
            if (!SdkConfig.get()['disable_custom_urls']) {
                serverConfigSection = (
                    <ServerConfig ref="serverConfig"
                        withToggleButton={true}
                        defaultHsUrl={this.props.defaultHsUrl}
                        defaultIsUrl={this.props.defaultIsUrl}
                        customHsUrl={this.props.customHsUrl}
                        customIsUrl={this.props.customIsUrl}
                        onServerConfigChange={this.onServerConfigChange}
                        delayTimeMs={0} />
                );
            }

            resetPasswordJsx = (
            <div>
                <div className="mx_Login_prompt">
                    { _t('To reset your password, enter the email address linked to your account') }:
                </div>
                <div>
                    <form onSubmit={this.onSubmitForm}>
                        <input className="mx_Login_field" ref="user" type="text"
                            name="reset_email" // define a name so browser's password autofill gets less confused
                            value={this.state.email}
                            onChange={this.onInputChanged.bind(this, "email")}
                            placeholder={_t('Email address')} autoFocus />
                        <br />
                        <input className="mx_Login_field" ref="pass" type="password"
                            name="reset_password"
                            value={this.state.password}
                            onChange={this.onInputChanged.bind(this, "password")}
                            placeholder={_t('New password')} />
                        <br />
                        <input className="mx_Login_field" ref="pass" type="password"
                            name="reset_password_confirm"
                            value={this.state.password2}
                            onChange={this.onInputChanged.bind(this, "password2")}
                            placeholder={_t('Confirm your new password')} />
                        <br />
                        <input className="mx_Login_submit" type="submit" value={_t('Send Reset Email')} />
                    </form>
                    { serverConfigSection }
                    <a className="mx_Login_create" onClick={this.props.onLoginClick} href="#">
                        { _t('Return to login screen') }
                    </a>
                    <a className="mx_Login_create" onClick={this.props.onRegisterClick} href="#">
                        { _t('Create an account') }
                    </a>
                    { makeLanguageSelector() }
                    <LoginFooter />
                </div>
            </div>
            );
        }


        return (
            <LoginPage>
                <div className="mx_Login_box">
                    <LoginHeader />
                    { resetPasswordJsx }
                </div>
            </LoginPage>
        );
    },
});

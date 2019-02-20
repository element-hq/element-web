/*
Copyright 2015, 2016 OpenMarket Ltd
Copyright 2017, 2018, 2019 New Vector Ltd

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

// Phases
// Show controls to configure server details
const PHASE_SERVER_DETAILS = 0;
// Show the forgot password inputs
const PHASE_FORGOT = 1;
// Email is in the process of being sent
const PHASE_SENDING_EMAIL = 2;
// Email has been sent
const PHASE_EMAIL_SENT = 3;
// User has clicked the link in email and completed reset
const PHASE_DONE = 4;

module.exports = React.createClass({
    displayName: 'ForgotPassword',

    propTypes: {
        // The default server name to use when the user hasn't specified
        // one. If set, `defaultHsUrl` and `defaultHsUrl` were derived for this
        // via `.well-known` discovery. The server name is used instead of the
        // HS URL when talking about "your account".
        defaultServerName: PropTypes.string,
        // An error passed along from higher up explaining that something
        // went wrong when finding the defaultHsUrl.
        defaultServerDiscoveryError: PropTypes.string,

        defaultHsUrl: PropTypes.string,
        defaultIsUrl: PropTypes.string,
        customHsUrl: PropTypes.string,
        customIsUrl: PropTypes.string,

        onLoginClick: PropTypes.func,
        onComplete: PropTypes.func.isRequired,
    },

    getInitialState: function() {
        return {
            enteredHsUrl: this.props.customHsUrl || this.props.defaultHsUrl,
            enteredIsUrl: this.props.customIsUrl || this.props.defaultIsUrl,
            phase: PHASE_FORGOT,
            email: "",
            password: "",
            password2: "",
            errorText: null,
        };
    },

    submitPasswordReset: function(hsUrl, identityUrl, email, password) {
        this.setState({
            phase: PHASE_SENDING_EMAIL,
        });
        this.reset = new PasswordReset(hsUrl, identityUrl);
        this.reset.resetPassword(email, password).done(() => {
            this.setState({
                phase: PHASE_EMAIL_SENT,
            });
        }, (err) => {
            this.showErrorDialog(_t('Failed to send email') + ": " + err.message);
            this.setState({
                phase: PHASE_FORGOT,
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
            this.setState({ phase: PHASE_DONE });
        }, (err) => {
            this.showErrorDialog(err.message);
        });
    },

    onSubmitForm: function(ev) {
        ev.preventDefault();

        // Don't allow the user to register if there's a discovery error
        // Without this, the user could end up registering on the wrong homeserver.
        if (this.props.defaultServerDiscoveryError) {
            this.setState({errorText: this.props.defaultServerDiscoveryError});
            return;
        }

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
                            this.state.enteredHsUrl, this.state.enteredIsUrl,
                            this.state.email, this.state.password,
                        );
                    }
                },
            });
        }
    },

    _onExportE2eKeysClicked: function() {
        Modal.createTrackedDialogAsync('Export E2E Keys', 'Forgot Password',
            import('../../../async-components/views/dialogs/ExportE2eKeysDialog'),
            {
                matrixClient: MatrixClientPeg.get(),
            },
        );
    },

    onInputChanged: function(stateKey, ev) {
        this.setState({
            [stateKey]: ev.target.value,
        });
    },

    onServerConfigChange: function(config) {
        const newState = {};
        if (config.hsUrl !== undefined) {
            newState.enteredHsUrl = config.hsUrl;
        }
        if (config.isUrl !== undefined) {
            newState.enteredIsUrl = config.isUrl;
        }
        this.setState(newState);
    },

    onServerDetailsNextPhaseClick(ev) {
        ev.stopPropagation();
        this.setState({
            phase: PHASE_FORGOT,
        });
    },

    onEditServerDetailsClick(ev) {
        ev.preventDefault();
        ev.stopPropagation();
        this.setState({
            phase: PHASE_SERVER_DETAILS,
        });
    },

    onLoginClick: function(ev) {
        ev.preventDefault();
        ev.stopPropagation();
        this.props.onLoginClick();
    },

    showErrorDialog: function(body, title) {
        const ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
        Modal.createTrackedDialog('Forgot Password Error', '', ErrorDialog, {
            title: title,
            description: body,
        });
    },

    renderServerDetails() {
        const ServerConfig = sdk.getComponent("auth.ServerConfig");
        const AccessibleButton = sdk.getComponent("elements.AccessibleButton");

        if (SdkConfig.get()['disable_custom_urls']) {
            return null;
        }

        return <div>
            <ServerConfig
                defaultHsUrl={this.props.defaultHsUrl}
                defaultIsUrl={this.props.defaultIsUrl}
                customHsUrl={this.state.enteredHsUrl}
                customIsUrl={this.state.enteredIsUrl}
                onServerConfigChange={this.onServerConfigChange}
                delayTimeMs={0} />
            <AccessibleButton className="mx_Login_submit"
                onClick={this.onServerDetailsNextPhaseClick}
            >
                {_t("Next")}
            </AccessibleButton>
        </div>;
    },

    renderForgot() {
        let errorText = null;
        const err = this.state.errorText || this.props.defaultServerDiscoveryError;
        if (err) {
            errorText = <div className="mx_Login_error">{ err }</div>;
        }

        let yourMatrixAccountText = _t('Your Matrix account');
        if (this.state.enteredHsUrl === this.props.defaultHsUrl) {
            yourMatrixAccountText = _t('Your Matrix account on %(serverName)s', {
                serverName: this.props.defaultServerName,
            });
        } else {
            try {
                const parsedHsUrl = new URL(this.state.enteredHsUrl);
                yourMatrixAccountText = _t('Your Matrix account on %(serverName)s', {
                    serverName: parsedHsUrl.hostname,
                });
            } catch (e) {
                errorText = <div className="mx_Login_error">{_t(
                    "The homeserver URL %(hsUrl)s doesn't seem to be valid URL. Please " +
                    "enter a valid URL including the protocol prefix.",
                {
                    hsUrl: this.state.enteredHsUrl,
                })}</div>;
            }
        }

        // If custom URLs are allowed, wire up the server details edit link.
        let editLink = null;
        if (!SdkConfig.get()['disable_custom_urls']) {
            editLink = <a className="mx_AuthBody_editServerDetails"
                href="#" onClick={this.onEditServerDetailsClick}
            >
                {_t('Change')}
            </a>;
        }

        return <div>
            <h3>
                {yourMatrixAccountText}
                {editLink}
            </h3>
            {errorText}
            <form onSubmit={this.onSubmitForm}>
                <div className="mx_AuthBody_fieldRow">
                    <input className="mx_Login_field" type="text"
                        name="reset_email" // define a name so browser's password autofill gets less confused
                        value={this.state.email}
                        onChange={this.onInputChanged.bind(this, "email")}
                        placeholder={_t('Email')} autoFocus />
                </div>
                <div className="mx_AuthBody_fieldRow">
                    <input className="mx_Login_field" type="password"
                        name="reset_password"
                        value={this.state.password}
                        onChange={this.onInputChanged.bind(this, "password")}
                        placeholder={_t('Password')} />
                    <input className="mx_Login_field" type="password"
                        name="reset_password_confirm"
                        value={this.state.password2}
                        onChange={this.onInputChanged.bind(this, "password2")}
                        placeholder={_t('Confirm')} />
                </div>
                <span>{_t(
                    'A verification email will be sent to your inbox to confirm ' +
                    'setting your new password.',
                )}</span>
                <input className="mx_Login_submit" type="submit" value={_t('Send Reset Email')} />
            </form>
            <a className="mx_AuthBody_changeFlow" onClick={this.onLoginClick} href="#">
                {_t('Sign in instead')}
            </a>
        </div>;
    },

    renderSendingEmail() {
        const Spinner = sdk.getComponent("elements.Spinner");
        return <Spinner />;
    },

    renderEmailSent() {
        return <div>
            {_t("An email has been sent to %(emailAddress)s. Once you've followed the " +
                "link it contains, click below.", { emailAddress: this.state.email })}
            <br />
            <input className="mx_Login_submit" type="button" onClick={this.onVerify}
                value={_t('I have verified my email address')} />
        </div>;
    },

    renderDone() {
        return <div>
            <p>{_t("Your password has been reset.")}</p>
            <p>{_t(
                "You have been logged out of all devices and will no longer receive " +
                "push notifications. To re-enable notifications, sign in again on each " +
                "device.",
            )}</p>
            <input className="mx_Login_submit" type="button" onClick={this.props.onComplete}
                value={_t('Return to login screen')} />
        </div>;
    },

    render: function() {
        const AuthPage = sdk.getComponent("auth.AuthPage");
        const AuthHeader = sdk.getComponent("auth.AuthHeader");
        const AuthBody = sdk.getComponent("auth.AuthBody");

        let resetPasswordJsx;
        switch (this.state.phase) {
            case PHASE_SERVER_DETAILS:
                resetPasswordJsx = this.renderServerDetails();
                break;
            case PHASE_FORGOT:
                resetPasswordJsx = this.renderForgot();
                break;
            case PHASE_SENDING_EMAIL:
                resetPasswordJsx = this.renderSendingEmail();
                break;
            case PHASE_EMAIL_SENT:
                resetPasswordJsx = this.renderEmailSent();
                break;
            case PHASE_DONE:
                resetPasswordJsx = this.renderDone();
                break;
        }

        return (
            <AuthPage>
                <AuthHeader />
                <AuthBody>
                    <h2> { _t('Set a new password') } </h2>
                    {resetPasswordJsx}
                </AuthBody>
            </AuthPage>
        );
    },
});

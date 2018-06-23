/*
Copyright 2015, 2016 OpenMarket Ltd
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
import PropTypes from 'prop-types';
import classNames from 'classnames';
import sdk from '../../../index';
import { _t } from '../../../languageHandler';
import {field_input_incorrect} from '../../../UiEffects';
import SdkConfig from '../../../SdkConfig';

/**
 * A pure UI component which displays a username/password form.
 */
class PasswordLogin extends React.Component {
    static defaultProps = {
        onError: function() {},
        onUsernameChanged: function() {},
        onPasswordChanged: function() {},
        onPhoneCountryChanged: function() {},
        onPhoneNumberChanged: function() {},
        initialUsername: "",
        initialPhoneCountry: "",
        initialPhoneNumber: "",
        initialPassword: "",
        loginIncorrect: false,
        hsDomain: "",
    }

    constructor(props) {
        super(props);
        this.state = {
            username: this.props.initialUsername,
            password: this.props.initialPassword,
            phoneCountry: this.props.initialPhoneCountry,
            phoneNumber: this.props.initialPhoneNumber,
            loginType: PasswordLogin.LOGIN_FIELD_MXID,
        };

        this.onSubmitForm = this.onSubmitForm.bind(this);
        this.onUsernameChanged = this.onUsernameChanged.bind(this);
        this.onLoginTypeChange = this.onLoginTypeChange.bind(this);
        this.onPhoneCountryChanged = this.onPhoneCountryChanged.bind(this);
        this.onPhoneNumberChanged = this.onPhoneNumberChanged.bind(this);
        this.onPasswordChanged = this.onPasswordChanged.bind(this);
    }

    componentWillMount() {
        this._passwordField = null;
    }

    componentWillReceiveProps(nextProps) {
        if (!this.props.loginIncorrect && nextProps.loginIncorrect) {
            field_input_incorrect(this._passwordField);
        }
    }

    onSubmitForm(ev) {
        ev.preventDefault();

        let username = ''; // XXX: Synapse breaks if you send null here:
        let phoneCountry = null;
        let phoneNumber = null;
        let error;

        switch (this.state.loginType) {
            case PasswordLogin.LOGIN_FIELD_EMAIL:
                username = this.state.username;
                if (!username) {
                    error = _t('The email field must not be blank.');
                }
                break;
            case PasswordLogin.LOGIN_FIELD_MXID:
                username = this.state.username;
                if (!username) {
                    error = _t('The user name field must not be blank.');
                }
                break;
            case PasswordLogin.LOGIN_FIELD_PHONE:
                phoneCountry = this.state.phoneCountry;
                phoneNumber = this.state.phoneNumber;
                if (!phoneNumber) {
                    error = _t('The phone number field must not be blank.');
                }
                break;
        }

        if (error) {
            this.props.onError(error);
            return;
        }

        if (!this.state.password) {
            this.props.onError(_t('The password field must not be blank.'));
            return;
        }

        this.props.onSubmit(
            username,
            phoneCountry,
            phoneNumber,
            this.state.password,
        );
    }

    onUsernameChanged(ev) {
        this.setState({username: ev.target.value});
        this.props.onUsernameChanged(ev.target.value);
    }

    onLoginTypeChange(loginType) {
        this.props.onError(null); // send a null error to clear any error messages
        this.setState({
            loginType: loginType,
            username: "", // Reset because email and username use the same state
        });
    }

    onPhoneCountryChanged(country) {
        this.setState({
            phoneCountry: country.iso2,
            phonePrefix: country.prefix,
        });
        this.props.onPhoneCountryChanged(country.iso2);
    }

    onPhoneNumberChanged(ev) {
        this.setState({phoneNumber: ev.target.value});
        this.props.onPhoneNumberChanged(ev.target.value);
    }

    onPasswordChanged(ev) {
        this.setState({password: ev.target.value});
        this.props.onPasswordChanged(ev.target.value);
    }

    renderLoginField(loginType, disabled) {
        const classes = {
            mx_Login_field: true,
            mx_Login_field_disabled: disabled,
        };

        switch (loginType) {
            case PasswordLogin.LOGIN_FIELD_EMAIL:
                classes.mx_Login_email = true;
                return <input
                    className={classNames(classes)}
                    key="email_input"
                    type="text"
                    name="username" // make it a little easier for browser's remember-password
                    onChange={this.onUsernameChanged}
                    placeholder="joe@example.com"
                    value={this.state.username}
                    autoFocus
                    disabled={disabled}
                />;
            case PasswordLogin.LOGIN_FIELD_MXID:
                classes.mx_Login_username = true;
                return <input
                    className={classNames(classes)}
                    key="username_input"
                    type="text"
                    name="username" // make it a little easier for browser's remember-password
                    onChange={this.onUsernameChanged}
                    placeholder={SdkConfig.get().disable_custom_urls ?
                                      _t("Username on %(hs)s", {
                                        hs: this.props.hsUrl.replace(/^https?:\/\//, ''),
                                      }) : _t("User name")}
                    value={this.state.username}
                    autoFocus
                    disabled={disabled}
                />;
            case PasswordLogin.LOGIN_FIELD_PHONE:
                const CountryDropdown = sdk.getComponent('views.login.CountryDropdown');
                classes.mx_Login_phoneNumberField = true;
                classes.mx_Login_field_has_prefix = true;
                return <div className="mx_Login_phoneSection">
                    <CountryDropdown
                        className="mx_Login_phoneCountry mx_Login_field_prefix"
                        ref="phone_country"
                        onOptionChange={this.onPhoneCountryChanged}
                        value={this.state.phoneCountry}
                        isSmall={true}
                        showPrefix={true}
                        disabled={disabled}
                    />
                    <input
                        className={classNames(classes)}
                        ref="phoneNumber"
                        key="phone_input"
                        type="text"
                        name="phoneNumber"
                        onChange={this.onPhoneNumberChanged}
                        placeholder={_t("Mobile phone number")}
                        value={this.state.phoneNumber}
                        autoFocus
                        disabled={disabled}
                    />
                </div>;
        }
    }

    render() {
        let forgotPasswordJsx;

        if (this.props.onForgotPasswordClick) {
            forgotPasswordJsx = (
                <a className="mx_Login_forgot" onClick={this.props.onForgotPasswordClick} href="#">
                    { _t('Forgot your password?') }
                </a>
            );
        }

        let matrixIdText = '';
        if (this.props.hsUrl) {
            try {
                const parsedHsUrl = new URL(this.props.hsUrl);
                matrixIdText = _t('%(serverName)s Matrix ID', {serverName: parsedHsUrl.hostname});
            } catch (e) {
                // pass
            }
        }

        const pwFieldClass = classNames({
            mx_Login_field: true,
            mx_Login_field_disabled: matrixIdText === '',
            error: this.props.loginIncorrect,
        });

        const Dropdown = sdk.getComponent('elements.Dropdown');

        const loginField = this.renderLoginField(this.state.loginType, matrixIdText === '');

        let loginType;
        if (!SdkConfig.get().disable_3pid_login) {
            loginType = (
                <div className="mx_Login_type_container">
                    <label className="mx_Login_type_label">{ _t('Sign in with') }</label>
                    <Dropdown
                        className="mx_Login_type_dropdown"
                        value={this.state.loginType}
                        disabled={matrixIdText === ''}
                        onOptionChange={this.onLoginTypeChange}>
                            <span key={PasswordLogin.LOGIN_FIELD_MXID}>{ matrixIdText }</span>
                            <span key={PasswordLogin.LOGIN_FIELD_EMAIL}>{ _t('Email address') }</span>
                            <span key={PasswordLogin.LOGIN_FIELD_PHONE}>{ _t('Phone') }</span>
                    </Dropdown>
                </div>
            );
        }

        return (
            <div>
                <form onSubmit={this.onSubmitForm}>
                { loginType }
                { loginField }
                <input className={pwFieldClass} ref={(e) => {this._passwordField = e;}} type="password"
                    name="password"
                    value={this.state.password} onChange={this.onPasswordChanged}
                    placeholder={_t('Password')}
                    disabled={matrixIdText === ''}
                />
                <br />
                { forgotPasswordJsx }
                <input className="mx_Login_submit" type="submit" value={_t('Sign in')} disabled={matrixIdText === ''} />
                </form>
            </div>
        );
    }
}

PasswordLogin.LOGIN_FIELD_EMAIL = "login_field_email";
PasswordLogin.LOGIN_FIELD_MXID = "login_field_mxid";
PasswordLogin.LOGIN_FIELD_PHONE = "login_field_phone";

PasswordLogin.propTypes = {
    onSubmit: PropTypes.func.isRequired, // fn(username, password)
    onError: PropTypes.func,
    onForgotPasswordClick: PropTypes.func, // fn()
    initialUsername: PropTypes.string,
    initialPhoneCountry: PropTypes.string,
    initialPhoneNumber: PropTypes.string,
    initialPassword: PropTypes.string,
    onUsernameChanged: PropTypes.func,
    onPhoneCountryChanged: PropTypes.func,
    onPhoneNumberChanged: PropTypes.func,
    onPasswordChanged: PropTypes.func,
    loginIncorrect: PropTypes.bool,
};

module.exports = PasswordLogin;

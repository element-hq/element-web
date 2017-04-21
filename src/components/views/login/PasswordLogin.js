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
import ReactDOM from 'react-dom';
import classNames from 'classnames';
import sdk from '../../../index';
import {field_input_incorrect} from '../../../UiEffects';


/**
 * A pure UI component which displays a username/password form.
 */
class PasswordLogin extends React.Component {
    static defaultProps = {
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
        this.props.onSubmit(
            this.state.username,
            this.state.phoneCountry,
            this.state.phoneNumber,
            this.state.password,
        );
    }

    onUsernameChanged(ev) {
        this.setState({username: ev.target.value});
        this.props.onUsernameChanged(ev.target.value);
    }

    onLoginTypeChange(loginType) {
        this.setState({
            loginType: loginType,
            username: "" // Reset because email and username use the same state
        });
    }

    onPhoneCountryChanged(country) {
        this.setState({phoneCountry: country});
        this.props.onPhoneCountryChanged(country);
    }

    onPhoneNumberChanged(ev) {
        this.setState({phoneNumber: ev.target.value});
        this.props.onPhoneNumberChanged(ev.target.value);
    }

    onPasswordChanged(ev) {
        this.setState({password: ev.target.value});
        this.props.onPasswordChanged(ev.target.value);
    }

    renderLoginField(loginType) {
        switch(loginType) {
            case PasswordLogin.LOGIN_FIELD_EMAIL:
                return <input
                    className="mx_Login_field mx_Login_email"
                    key="email_input"
                    type="text"
                    name="username" // make it a little easier for browser's remember-password
                    onChange={this.onUsernameChanged}
                    placeholder="joe@example.com"
                    value={this.state.username}
                    autoFocus
                />;
            case PasswordLogin.LOGIN_FIELD_MXID:
                const mxidInputClasses = classNames({
                    "mx_Login_field": true,
                    "mx_Login_username": true,
                    "mx_Login_field_has_suffix": Boolean(this.props.hsDomain),
                });
                let suffix = null;
                if (this.props.hsDomain) {
                    suffix = <div className="mx_Login_username_suffix">
                        :{this.props.hsDomain}
                    </div>;
                }
                return <div className="mx_Login_username_group">
                    <div className="mx_Login_username_prefix">@</div>
                    <input
                        className={mxidInputClasses}
                        key="username_input"
                        type="text"
                        name="username" // make it a little easier for browser's remember-password
                        onChange={this.onUsernameChanged}
                        placeholder="username"
                        value={this.state.username}
                        autoFocus
                    />
                    {suffix}
                </div>;
            case PasswordLogin.LOGIN_FIELD_PHONE:
                const CountryDropdown = sdk.getComponent('views.login.CountryDropdown');
                return <div className="mx_Login_phoneSection">
                    <CountryDropdown
                        className="mx_Login_phoneCountry"
                        ref="phone_country"
                        onOptionChange={this.onPhoneCountryChanged}
                        value={this.state.phoneCountry}
                    />
                    <input
                        className="mx_Login_phoneNumberField mx_Login_field"
                        ref="phoneNumber"
                        key="phone_input"
                        type="text"
                        name="phoneNumber"
                        onChange={this.onPhoneNumberChanged}
                        placeholder="Mobile phone number"
                        value={this.state.phoneNumber}
                        autoFocus
                    />
                </div>;
        }
    }

    render() {
        var forgotPasswordJsx;

        if (this.props.onForgotPasswordClick) {
            forgotPasswordJsx = (
                <a className="mx_Login_forgot" onClick={this.props.onForgotPasswordClick} href="#">
                    Forgot your password?
                </a>
            );
        }

        const pwFieldClass = classNames({
            mx_Login_field: true,
            error: this.props.loginIncorrect,
        });

        const Dropdown = sdk.getComponent('elements.Dropdown');

        const loginField = this.renderLoginField(this.state.loginType);

        return (
            <div>
                <form onSubmit={this.onSubmitForm}>
                <div className="mx_Login_type_container">
                    <label className="mx_Login_type_label">I want to sign in with my</label>
                    <Dropdown
                        className="mx_Login_type_dropdown"
                        value={this.state.loginType}
                        onOptionChange={this.onLoginTypeChange}>
                            <span key={PasswordLogin.LOGIN_FIELD_MXID}>Matrix ID</span>
                            <span key={PasswordLogin.LOGIN_FIELD_EMAIL}>Email Address</span>
                            <span key={PasswordLogin.LOGIN_FIELD_PHONE}>Phone</span>
                    </Dropdown>
                </div>
                {loginField}
                <input className={pwFieldClass} ref={(e) => {this._passwordField = e;}} type="password"
                    name="password"
                    value={this.state.password} onChange={this.onPasswordChanged}
                    placeholder="Password" />
                <br />
                {forgotPasswordJsx}
                <input className="mx_Login_submit" type="submit" value="Sign in" />
                </form>
            </div>
        );
    }
}

PasswordLogin.LOGIN_FIELD_EMAIL = "login_field_email";
PasswordLogin.LOGIN_FIELD_MXID = "login_field_mxid";
PasswordLogin.LOGIN_FIELD_PHONE = "login_field_phone";

PasswordLogin.propTypes = {
    onSubmit: React.PropTypes.func.isRequired, // fn(username, password)
    onForgotPasswordClick: React.PropTypes.func, // fn()
    initialUsername: React.PropTypes.string,
    initialPhoneCountry: React.PropTypes.string,
    initialPhoneNumber: React.PropTypes.string,
    initialPassword: React.PropTypes.string,
    onUsernameChanged: React.PropTypes.func,
    onPhoneCountryChanged: React.PropTypes.func,
    onPhoneNumberChanged: React.PropTypes.func,
    onPasswordChanged: React.PropTypes.func,
    loginIncorrect: React.PropTypes.bool,
    hsDomain: React.PropTypes.string,
};

module.exports = PasswordLogin;

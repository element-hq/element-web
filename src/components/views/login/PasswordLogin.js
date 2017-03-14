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
module.exports = React.createClass({displayName: 'PasswordLogin',
    propTypes: {
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
    },

    getDefaultProps: function() {
        return {
            onUsernameChanged: function() {},
            onPasswordChanged: function() {},
            onPhoneCountryChanged: function() {},
            onPhoneNumberChanged: function() {},
            initialUsername: "",
            initialPhoneCountry: "",
            initialPhoneNumber: "",
            initialPassword: "",
            loginIncorrect: false,
        };
    },

    getInitialState: function() {
        return {
            username: this.props.initialUsername,
            password: this.props.initialPassword,
            phoneCountry: this.props.initialPhoneCountry,
            phoneNumber: this.props.initialPhoneNumber,
        };
    },

    componentWillMount: function() {
        this._passwordField = null;
    },

    componentWillReceiveProps: function(nextProps) {
        if (!this.props.loginIncorrect && nextProps.loginIncorrect) {
            field_input_incorrect(this._passwordField);
        }
    },

    onSubmitForm: function(ev) {
        ev.preventDefault();
        this.props.onSubmit(
            this.state.username,
            this.state.phoneCountry,
            this.state.phoneNumber,
            this.state.password,
        );
    },

    onUsernameChanged: function(ev) {
        this.setState({username: ev.target.value});
        this.props.onUsernameChanged(ev.target.value);
    },

    onPhoneCountryChanged: function(country) {
        this.setState({phoneCountry: country});
        this.props.onPhoneCountryChanged(country);
    },

    onPhoneNumberChanged: function(ev) {
        this.setState({phoneNumber: ev.target.value});
        this.props.onPhoneNumberChanged(ev.target.value);
    },

    onPasswordChanged: function(ev) {
        this.setState({password: ev.target.value});
        this.props.onPasswordChanged(ev.target.value);
    },

    render: function() {
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

        const CountryDropdown = sdk.getComponent('views.login.CountryDropdown');
        return (
            <div>
                <form onSubmit={this.onSubmitForm}>
                <input className="mx_Login_field mx_Login_username" type="text"
                    name="username" // make it a little easier for browser's remember-password
                    value={this.state.username} onChange={this.onUsernameChanged}
                    placeholder="Email or user name" autoFocus />
                or
                <div className="mx_Login_phoneSection">
                    <CountryDropdown ref="phone_country" onOptionChange={this.onPhoneCountryChanged}
                        className="mx_Login_phoneCountry"
                        value={this.state.phoneCountry}
                    />
                    <input type="text" ref="phoneNumber"
                        onChange={this.onPhoneNumberChanged}
                        placeholder="Mobile phone number"
                        className="mx_Login_phoneNumberField mx_Login_field"
                        value={this.state.phoneNumber}
                        name="phoneNumber"
                    />
                </div>
                <br />
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
});

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

import React from 'react';
import ReactDOM from 'react-dom';
import classNames from 'classnames';
import {field_input_incorrect} from '../../../UiEffects';


/**
 * A pure UI component which displays a username/password form.
 */
module.exports = React.createClass({displayName: 'PasswordLogin',
    propTypes: {
        onSubmit: React.PropTypes.func.isRequired, // fn(username, password)
        onForgotPasswordClick: React.PropTypes.func, // fn()
        initialUsername: React.PropTypes.string,
        initialPassword: React.PropTypes.string,
        onUsernameChanged: React.PropTypes.func,
        onPasswordChanged: React.PropTypes.func,
        loginIncorrect: React.PropTypes.bool,
    },

    getDefaultProps: function() {
        return {
            onUsernameChanged: function() {},
            onPasswordChanged: function() {},
            initialUsername: "",
            initialPassword: "",
            loginIncorrect: false,
        };
    },

    getInitialState: function() {
        return {
            username: this.props.initialUsername,
            password: this.props.initialPassword,
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
        this.props.onSubmit(this.state.username, this.state.password);
    },

    onUsernameChanged: function(ev) {
        this.setState({username: ev.target.value});
        this.props.onUsernameChanged(ev.target.value);
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

        return (
            <div>
                <form onSubmit={this.onSubmitForm}>
                <input className="mx_Login_field" type="text"
                    value={this.state.username} onChange={this.onUsernameChanged}
                    placeholder="Email or user name" autoFocus />
                <br />
                <input className={pwFieldClass} ref={(e) => {this._passwordField = e;}} type="password"
                    value={this.state.password} onChange={this.onPasswordChanged}
                    placeholder="Password" />
                <br />
                {forgotPasswordJsx}
                <input className="mx_Login_submit" type="submit" value="Log in" />
                </form>
            </div>
        );
    }
});

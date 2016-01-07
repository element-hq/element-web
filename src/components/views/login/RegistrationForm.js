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

/**
 * A pure UI component which displays a registration form.
 */
module.exports = React.createClass({
    displayName: 'RegistrationForm',

    propTypes: {
        defaultEmail: React.PropTypes.string,
        defaultUsername: React.PropTypes.string,
        showEmail: React.PropTypes.bool,
        minPasswordLength: React.PropTypes.number,
        onError: React.PropTypes.func,
        onRegisterClick: React.PropTypes.func // onRegisterClick(Object) => ?Promise
    },

    getDefaultProps: function() {
        return {
            showEmail: false,
            minPasswordLength: 6,
            onError: function(e) {
                console.error(e);
            }
        };
    },

    getInitialState: function() {
        return {
            email: this.props.defaultEmail,
            username: this.props.defaultUsername,
            password: null,
            passwordConfirm: null
        };
    },

    onSubmit: function(ev) {
        ev.preventDefault();

        var pwd1 = this.refs.password.value.trim();
        var pwd2 = this.refs.passwordConfirm.value.trim()

        var errCode;
        if (!pwd1 || !pwd2) {
            errCode = "RegistrationForm.ERR_PASSWORD_MISSING";
        }
        else if (pwd1 !== pwd2) {
            errCode = "RegistrationForm.ERR_PASSWORD_MISMATCH";
        }
        else if (pwd1.length < this.props.minPasswordLength) {
            errCode = "RegistrationForm.ERR_PASSWORD_LENGTH";
        }
        if (errCode) {
            this.props.onError(errCode);
            return;
        }

        var promise = this.props.onRegisterClick({
            username: this.refs.username.value.trim(),
            password: pwd1,
            email: this.refs.email.value.trim()
        });

        if (promise) {
            ev.target.disabled = true;
            promise.finally(function() {
                ev.target.disabled = false;
            });
        }
    },

    render: function() {
        var emailSection, registerButton;
        if (this.props.showEmail) {
            emailSection = (
                <input className="mx_Login_field" type="text" ref="email"
                    autoFocus={true} placeholder="Email address"
                    defaultValue={this.state.email} />
            );
        }
        if (this.props.onRegisterClick) {
            registerButton = (
                <input className="mx_Login_submit" type="submit" value="Register" />
            );
        }

        return (
            <div>
                <form onSubmit={this.onSubmit}>
                    {emailSection}
                    <br />
                    <input className="mx_Login_field" type="text" ref="username"
                        placeholder="User name" defaultValue={this.state.username} />
                    <br />
                    <input className="mx_Login_field" type="password" ref="password"
                        placeholder="Password" defaultValue={this.state.password} />
                    <br />
                    <input className="mx_Login_field" type="password" ref="passwordConfirm"
                        placeholder="Confirm password"
                        defaultValue={this.state.passwordConfirm} />
                    <br />
                    {registerButton}
                </form>
            </div>
        );
    }
});

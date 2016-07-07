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
var Velocity = require('velocity-vector');
require('velocity-vector/velocity.ui');
var sdk = require('../../../index');
var Email = require('../../../email');
var Modal = require("../../../Modal");

var FIELD_EMAIL = 'field_email';
var FIELD_USERNAME = 'field_username';
var FIELD_PASSWORD = 'field_password';
var FIELD_PASSWORD_CONFIRM = 'field_password_confirm';

/**
 * A pure UI component which displays a registration form.
 */
module.exports = React.createClass({
    displayName: 'RegistrationForm',

    propTypes: {
        // Values pre-filled in the input boxes when the component loads
        defaultEmail: React.PropTypes.string,
        defaultUsername: React.PropTypes.string,
        defaultPassword: React.PropTypes.string,

        // A username that will be used if no username is entered.
        // Specifying this param will also warn the user that entering
        // a different username will cause a fresh account to be generated.
        guestUsername: React.PropTypes.string,

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
            fieldValid: {}
        };
    },

    onSubmit: function(ev) {
        ev.preventDefault();

        // validate everything, in reverse order so
        // the error that ends up being displayed
        // is the one from the first invalid field.
        // It's not super ideal that this just calls
        // onError once for each invalid field.
        this.validateField(FIELD_PASSWORD_CONFIRM);
        this.validateField(FIELD_PASSWORD);
        this.validateField(FIELD_USERNAME);
        this.validateField(FIELD_EMAIL);

        var self = this;
        if (this.allFieldsValid()) {
            if (this.refs.email.value == '') {
                var QuestionDialog = sdk.getComponent("dialogs.QuestionDialog");
                Modal.createDialog(QuestionDialog, {
                    title: "Warning",
                    description:
                        <div>
                            If you don't specify an email address, you won't be able to reset your password.<br/>
                            Are you sure?
                        </div>,
                    button: "Continue",
                    onFinished: function(confirmed) {
                        if (confirmed) {
                            self._doSubmit();
                        }
                    },
                });
            }
            else {
                self._doSubmit();
            }
        }
    },

    _doSubmit: function() {
        var promise = this.props.onRegisterClick({
            username: this.refs.username.value.trim() || this.props.guestUsername,
            password: this.refs.password.value.trim(),
            email: this.refs.email.value.trim()
        });

        if (promise) {
            ev.target.disabled = true;
            promise.finally(function() {
                ev.target.disabled = false;
            });
        }        
    },

    /**
     * Returns true if all fields were valid last time
     * they were validated.
     */
    allFieldsValid: function() {
        var keys = Object.keys(this.state.fieldValid);
        for (var i = 0; i < keys.length; ++i) {
            if (this.state.fieldValid[keys[i]] == false) {
                return false;
            }
        }
        return true;
    },

    validateField: function(field_id) {
        var pwd1 = this.refs.password.value.trim();
        var pwd2 = this.refs.passwordConfirm.value.trim()

        switch (field_id) {
            case FIELD_EMAIL:
                this.markFieldValid(
                    field_id,
                    this.refs.email.value == '' || Email.looksValid(this.refs.email.value),
                    "RegistrationForm.ERR_EMAIL_INVALID"
                );
                break;
            case FIELD_USERNAME:
                // XXX: SPEC-1
                var username = this.refs.username.value.trim() || this.props.guestUsername;
                if (encodeURIComponent(username) != username) {
                    this.markFieldValid(
                        field_id,
                        false,
                        "RegistrationForm.ERR_USERNAME_INVALID"
                    );
                } else if (username == '') {
                    this.markFieldValid(
                        field_id,
                        false,
                        "RegistrationForm.ERR_USERNAME_BLANK"
                    );
                } else {
                    this.markFieldValid(field_id, true);
                }
                break;
            case FIELD_PASSWORD:
                if (pwd1 == '') {
                    this.markFieldValid(
                        field_id,
                        false,
                        "RegistrationForm.ERR_PASSWORD_MISSING"
                    );
                } else if (pwd1.length < this.props.minPasswordLength) {
                    this.markFieldValid(
                        field_id,
                        false,
                        "RegistrationForm.ERR_PASSWORD_LENGTH"
                    );
                } else {
                    this.markFieldValid(field_id, true);
                }
                break;
            case FIELD_PASSWORD_CONFIRM:
                this.markFieldValid(
                    field_id, pwd1 == pwd2,
                    "RegistrationForm.ERR_PASSWORD_MISMATCH"
                );
                break;
        }
    },

    markFieldValid: function(field_id, val, error_code) {
        var fieldValid = this.state.fieldValid;
        fieldValid[field_id] = val;
        this.setState({fieldValid: fieldValid});
        if (!val) {
            Velocity(this.fieldElementById(field_id), "callout.shake", 300);
            this.props.onError(error_code);
        }
    },

    fieldElementById(field_id) {
        switch (field_id) {
            case FIELD_EMAIL:
                return this.refs.email;
            case FIELD_USERNAME:
                return this.refs.username;
            case FIELD_PASSWORD:
                return this.refs.password;
            case FIELD_PASSWORD_CONFIRM:
                return this.refs.passwordConfirm;
        }
    },

    _styleField: function(field_id, baseStyle) {
        var style = baseStyle || {};
        if (this.state.fieldValid[field_id] === false) {
            style['borderColor'] = 'red';
        }
        return style;
    },

    render: function() {
        var self = this;
        var emailSection, registerButton;
        if (this.props.showEmail) {
            emailSection = (
                <input className="mx_Login_field" type="text" ref="email"
                    autoFocus={true} placeholder="Email address (optional)"
                    defaultValue={this.props.defaultEmail}
                    style={this._styleField(FIELD_EMAIL)}
                    onBlur={function() {self.validateField(FIELD_EMAIL)}} />
            );
        }
        if (this.props.onRegisterClick) {
            registerButton = (
                <input className="mx_Login_submit" type="submit" value="Register" />
            );
        }

        var placeholderUserName = "User name";
        if (this.props.guestUsername) {
            placeholderUserName += " (default: " + this.props.guestUsername + ")"
        }

        return (
            <div>
                <form onSubmit={this.onSubmit}>
                    {emailSection}
                    <br />
                    <input className="mx_Login_field" type="text" ref="username"
                        placeholder={ placeholderUserName } defaultValue={this.props.defaultUsername}
                        style={this._styleField(FIELD_USERNAME)}
                        onBlur={function() {self.validateField(FIELD_USERNAME)}} />
                    <br />
                    { this.props.guestUsername ?
                        <div className="mx_Login_fieldLabel">Setting a user name will create a fresh account</div> : null
                    }
                    <input className="mx_Login_field" type="password" ref="password"
                        style={this._styleField(FIELD_PASSWORD)}
                        onBlur={function() {self.validateField(FIELD_PASSWORD)}}
                        placeholder="Password" defaultValue={this.props.defaultPassword} />
                    <br />
                    <input className="mx_Login_field" type="password" ref="passwordConfirm"
                        placeholder="Confirm password"
                        style={this._styleField(FIELD_PASSWORD_CONFIRM)}
                        onBlur={function() {self.validateField(FIELD_PASSWORD_CONFIRM)}}
                        defaultValue={this.props.defaultPassword} />
                    <br />
                    {registerButton}
                </form>
            </div>
        );
    }
});

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
import { field_input_incorrect } from '../../../UiEffects';
import sdk from '../../../index';
import Email from '../../../email';
import Modal from '../../../Modal';

const FIELD_EMAIL = 'field_email';
const FIELD_USERNAME = 'field_username';
const FIELD_PASSWORD = 'field_password';
const FIELD_PASSWORD_CONFIRM = 'field_password_confirm';

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
        teamsConfig: React.PropTypes.shape({
            // Email address to request new teams
            supportEmail: React.PropTypes.string,
            teams: React.PropTypes.arrayOf(React.PropTypes.shape({
                // The displayed name of the team
                "name": React.PropTypes.string,
                // The domain of team email addresses
                "domain": React.PropTypes.string,
            })).required,
        }),

        // A username that will be used if no username is entered.
        // Specifying this param will also warn the user that entering
        // a different username will cause a fresh account to be generated.
        guestUsername: React.PropTypes.string,

        minPasswordLength: React.PropTypes.number,
        onError: React.PropTypes.func,
        onRegisterClick: React.PropTypes.func.isRequired, // onRegisterClick(Object) => ?Promise
    },

    getDefaultProps: function() {
        return {
            minPasswordLength: 6,
            onError: function(e) {
                console.error(e);
            }
        };
    },

    getInitialState: function() {
        return {
            fieldValid: {},
            selectedTeam: null,
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
        let email = this.refs.email.value.trim();
        var promise = this.props.onRegisterClick({
            username: this.refs.username.value.trim() || this.props.guestUsername,
            password: this.refs.password.value.trim(),
            email: email,
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

    _isUniEmail: function(email) {
        return email.endsWith('.ac.uk') || email.endsWith('.edu') || email.endsWith('matrix.org');
    },

    validateField: function(field_id) {
        var pwd1 = this.refs.password.value.trim();
        var pwd2 = this.refs.passwordConfirm.value.trim();

        switch (field_id) {
            case FIELD_EMAIL:
                const email = this.refs.email.value;
                if (this.props.teamsConfig && this._isUniEmail(email)) {
                    const matchingTeam = this.props.teamsConfig.teams.find(
                        (team) => {
                            return email.split('@').pop() === team.domain;
                        }
                    ) || null;
                    this.setState({
                        selectedTeam: matchingTeam,
                        showSupportEmail: !matchingTeam,
                    });
                    this.props.onTeamSelected(matchingTeam);
                } else {
                    this.props.onTeamSelected(null);
                    this.setState({
                        selectedTeam: null,
                        showSupportEmail: false,
                    });
                }
                const emailValid = email === '' || Email.looksValid(email);
                this.markFieldValid(field_id, emailValid, "RegistrationForm.ERR_EMAIL_INVALID");
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
            field_input_incorrect(this.fieldElementById(field_id));
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

    _classForField: function(field_id, ...baseClasses) {
        let cls = baseClasses.join(' ');
        if (this.state.fieldValid[field_id] === false) {
            if (cls) cls += ' ';
            cls += 'error';
        }
        return cls;
    },

    render: function() {
        var self = this;

        const emailSection = (
            <div>
                <input type="text" ref="email"
                    autoFocus={true} placeholder="Email address (optional)"
                    defaultValue={this.props.defaultEmail}
                    className={this._classForField(FIELD_EMAIL, 'mx_Login_field')}
                    onBlur={function() {self.validateField(FIELD_EMAIL);}}
                    value={self.state.email}/>
            </div>
        );
        let belowEmailSection;
        if (this.props.teamsConfig) {
            if (this.props.teamsConfig.supportEmail && this.state.showSupportEmail) {
                belowEmailSection = (
                    <p className="mx_Login_support">
                        Sorry, but your university is not registered with us just yet.&nbsp;
                        Email us on&nbsp;
                        <a href={"mailto:" + this.props.teamsConfig.supportEmail}>
                            {this.props.teamsConfig.supportEmail}
                        </a>&nbsp;
                        to get your university signed up. Or continue to register with Riot to enjoy our open source platform.
                    </p>
                );
            } else if (this.state.selectedTeam) {
                belowEmailSection = (
                    <p className="mx_Login_support">
                        You are registering with {this.state.selectedTeam.name}
                    </p>
                );
            }
        }

        const registerButton = (
            <input className="mx_Login_submit" type="submit" value="Register" />
        );

        let placeholderUserName = "User name";
        if (this.props.guestUsername) {
            placeholderUserName += " (default: " + this.props.guestUsername + ")";
        }

        return (
            <div>
                <form onSubmit={this.onSubmit}>
                    {emailSection}
                    {belowEmailSection}
                    <input type="text" ref="username"
                        placeholder={ placeholderUserName } defaultValue={this.props.defaultUsername}
                        className={this._classForField(FIELD_USERNAME, 'mx_Login_field')}
                        onBlur={function() {self.validateField(FIELD_USERNAME);}} />
                    <br />
                    { this.props.guestUsername ?
                        <div className="mx_Login_fieldLabel">Setting a user name will create a fresh account</div> : null
                    }
                    <input type="password" ref="password"
                        className={this._classForField(FIELD_PASSWORD, 'mx_Login_field')}
                        onBlur={function() {self.validateField(FIELD_PASSWORD);}}
                        placeholder="Password" defaultValue={this.props.defaultPassword} />
                    <br />
                    <input type="password" ref="passwordConfirm"
                        placeholder="Confirm password"
                        className={this._classForField(FIELD_PASSWORD_CONFIRM, 'mx_Login_field')}
                        onBlur={function() {self.validateField(FIELD_PASSWORD_CONFIRM);}}
                        defaultValue={this.props.defaultPassword} />
                    <br />
                    {registerButton}
                </form>
            </div>
        );
    }
});

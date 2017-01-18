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
var UiEffects = require('../../../UiEffects');
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
        teamsConfig: React.PropTypes.shape({
            // Email address to request new teams
            supportEmail: React.PropTypes.string,
            teams: React.PropTypes.arrayOf(React.PropTypes.shape({
                // The displayed name of the team
                "name": React.PropTypes.string,
                // The suffix with which every team email address ends
                "emailSuffix": React.PropTypes.string,
            })).required,
        }),

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

    onSelectTeam: function(teamIndex) {
        let team = this._getSelectedTeam(teamIndex);
        if (team) {
            this.refs.email.value = this.refs.email.value.split("@")[0];
        }
        this.setState({
            selectedTeam: team,
            showSupportEmail: teamIndex === "other",
        });
    },

    _getSelectedTeam: function(teamIndex) {
        if (this.props.teamsConfig &&
            this.props.teamsConfig.teams[teamIndex]) {
            return this.props.teamsConfig.teams[teamIndex];
        }
        return null;
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
                let email = this.refs.email.value;
                if (this.props.teamsConfig) {
                    let team = this.state.selectedTeam;
                    if (team) {
                        email = email + "@" + team.emailSuffix;
                    }
                }
                let valid = email === '' || Email.looksValid(email);
                this.markFieldValid(field_id, valid, "RegistrationForm.ERR_EMAIL_INVALID");
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
            UiEffects.field_input_incorrect(this.fieldElementById(field_id));
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

    _classForField: function(field_id, baseClass) {
        let cls = baseClass || '';
        if (this.state.fieldValid[field_id] === false) {
            if (cls) cls += ' ';
            cls += 'error';
        }
        return cls;
    },

    _renderEmailInputSuffix: function() {
        let suffix = null;
        if (!this.state.selectedTeam) {
            return suffix;
        }
        let team = this.state.selectedTeam;
        if (team) {
            suffix = "@" + team.emailSuffix;
        }
        return suffix;
    },

    render: function() {
        var self = this;
        var emailSection, teamSection, teamAdditionSupport, registerButton;
        if (this.props.showEmail) {
            let emailSuffix = this._renderEmailInputSuffix();
            emailSection = (
                <div>
                    <input type="text" ref="email"
                        autoFocus={true} placeholder="Email address (optional)"
                        defaultValue={this.props.defaultEmail}
                        className={this._classForField(FIELD_EMAIL, 'mx_Login_field')}
                        onBlur={function() {self.validateField(FIELD_EMAIL)}}
                        value={self.state.email}/>
                    {emailSuffix ? <input className="mx_Login_field" value={emailSuffix} disabled/> : null }
                </div>
            );
            if (this.props.teamsConfig) {
                teamSection = (
                    <select
                        defaultValue="-1"
                        className="mx_Login_field"
                        onBlur={function() {self.validateField(FIELD_EMAIL)}}
                        onChange={function(ev) {self.onSelectTeam(ev.target.value)}}
                    >
                        <option key="-1" value="-1">No team</option>
                        {this.props.teamsConfig.teams.map((t, index) => {
                            return (
                                <option key={index} value={index}>
                                    {t.name}
                                </option>
                            );
                        })}
                        <option key="-2" value="other">Other</option>
                    </select>
                );
                if (this.props.teamsConfig.supportEmail && this.state.showSupportEmail) {
                    teamAdditionSupport = (
                        <span>
                            If your team is not listed, email&nbsp;
                            <a href={"mailto:" + this.props.teamsConfig.supportEmail}>
                                {this.props.teamsConfig.supportEmail}
                            </a>
                        </span>
                    );
                }
            }
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
                    {teamSection}
                    {teamAdditionSupport}
                    <br />
                    {emailSection}
                    <br />
                    <input type="text" ref="username"
                        placeholder={ placeholderUserName } defaultValue={this.props.defaultUsername}
                        className={this._classForField(FIELD_USERNAME, 'mx_Login_field')}
                        onBlur={function() {self.validateField(FIELD_USERNAME)}} />
                    <br />
                    { this.props.guestUsername ?
                        <div className="mx_Login_fieldLabel">Setting a user name will create a fresh account</div> : null
                    }
                    <input type="password" ref="password"
                        className={this._classForField(FIELD_PASSWORD, 'mx_Login_field')}
                        onBlur={function() {self.validateField(FIELD_PASSWORD)}}
                        placeholder="Password" defaultValue={this.props.defaultPassword} />
                    <br />
                    <input type="password" ref="passwordConfirm"
                        placeholder="Confirm password"
                        className={this._classForField(FIELD_PASSWORD_CONFIRM, 'mx_Login_field')}
                        onBlur={function() {self.validateField(FIELD_PASSWORD_CONFIRM)}}
                        defaultValue={this.props.defaultPassword} />
                    <br />
                    {registerButton}
                </form>
            </div>
        );
    }
});

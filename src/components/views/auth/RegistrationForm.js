/*
Copyright 2015, 2016 OpenMarket Ltd
Copyright 2017 Vector Creations Ltd
Copyright 2018 New Vector Ltd

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
import sdk from '../../../index';
import Email from '../../../email';
import { looksValid as phoneNumberLooksValid } from '../../../phonenumber';
import Modal from '../../../Modal';
import { _t } from '../../../languageHandler';
import SdkConfig from '../../../SdkConfig';
import { SAFE_LOCALPART_REGEX } from '../../../Registration';

const FIELD_EMAIL = 'field_email';
const FIELD_PHONE_NUMBER = 'field_phone_number';
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
        defaultEmail: PropTypes.string,
        defaultPhoneCountry: PropTypes.string,
        defaultPhoneNumber: PropTypes.string,
        defaultUsername: PropTypes.string,
        defaultPassword: PropTypes.string,
        minPasswordLength: PropTypes.number,
        onValidationChange: PropTypes.func,
        onRegisterClick: PropTypes.func.isRequired, // onRegisterClick(Object) => ?Promise
        onEditServerDetailsClick: PropTypes.func,
        flows: PropTypes.arrayOf(PropTypes.object).isRequired,
        // This is optional and only set if we used a server name to determine
        // the HS URL via `.well-known` discovery. The server name is used
        // instead of the HS URL when talking about "your account".
        hsName: PropTypes.string,
        hsUrl: PropTypes.string,
    },

    getDefaultProps: function() {
        return {
            minPasswordLength: 6,
            onValidationChange: console.error,
        };
    },

    getInitialState: function() {
        return {
            // Field error codes by field ID
            fieldErrors: {},
            // The ISO2 country code selected in the phone number entry
            phoneCountry: this.props.defaultPhoneCountry,
        };
    },

    onSubmit: function(ev) {
        ev.preventDefault();

        // validate everything, in reverse order so
        // the error that ends up being displayed
        // is the one from the first invalid field.
        // It's not super ideal that this just calls
        // onValidationChange once for each invalid field.
        this.validateField(FIELD_PHONE_NUMBER, ev.type);
        this.validateField(FIELD_EMAIL, ev.type);
        this.validateField(FIELD_PASSWORD_CONFIRM, ev.type);
        this.validateField(FIELD_PASSWORD, ev.type);
        this.validateField(FIELD_USERNAME, ev.type);

        const self = this;
        if (this.allFieldsValid()) {
            if (this.refs.email.value == '') {
                const QuestionDialog = sdk.getComponent("dialogs.QuestionDialog");
                Modal.createTrackedDialog('If you don\'t specify an email address...', '', QuestionDialog, {
                    title: _t("Warning!"),
                    description:
                        <div>
                            { _t("If you don't specify an email address, you won't be able to reset your password. " +
                                "Are you sure?") }
                        </div>,
                    button: _t("Continue"),
                    onFinished: function(confirmed) {
                        if (confirmed) {
                            self._doSubmit(ev);
                        }
                    },
                });
            } else {
                self._doSubmit(ev);
            }
        }
    },

    _doSubmit: function(ev) {
        const email = this.refs.email.value.trim();
        const promise = this.props.onRegisterClick({
            username: this.refs.username.value.trim(),
            password: this.refs.password.value.trim(),
            email: email,
            phoneCountry: this.state.phoneCountry,
            phoneNumber: this.refs.phoneNumber ? this.refs.phoneNumber.value.trim() : '',
        });

        if (promise) {
            ev.target.disabled = true;
            promise.finally(function() {
                ev.target.disabled = false;
            });
        }
    },

    /**
     * @returns {boolean} true if all fields were valid last time they were validated.
     */
    allFieldsValid: function() {
        const keys = Object.keys(this.state.fieldErrors);
        for (let i = 0; i < keys.length; ++i) {
            if (this.state.fieldErrors[keys[i]]) {
                return false;
            }
        }
        return true;
    },

    validateField: function(fieldID, eventType) {
        const pwd1 = this.refs.password.value.trim();
        const pwd2 = this.refs.passwordConfirm.value.trim();
        const allowEmpty = eventType === "blur";

        switch (fieldID) {
            case FIELD_EMAIL: {
                const email = this.refs.email.value;
                const emailValid = email === '' || Email.looksValid(email);
                if (this._authStepIsRequired('m.login.email.identity') && (!emailValid || email === '')) {
                    this.markFieldValid(fieldID, false, "RegistrationForm.ERR_MISSING_EMAIL");
                } else this.markFieldValid(fieldID, emailValid, "RegistrationForm.ERR_EMAIL_INVALID");
                break;
            }
            case FIELD_PHONE_NUMBER: {
                const phoneNumber = this.refs.phoneNumber ? this.refs.phoneNumber.value : '';
                const phoneNumberValid = phoneNumber === '' || phoneNumberLooksValid(phoneNumber);
                if (this._authStepIsRequired('m.login.msisdn') && (!phoneNumberValid || phoneNumber === '')) {
                    this.markFieldValid(fieldID, false, "RegistrationForm.ERR_MISSING_PHONE_NUMBER");
                } else this.markFieldValid(fieldID, phoneNumberValid, "RegistrationForm.ERR_PHONE_NUMBER_INVALID");
                break;
            }
            case FIELD_USERNAME: {
                const username = this.refs.username.value.trim();
                if (allowEmpty && username === '') {
                    this.markFieldValid(fieldID, true);
                } else if (!SAFE_LOCALPART_REGEX.test(username)) {
                    this.markFieldValid(
                        fieldID,
                        false,
                        "RegistrationForm.ERR_USERNAME_INVALID",
                    );
                } else if (username == '') {
                    this.markFieldValid(
                        fieldID,
                        false,
                        "RegistrationForm.ERR_USERNAME_BLANK",
                    );
                } else {
                    this.markFieldValid(fieldID, true);
                }
                break;
            }
            case FIELD_PASSWORD:
                if (allowEmpty && pwd1 === "") {
                    this.markFieldValid(fieldID, true);
                } else if (pwd1 == '') {
                    this.markFieldValid(
                        fieldID,
                        false,
                        "RegistrationForm.ERR_PASSWORD_MISSING",
                    );
                } else if (pwd1.length < this.props.minPasswordLength) {
                    this.markFieldValid(
                        fieldID,
                        false,
                        "RegistrationForm.ERR_PASSWORD_LENGTH",
                    );
                } else {
                    this.markFieldValid(fieldID, true);
                }
                break;
            case FIELD_PASSWORD_CONFIRM:
                if (allowEmpty && pwd2 === "") {
                    this.markFieldValid(fieldID, true);
                } else {
                    this.markFieldValid(
                        fieldID, pwd1 == pwd2,
                        "RegistrationForm.ERR_PASSWORD_MISMATCH",
                    );
                }
                break;
        }
    },

    markFieldValid: function(fieldID, valid, errorCode) {
        const { fieldErrors } = this.state;
        if (valid) {
            fieldErrors[fieldID] = null;
        } else {
            fieldErrors[fieldID] = errorCode;
        }
        this.setState({
            fieldErrors,
        });
        this.props.onValidationChange(fieldErrors);
    },

    fieldElementById(fieldID) {
        switch (fieldID) {
            case FIELD_EMAIL:
                return this.refs.email;
            case FIELD_PHONE_NUMBER:
                return this.refs.phoneNumber;
            case FIELD_USERNAME:
                return this.refs.username;
            case FIELD_PASSWORD:
                return this.refs.password;
            case FIELD_PASSWORD_CONFIRM:
                return this.refs.passwordConfirm;
        }
    },

    _classForField: function(fieldID, ...baseClasses) {
        let cls = baseClasses.join(' ');
        if (this.state.fieldErrors[fieldID]) {
            if (cls) cls += ' ';
            cls += 'error';
        }
        return cls;
    },

    onEmailBlur(ev) {
        this.validateField(FIELD_EMAIL, ev.type);
    },

    onPasswordBlur(ev) {
        this.validateField(FIELD_PASSWORD, ev.type);
    },

    onPasswordConfirmBlur(ev) {
        this.validateField(FIELD_PASSWORD_CONFIRM, ev.type);
    },

    onPhoneCountryChange(newVal) {
        this.setState({
            phoneCountry: newVal.iso2,
            phonePrefix: newVal.prefix,
        });
    },

    onPhoneNumberBlur(ev) {
        this.validateField(FIELD_PHONE_NUMBER, ev.type);
    },

    onUsernameBlur(ev) {
        this.validateField(FIELD_USERNAME, ev.type);
    },

    /**
     * A step is required if all flows include that step.
     *
     * @param {string} step A stage name to check
     * @returns {boolean} Whether it is required
     */
    _authStepIsRequired(step) {
        return this.props.flows.every((flow) => {
            return flow.stages.includes(step);
        });
    },

    /**
     * A step is used if any flows include that step.
     *
     * @param {string} step A stage name to check
     * @returns {boolean} Whether it is used
     */
    _authStepIsUsed(step) {
        return this.props.flows.some((flow) => {
            return flow.stages.includes(step);
        });
    },

    render: function() {
        let yourMatrixAccountText = _t('Create your Matrix account');
        if (this.props.hsName) {
            yourMatrixAccountText = _t('Create your Matrix account on %(serverName)s', {
                serverName: this.props.hsName,
            });
        } else {
            try {
                const parsedHsUrl = new URL(this.props.hsUrl);
                yourMatrixAccountText = _t('Create your Matrix account on %(serverName)s', {
                    serverName: parsedHsUrl.hostname,
                });
            } catch (e) {
                // ignore
            }
        }

        let editLink = null;
        if (this.props.onEditServerDetailsClick) {
            editLink = <a className="mx_AuthBody_editServerDetails"
                href="#" onClick={this.props.onEditServerDetailsClick}
            >
                {_t('Change')}
            </a>;
        }

        let emailSection;
        if (this._authStepIsUsed('m.login.email.identity')) {
            const emailPlaceholder = this._authStepIsRequired('m.login.email.identity') ?
                _t("Email") :
                _t("Email (optional)");

            emailSection = (
                <div>
                    <input type="text" ref="email"
                        placeholder={emailPlaceholder}
                        defaultValue={this.props.defaultEmail}
                        className={this._classForField(FIELD_EMAIL, 'mx_Login_field')}
                        onBlur={this.onEmailBlur}
                        value={this.state.email} />
                </div>
            );
        }

        const threePidLogin = !SdkConfig.get().disable_3pid_login;
        const CountryDropdown = sdk.getComponent('views.auth.CountryDropdown');
        let phoneSection;
        if (threePidLogin && this._authStepIsUsed('m.login.msisdn')) {
            const phonePlaceholder = this._authStepIsRequired('m.login.msisdn') ?
                _t("Phone") :
                _t("Phone (optional)");
            phoneSection = (
                <div className="mx_Login_phoneSection">
                    <CountryDropdown ref="phone_country"
                        className="mx_Login_phoneCountry mx_Login_field_prefix"
                        value={this.state.phoneCountry}
                        isSmall={true}
                        showPrefix={true}
                        onOptionChange={this.onPhoneCountryChange}
                    />
                    <input type="text" ref="phoneNumber"
                        placeholder={phonePlaceholder}
                        defaultValue={this.props.defaultPhoneNumber}
                        className={this._classForField(
                            FIELD_PHONE_NUMBER,
                            'mx_Login_phoneNumberField',
                            'mx_Login_field',
                            'mx_Login_field_has_prefix',
                        )}
                        onBlur={this.onPhoneNumberBlur}
                        value={this.state.phoneNumber}
                    />
                </div>
            );
        }

        const registerButton = (
            <input className="mx_Login_submit" type="submit" value={_t("Register")} />
        );

        const placeholderUsername = _t("Username");

        return (
            <div>
                <h3>
                    {yourMatrixAccountText}
                    {editLink}
                </h3>
                <form onSubmit={this.onSubmit}>
                    <div className="mx_AuthBody_fieldRow">
                        <input type="text" ref="username"
                            autoFocus={true}
                            placeholder={placeholderUsername} defaultValue={this.props.defaultUsername}
                            className={this._classForField(FIELD_USERNAME, 'mx_Login_field')}
                            onBlur={this.onUsernameBlur} />
                    </div>
                    <div className="mx_AuthBody_fieldRow">
                        <input type="password" ref="password"
                            className={this._classForField(FIELD_PASSWORD, 'mx_Login_field')}
                            onBlur={this.onPasswordBlur}
                            placeholder={_t("Password")} defaultValue={this.props.defaultPassword} />
                        <input type="password" ref="passwordConfirm"
                            placeholder={_t("Confirm")}
                            className={this._classForField(FIELD_PASSWORD_CONFIRM, 'mx_Login_field')}
                            onBlur={this.onPasswordConfirmBlur}
                            defaultValue={this.props.defaultPassword} />
                    </div>
                    <div className="mx_AuthBody_fieldRow">
                        { emailSection }
                        { phoneSection }
                    </div>
                    {_t(
                        "Use an email address to recover your account. Other users " +
                        "can invite you to rooms using your contact details.",
                    )}
                    { registerButton }
                </form>
            </div>
        );
    },
});

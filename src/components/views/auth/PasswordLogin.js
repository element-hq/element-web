/*
Copyright 2015, 2016 OpenMarket Ltd
Copyright 2017 Vector Creations Ltd
Copyright 2019 New Vector Ltd.

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
import * as sdk from '../../../index';
import { _t } from '../../../languageHandler';
import SdkConfig from '../../../SdkConfig';
import {ValidatedServerConfig} from "../../../utils/AutoDiscoveryUtils";
import AccessibleButton from "../elements/AccessibleButton";
import CountlyAnalytics from "../../../CountlyAnalytics";
import withValidation from "../elements/Validation";
import * as Email from "../../../email";

// For validating phone numbers without country codes
const PHONE_NUMBER_REGEX = /^[0-9()\-\s]*$/;

/**
 * A pure UI component which displays a username/password form.
 */
export default class PasswordLogin extends React.Component {
    static propTypes = {
        onSubmit: PropTypes.func.isRequired, // fn(username, password)
        onEditServerDetailsClick: PropTypes.func,
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
        disableSubmit: PropTypes.bool,
        serverConfig: PropTypes.instanceOf(ValidatedServerConfig).isRequired,
        busy: PropTypes.bool,
    };

    static defaultProps = {
        onEditServerDetailsClick: null,
        onUsernameChanged: function() {},
        onUsernameBlur: function() {},
        onPasswordChanged: function() {},
        onPhoneCountryChanged: function() {},
        onPhoneNumberChanged: function() {},
        initialUsername: "",
        initialPhoneCountry: "",
        initialPhoneNumber: "",
        initialPassword: "",
        loginIncorrect: false,
        disableSubmit: false,
    };

    static LOGIN_FIELD_EMAIL = "login_field_email";
    static LOGIN_FIELD_MXID = "login_field_mxid";
    static LOGIN_FIELD_PHONE = "login_field_phone";
    static LOGIN_FIELD_PASSWORD = "login_field_password";

    constructor(props) {
        super(props);
        this.state = {
            // Field error codes by field ID
            fieldValid: {},
            username: this.props.initialUsername,
            password: this.props.initialPassword,
            phoneCountry: this.props.initialPhoneCountry,
            phoneNumber: this.props.initialPhoneNumber,
            loginType: PasswordLogin.LOGIN_FIELD_MXID,
        };

        this.onForgotPasswordClick = this.onForgotPasswordClick.bind(this);
        this.onSubmitForm = this.onSubmitForm.bind(this);
        this.onUsernameFocus = this.onUsernameFocus.bind(this);
        this.onUsernameChanged = this.onUsernameChanged.bind(this);
        this.onUsernameBlur = this.onUsernameBlur.bind(this);
        this.onLoginTypeChange = this.onLoginTypeChange.bind(this);
        this.onPhoneCountryChanged = this.onPhoneCountryChanged.bind(this);
        this.onPhoneNumberChanged = this.onPhoneNumberChanged.bind(this);
        this.onPhoneNumberBlur = this.onPhoneNumberBlur.bind(this);
        this.onPasswordChanged = this.onPasswordChanged.bind(this);
        this.isLoginEmpty = this.isLoginEmpty.bind(this);
    }

    onForgotPasswordClick(ev) {
        ev.preventDefault();
        ev.stopPropagation();
        this.props.onForgotPasswordClick();
    }

    async onSubmitForm(ev) {
        ev.preventDefault();

        const allFieldsValid = await this.verifyFieldsBeforeSubmit();
        if (!allFieldsValid) {
            CountlyAnalytics.instance.track("onboarding_registration_submit_failed");
            return;
        }

        let username = ''; // XXX: Synapse breaks if you send null here:
        let phoneCountry = null;
        let phoneNumber = null;

        switch (this.state.loginType) {
            case PasswordLogin.LOGIN_FIELD_EMAIL:
            case PasswordLogin.LOGIN_FIELD_MXID:
                username = this.state.username;
                break;
            case PasswordLogin.LOGIN_FIELD_PHONE:
                phoneCountry = this.state.phoneCountry;
                phoneNumber = this.state.phoneNumber;
                break;
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

    onUsernameFocus() {
        if (this.state.loginType === PasswordLogin.LOGIN_FIELD_MXID) {
            CountlyAnalytics.instance.track("onboarding_login_mxid_focus");
        } else {
            CountlyAnalytics.instance.track("onboarding_login_email_focus");
        }
    }

    onUsernameBlur(ev) {
        if (this.state.loginType === PasswordLogin.LOGIN_FIELD_MXID) {
            CountlyAnalytics.instance.track("onboarding_login_mxid_blur");
        } else {
            CountlyAnalytics.instance.track("onboarding_login_email_blur");
        }
        this.props.onUsernameBlur(ev.target.value);
    }

    onLoginTypeChange(ev) {
        const loginType = ev.target.value;
        this.setState({
            loginType: loginType,
            username: "", // Reset because email and username use the same state
        });
        CountlyAnalytics.instance.track("onboarding_login_type_changed", { loginType });
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

    onPhoneNumberFocus() {
        CountlyAnalytics.instance.track("onboarding_login_phone_number_focus");
    }

    onPhoneNumberBlur(ev) {
        CountlyAnalytics.instance.track("onboarding_login_phone_number_blur");
    }

    onPasswordChanged(ev) {
        this.setState({password: ev.target.value});
        this.props.onPasswordChanged(ev.target.value);
    }

    async verifyFieldsBeforeSubmit() {
        // Blur the active element if any, so we first run its blur validation,
        // which is less strict than the pass we're about to do below for all fields.
        const activeElement = document.activeElement;
        if (activeElement) {
            activeElement.blur();
        }

        const fieldIDsInDisplayOrder = [
            this.state.loginType,
            PasswordLogin.LOGIN_FIELD_PASSWORD,
        ];

        // Run all fields with stricter validation that no longer allows empty
        // values for required fields.
        for (const fieldID of fieldIDsInDisplayOrder) {
            const field = this[fieldID];
            if (!field) {
                continue;
            }
            // We must wait for these validations to finish before queueing
            // up the setState below so our setState goes in the queue after
            // all the setStates from these validate calls (that's how we
            // know they've finished).
            await field.validate({ allowEmpty: false });
        }

        // Validation and state updates are async, so we need to wait for them to complete
        // first. Queue a `setState` callback and wait for it to resolve.
        await new Promise(resolve => this.setState({}, resolve));

        if (this.allFieldsValid()) {
            return true;
        }

        const invalidField = this.findFirstInvalidField(fieldIDsInDisplayOrder);

        if (!invalidField) {
            return true;
        }

        // Focus the first invalid field and show feedback in the stricter mode
        // that no longer allows empty values for required fields.
        invalidField.focus();
        invalidField.validate({ allowEmpty: false, focused: true });
        return false;
    }

    allFieldsValid() {
        const keys = Object.keys(this.state.fieldValid);
        for (let i = 0; i < keys.length; ++i) {
            if (!this.state.fieldValid[keys[i]]) {
                return false;
            }
        }
        return true;
    }

    findFirstInvalidField(fieldIDs) {
        for (const fieldID of fieldIDs) {
            if (!this.state.fieldValid[fieldID] && this[fieldID]) {
                return this[fieldID];
            }
        }
        return null;
    }

    markFieldValid(fieldID, valid) {
        const { fieldValid } = this.state;
        fieldValid[fieldID] = valid;
        this.setState({
            fieldValid,
        });
    }

    validateUsernameRules = withValidation({
        rules: [
            {
                key: "required",
                test({ value, allowEmpty }) {
                    return allowEmpty || !!value;
                },
                invalid: () => _t("Enter username"),
            },
        ],
    });

    onUsernameValidate = async (fieldState) => {
        const result = await this.validateUsernameRules(fieldState);
        this.markFieldValid(PasswordLogin.LOGIN_FIELD_MXID, result.valid);
        return result;
    };

    validateEmailRules = withValidation({
        rules: [
            {
                key: "required",
                test({ value, allowEmpty }) {
                    return allowEmpty || !!value;
                },
                invalid: () => _t("Enter email address"),
            }, {
                key: "email",
                test: ({ value }) => !value || Email.looksValid(value),
                invalid: () => _t("Doesn't look like a valid email address"),
            },
        ],
    });

    onEmailValidate = async (fieldState) => {
        const result = await this.validateEmailRules(fieldState);
        this.markFieldValid(PasswordLogin.LOGIN_FIELD_EMAIL, result.valid);
        return result;
    };

    validatePhoneNumberRules = withValidation({
        rules: [
            {
                key: "required",
                test({ value, allowEmpty }) {
                    return allowEmpty || !!value;
                },
                invalid: () => _t("Enter phone number"),
            }, {
                key: "number",
                test: ({ value }) => !value || PHONE_NUMBER_REGEX.test(value),
                invalid: () => _t("Doesn't look like a valid phone number"),
            },
        ],
    });

    onPhoneNumberValidate = async (fieldState) => {
        const result = await this.validatePhoneNumberRules(fieldState);
        this.markFieldValid(PasswordLogin.LOGIN_FIELD_PHONE, result.valid);
        return result;
    };

    validatePasswordRules = withValidation({
        rules: [
            {
                key: "required",
                test({ value, allowEmpty }) {
                    return allowEmpty || !!value;
                },
                invalid: () => _t("Enter password"),
            },
        ],
    });

    onPasswordValidate = async (fieldState) => {
        const result = await this.validatePasswordRules(fieldState);
        this.markFieldValid(PasswordLogin.LOGIN_FIELD_PASSWORD, result.valid);
        return result;
    }

    renderLoginField(loginType, autoFocus) {
        const Field = sdk.getComponent('elements.Field');

        const classes = {};

        switch (loginType) {
            case PasswordLogin.LOGIN_FIELD_EMAIL:
                classes.error = this.props.loginIncorrect && !this.state.username;
                return <Field
                    className={classNames(classes)}
                    name="username" // make it a little easier for browser's remember-password
                    key="email_input"
                    type="text"
                    label={_t("Email")}
                    placeholder="joe@example.com"
                    value={this.state.username}
                    onChange={this.onUsernameChanged}
                    onFocus={this.onUsernameFocus}
                    onBlur={this.onUsernameBlur}
                    disabled={this.props.disableSubmit}
                    autoFocus={autoFocus}
                    onValidate={this.onEmailValidate}
                    ref={field => this[PasswordLogin.LOGIN_FIELD_EMAIL] = field}
                />;
            case PasswordLogin.LOGIN_FIELD_MXID:
                classes.error = this.props.loginIncorrect && !this.state.username;
                return <Field
                    className={classNames(classes)}
                    name="username" // make it a little easier for browser's remember-password
                    key="username_input"
                    type="text"
                    label={_t("Username")}
                    value={this.state.username}
                    onChange={this.onUsernameChanged}
                    onFocus={this.onUsernameFocus}
                    onBlur={this.onUsernameBlur}
                    disabled={this.props.disableSubmit}
                    autoFocus={autoFocus}
                    onValidate={this.onUsernameValidate}
                    ref={field => this[PasswordLogin.LOGIN_FIELD_MXID] = field}
                />;
            case PasswordLogin.LOGIN_FIELD_PHONE: {
                const CountryDropdown = sdk.getComponent('views.auth.CountryDropdown');
                classes.error = this.props.loginIncorrect && !this.state.phoneNumber;

                const phoneCountry = <CountryDropdown
                    value={this.state.phoneCountry}
                    isSmall={true}
                    showPrefix={true}
                    onOptionChange={this.onPhoneCountryChanged}
                />;

                return <Field
                    className={classNames(classes)}
                    name="phoneNumber"
                    key="phone_input"
                    type="text"
                    label={_t("Phone")}
                    value={this.state.phoneNumber}
                    prefixComponent={phoneCountry}
                    onChange={this.onPhoneNumberChanged}
                    onFocus={this.onPhoneNumberFocus}
                    onBlur={this.onPhoneNumberBlur}
                    disabled={this.props.disableSubmit}
                    autoFocus={autoFocus}
                    onValidate={this.onPhoneNumberValidate}
                    ref={field => this[PasswordLogin.LOGIN_FIELD_PHONE] = field}
                />;
            }
        }
    }

    isLoginEmpty() {
        switch (this.state.loginType) {
            case PasswordLogin.LOGIN_FIELD_EMAIL:
            case PasswordLogin.LOGIN_FIELD_MXID:
                return !this.state.username;
            case PasswordLogin.LOGIN_FIELD_PHONE:
                return !this.state.phoneCountry || !this.state.phoneNumber;
        }
    }

    render() {
        const Field = sdk.getComponent('elements.Field');
        const SignInToText = sdk.getComponent('views.auth.SignInToText');

        let forgotPasswordJsx;

        if (this.props.onForgotPasswordClick) {
            forgotPasswordJsx = <span>
                {_t('Not sure of your password? <a>Set a new one</a>', {}, {
                    a: sub => (
                        <AccessibleButton
                            className="mx_Login_forgot"
                            disabled={this.props.busy}
                            kind="link"
                            onClick={this.onForgotPasswordClick}
                        >
                            {sub}
                        </AccessibleButton>
                    ),
                })}
            </span>;
        }

        const pwFieldClass = classNames({
            error: this.props.loginIncorrect && !this.isLoginEmpty(), // only error password if error isn't top field
        });

        // If login is empty, autoFocus login, otherwise autoFocus password.
        // this is for when auto server discovery remounts us when the user tries to tab from username to password
        const autoFocusPassword = !this.isLoginEmpty();
        const loginField = this.renderLoginField(this.state.loginType, !autoFocusPassword);

        let loginType;
        if (!SdkConfig.get().disable_3pid_login) {
            loginType = (
                <div className="mx_Login_type_container">
                    <label className="mx_Login_type_label">{ _t('Sign in with') }</label>
                    <Field
                        element="select"
                        value={this.state.loginType}
                        onChange={this.onLoginTypeChange}
                        disabled={this.props.disableSubmit}
                    >
                        <option
                            key={PasswordLogin.LOGIN_FIELD_MXID}
                            value={PasswordLogin.LOGIN_FIELD_MXID}
                        >
                            {_t('Username')}
                        </option>
                        <option
                            key={PasswordLogin.LOGIN_FIELD_EMAIL}
                            value={PasswordLogin.LOGIN_FIELD_EMAIL}
                        >
                            {_t('Email address')}
                        </option>
                        <option
                            key={PasswordLogin.LOGIN_FIELD_PHONE}
                            value={PasswordLogin.LOGIN_FIELD_PHONE}
                        >
                            {_t('Phone')}
                        </option>
                    </Field>
                </div>
            );
        }

        return (
            <div>
                <SignInToText serverConfig={this.props.serverConfig}
                    onEditServerDetailsClick={this.props.onEditServerDetailsClick} />
                <form onSubmit={this.onSubmitForm}>
                    {loginType}
                    {loginField}
                    <Field
                        className={pwFieldClass}
                        type="password"
                        name="password"
                        label={_t('Password')}
                        value={this.state.password}
                        onChange={this.onPasswordChanged}
                        disabled={this.props.disableSubmit}
                        autoFocus={autoFocusPassword}
                        onValidate={this.onPasswordValidate}
                        ref={field => this[PasswordLogin.LOGIN_FIELD_PASSWORD] = field}
                    />
                    {forgotPasswordJsx}
                    { !this.props.busy && <input className="mx_Login_submit"
                        type="submit"
                        value={_t('Sign in')}
                        disabled={this.props.disableSubmit}
                    /> }
                </form>
            </div>
        );
    }
}

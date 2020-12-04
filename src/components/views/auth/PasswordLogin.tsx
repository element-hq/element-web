/*
Copyright 2015, 2016, 2017, 2019 The Matrix.org Foundation C.I.C.

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
import classNames from 'classnames';

import { _t } from '../../../languageHandler';
import SdkConfig from '../../../SdkConfig';
import {ValidatedServerConfig} from "../../../utils/AutoDiscoveryUtils";
import AccessibleButton from "../elements/AccessibleButton";
import CountlyAnalytics from "../../../CountlyAnalytics";
import withValidation from "../elements/Validation";
import * as Email from "../../../email";
import Field from "../elements/Field";
import CountryDropdown from "./CountryDropdown";

// For validating phone numbers without country codes
const PHONE_NUMBER_REGEX = /^[0-9()\-\s]*$/;

interface IProps {
    username: string; // also used for email address
    phoneCountry: string;
    phoneNumber: string;

    serverConfig: ValidatedServerConfig;
    loginIncorrect?: boolean;
    disableSubmit?: boolean;
    busy?: boolean;

    onSubmit(username: string, phoneCountry: void, phoneNumber: void, password: string): void;
    onSubmit(username: void, phoneCountry: string, phoneNumber: string, password: string): void;
    onUsernameChanged?(username: string): void;
    onUsernameBlur?(username: string): void;
    onPhoneCountryChanged?(phoneCountry: string): void;
    onPhoneNumberChanged?(phoneNumber: string): void;
    onForgotPasswordClick?(): void;
}

interface IState {
    fieldValid: Partial<Record<LoginField, boolean>>;
    loginType: LoginField.Email | LoginField.MatrixId | LoginField.Phone,
    password: "",
}

enum LoginField {
    Email = "login_field_email",
    MatrixId = "login_field_mxid",
    Phone = "login_field_phone",
    Password = "login_field_phone",
}

/*
 * A pure UI component which displays a username/password form.
 * The email/username/phone fields are fully-controlled, the password field is not.
 */
export default class PasswordLogin extends React.PureComponent<IProps, IState> {
    static defaultProps = {
        onUsernameChanged: function() {},
        onUsernameBlur: function() {},
        onPhoneCountryChanged: function() {},
        onPhoneNumberChanged: function() {},
        loginIncorrect: false,
        disableSubmit: false,
    };

    constructor(props) {
        super(props);
        this.state = {
            // Field error codes by field ID
            fieldValid: {},
            loginType: LoginField.MatrixId,
            password: "",
        };
    }

    private onForgotPasswordClick = ev => {
        ev.preventDefault();
        ev.stopPropagation();
        this.props.onForgotPasswordClick();
    };

    private onSubmitForm = async ev => {
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
            case LoginField.Email:
            case LoginField.MatrixId:
                username = this.props.username;
                break;
            case LoginField.Phone:
                phoneCountry = this.props.phoneCountry;
                phoneNumber = this.props.phoneNumber;
                break;
        }

        this.props.onSubmit(username, phoneCountry, phoneNumber, this.state.password);
    };

    private onUsernameChanged = ev => {
        this.props.onUsernameChanged(ev.target.value);
    };

    private onUsernameFocus = () => {
        if (this.state.loginType === LoginField.MatrixId) {
            CountlyAnalytics.instance.track("onboarding_login_mxid_focus");
        } else {
            CountlyAnalytics.instance.track("onboarding_login_email_focus");
        }
    };

    private onUsernameBlur = ev => {
        if (this.state.loginType === LoginField.MatrixId) {
            CountlyAnalytics.instance.track("onboarding_login_mxid_blur");
        } else {
            CountlyAnalytics.instance.track("onboarding_login_email_blur");
        }
        this.props.onUsernameBlur(ev.target.value);
    };

    private onLoginTypeChange = ev => {
        const loginType = ev.target.value;
        this.setState({ loginType });
        this.props.onUsernameChanged(""); // Reset because email and username use the same state
        CountlyAnalytics.instance.track("onboarding_login_type_changed", { loginType });
    };

    private onPhoneCountryChanged = country => {
        this.props.onPhoneCountryChanged(country.iso2);
    };

    private onPhoneNumberChanged = ev => {
        this.props.onPhoneNumberChanged(ev.target.value);
    };

    private onPhoneNumberFocus = () => {
        CountlyAnalytics.instance.track("onboarding_login_phone_number_focus");
    };

    private onPhoneNumberBlur = ev => {
        CountlyAnalytics.instance.track("onboarding_login_phone_number_blur");
    };

    private onPasswordChanged = ev => {
        this.setState({password: ev.target.value});
    };

    private async verifyFieldsBeforeSubmit() {
        // Blur the active element if any, so we first run its blur validation,
        // which is less strict than the pass we're about to do below for all fields.
        const activeElement = document.activeElement as HTMLElement;
        if (activeElement) {
            activeElement.blur();
        }

        const fieldIDsInDisplayOrder = [
            this.state.loginType,
            LoginField.Password,
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

    private allFieldsValid() {
        const keys = Object.keys(this.state.fieldValid);
        for (let i = 0; i < keys.length; ++i) {
            if (!this.state.fieldValid[keys[i]]) {
                return false;
            }
        }
        return true;
    }

    private findFirstInvalidField(fieldIDs: LoginField[]) {
        for (const fieldID of fieldIDs) {
            if (!this.state.fieldValid[fieldID] && this[fieldID]) {
                return this[fieldID];
            }
        }
        return null;
    }

    private markFieldValid(fieldID: LoginField, valid: boolean) {
        const { fieldValid } = this.state;
        fieldValid[fieldID] = valid;
        this.setState({
            fieldValid,
        });
    }

    private validateUsernameRules = withValidation({
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

    private onUsernameValidate = async (fieldState) => {
        const result = await this.validateUsernameRules(fieldState);
        this.markFieldValid(LoginField.MatrixId, result.valid);
        return result;
    };

    private validateEmailRules = withValidation({
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

    private onEmailValidate = async (fieldState) => {
        const result = await this.validateEmailRules(fieldState);
        this.markFieldValid(LoginField.Email, result.valid);
        return result;
    };

    private validatePhoneNumberRules = withValidation({
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
                invalid: () => _t("That phone number doesn't look quite right, please check and try again"),
            },
        ],
    });

    private onPhoneNumberValidate = async (fieldState) => {
        const result = await this.validatePhoneNumberRules(fieldState);
        this.markFieldValid(LoginField.Password, result.valid);
        return result;
    };

    private validatePasswordRules = withValidation({
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

    private onPasswordValidate = async (fieldState) => {
        const result = await this.validatePasswordRules(fieldState);
        this.markFieldValid(LoginField.Password, result.valid);
        return result;
    }

    private renderLoginField(loginType: IState["loginType"], autoFocus: boolean) {
        const classes = {
            error: false,
        };

        switch (loginType) {
            case LoginField.Email:
                classes.error = this.props.loginIncorrect && !this.props.username;
                return <Field
                    className={classNames(classes)}
                    name="username" // make it a little easier for browser's remember-password
                    key="email_input"
                    type="text"
                    label={_t("Email")}
                    placeholder="joe@example.com"
                    value={this.props.username}
                    onChange={this.onUsernameChanged}
                    onFocus={this.onUsernameFocus}
                    onBlur={this.onUsernameBlur}
                    disabled={this.props.disableSubmit}
                    autoFocus={autoFocus}
                    onValidate={this.onEmailValidate}
                    ref={field => this[LoginField.Email] = field}
                />;
            case LoginField.MatrixId:
                classes.error = this.props.loginIncorrect && !this.props.username;
                return <Field
                    className={classNames(classes)}
                    name="username" // make it a little easier for browser's remember-password
                    key="username_input"
                    type="text"
                    label={_t("Username")}
                    placeholder={_t("Username").toLocaleLowerCase()}
                    value={this.props.username}
                    onChange={this.onUsernameChanged}
                    onFocus={this.onUsernameFocus}
                    onBlur={this.onUsernameBlur}
                    disabled={this.props.disableSubmit}
                    autoFocus={autoFocus}
                    onValidate={this.onUsernameValidate}
                    ref={field => this[LoginField.MatrixId] = field}
                />;
            case LoginField.Phone: {
                classes.error = this.props.loginIncorrect && !this.props.phoneNumber;

                const phoneCountry = <CountryDropdown
                    value={this.props.phoneCountry}
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
                    value={this.props.phoneNumber}
                    prefixComponent={phoneCountry}
                    onChange={this.onPhoneNumberChanged}
                    onFocus={this.onPhoneNumberFocus}
                    onBlur={this.onPhoneNumberBlur}
                    disabled={this.props.disableSubmit}
                    autoFocus={autoFocus}
                    onValidate={this.onPhoneNumberValidate}
                    ref={field => this[LoginField.Password] = field}
                />;
            }
        }
    }

    private isLoginEmpty() {
        switch (this.state.loginType) {
            case LoginField.Email:
            case LoginField.MatrixId:
                return !this.props.username;
            case LoginField.Phone:
                return !this.props.phoneCountry || !this.props.phoneNumber;
        }
    }

    render() {
        let forgotPasswordJsx;

        if (this.props.onForgotPasswordClick) {
            forgotPasswordJsx = <AccessibleButton
                className="mx_Login_forgot"
                disabled={this.props.busy}
                kind="link"
                onClick={this.onForgotPasswordClick}
            >
                {_t("Forgot password?")}
            </AccessibleButton>;
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
                        <option key={LoginField.MatrixId} value={LoginField.MatrixId}>
                            {_t('Username')}
                        </option>
                        <option
                            key={LoginField.Email}
                            value={LoginField.Email}
                        >
                            {_t('Email address')}
                        </option>
                        <option key={LoginField.Password} value={LoginField.Password}>
                            {_t('Phone')}
                        </option>
                    </Field>
                </div>
            );
        }

        return (
            <div>
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
                        ref={field => this[LoginField.Password] = field}
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

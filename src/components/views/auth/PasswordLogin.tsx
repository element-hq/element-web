/*
Copyright 2024 New Vector Ltd.
Copyright 2015, 2016 , 2017, 2019 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX, type SyntheticEvent } from "react";
import classNames from "classnames";

import { _t } from "../../../languageHandler";
import SdkConfig from "../../../SdkConfig";
import { type ValidatedServerConfig } from "../../../utils/ValidatedServerConfig";
import AccessibleButton, { type ButtonEvent } from "../elements/AccessibleButton";
import withValidation, { type IFieldState, type IValidationResult } from "../elements/Validation";
import Field from "../elements/Field";
import CountryDropdown from "./CountryDropdown";
import EmailField from "./EmailField";
import { type PhoneNumberCountryDefinition } from "../../../phonenumber";

// For validating phone numbers without country codes
const PHONE_NUMBER_REGEX = /^[0-9()\-\s]*$/;

interface IProps {
    username: string; // also used for email address
    phoneCountry: string;
    phoneNumber: string;

    serverConfig: ValidatedServerConfig;
    loginIncorrect: boolean;
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
    loginType: LoginField.Email | LoginField.MatrixId | LoginField.Phone;
    password: string;
}

const enum LoginField {
    Email = "login_field_email",
    MatrixId = "login_field_mxid",
    Phone = "login_field_phone",
    Password = "login_field_password",
}

/*
 * A pure UI component which displays a username/password form.
 * The email/username/phone fields are fully-controlled, the password field is not.
 */
export default class PasswordLogin extends React.PureComponent<IProps, IState> {
    private [LoginField.Email]: Field | null = null;
    private [LoginField.Phone]: Field | null = null;
    private [LoginField.MatrixId]: Field | null = null;
    private [LoginField.Password]: Field | null = null;

    public static defaultProps = {
        onUsernameChanged: function () {},
        onUsernameBlur: function () {},
        onPhoneCountryChanged: function () {},
        onPhoneNumberChanged: function () {},
        loginIncorrect: false,
        disableSubmit: false,
    };

    public constructor(props: IProps) {
        super(props);
        this.state = {
            // Field error codes by field ID
            fieldValid: {},
            loginType: LoginField.MatrixId,
            password: "",
        };
    }

    private onForgotPasswordClick = (ev: ButtonEvent): void => {
        ev.preventDefault();
        ev.stopPropagation();
        this.props.onForgotPasswordClick?.();
    };

    private onSubmitForm = async (ev: SyntheticEvent): Promise<void> => {
        ev.preventDefault();

        const allFieldsValid = await this.verifyFieldsBeforeSubmit();
        if (!allFieldsValid) {
            return;
        }

        switch (this.state.loginType) {
            case LoginField.Email:
            case LoginField.MatrixId:
                this.props.onSubmit(this.props.username, undefined, undefined, this.state.password);
                break;
            case LoginField.Phone:
                this.props.onSubmit(undefined, this.props.phoneCountry, this.props.phoneNumber, this.state.password);
                break;
        }
    };

    private onUsernameChanged = (ev: React.ChangeEvent<HTMLInputElement>): void => {
        this.props.onUsernameChanged?.(ev.target.value);
    };

    private onUsernameBlur = (ev: React.FocusEvent<HTMLInputElement>): void => {
        this.props.onUsernameBlur?.(ev.target.value);
    };

    private onLoginTypeChange = (ev: React.ChangeEvent<HTMLSelectElement>): void => {
        const loginType = ev.target.value as IState["loginType"];
        this.setState({ loginType });
        this.props.onUsernameChanged?.(""); // Reset because email and username use the same state
    };

    private onPhoneCountryChanged = (country: PhoneNumberCountryDefinition): void => {
        this.props.onPhoneCountryChanged?.(country.iso2);
    };

    private onPhoneNumberChanged = (ev: React.ChangeEvent<HTMLInputElement>): void => {
        this.props.onPhoneNumberChanged?.(ev.target.value);
    };

    private onPasswordChanged = (ev: React.ChangeEvent<HTMLInputElement>): void => {
        this.setState({ password: ev.target.value });
    };

    private async verifyFieldsBeforeSubmit(): Promise<boolean> {
        // Blur the active element if any, so we first run its blur validation,
        // which is less strict than the pass we're about to do below for all fields.
        const activeElement = document.activeElement as HTMLElement;
        if (activeElement) {
            activeElement.blur();
        }

        const fieldIDsInDisplayOrder = [this.state.loginType, LoginField.Password];

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
        await new Promise<void>((resolve) => this.setState({}, resolve));

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

    private allFieldsValid(): boolean {
        return Object.values(this.state.fieldValid).every(Boolean);
    }

    private findFirstInvalidField(fieldIDs: LoginField[]): Field | null {
        for (const fieldID of fieldIDs) {
            if (!this.state.fieldValid[fieldID] && this[fieldID]) {
                return this[fieldID];
            }
        }
        return null;
    }

    private markFieldValid(fieldID: LoginField, valid?: boolean): void {
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
                invalid: () => _t("auth|username_field_required_invalid"),
            },
        ],
    });

    private onUsernameValidate = async (fieldState: IFieldState): Promise<IValidationResult> => {
        const result = await this.validateUsernameRules(fieldState);
        this.markFieldValid(LoginField.MatrixId, result.valid);
        return result;
    };

    private onEmailValidate = (result: IValidationResult): void => {
        this.markFieldValid(LoginField.Email, result.valid);
    };

    private validatePhoneNumberRules = withValidation({
        rules: [
            {
                key: "required",
                test({ value, allowEmpty }): boolean {
                    return allowEmpty || !!value;
                },
                invalid: (): string => _t("auth|msisdn_field_required_invalid"),
            },
            {
                key: "number",
                test: ({ value }): boolean => !value || PHONE_NUMBER_REGEX.test(value),
                invalid: (): string => _t("auth|msisdn_field_number_invalid"),
            },
        ],
    });

    private onPhoneNumberValidate = async (fieldState: IFieldState): Promise<IValidationResult> => {
        const result = await this.validatePhoneNumberRules(fieldState);
        this.markFieldValid(LoginField.Password, result.valid);
        return result;
    };

    private validatePasswordRules = withValidation({
        rules: [
            {
                key: "required",
                test({ value, allowEmpty }): boolean {
                    return allowEmpty || !!value;
                },
                invalid: (): string => _t("auth|password_field_label"),
            },
        ],
    });

    private onPasswordValidate = async (fieldState: IFieldState): Promise<IValidationResult> => {
        const result = await this.validatePasswordRules(fieldState);
        this.markFieldValid(LoginField.Password, result.valid);
        return result;
    };

    private renderLoginField(loginType: IState["loginType"], autoFocus: boolean): JSX.Element {
        const classes = {
            error: false,
        };

        switch (loginType) {
            case LoginField.Email:
                classes.error = this.props.loginIncorrect && !this.props.username;
                return (
                    <EmailField
                        id="mx_LoginForm_email"
                        className={classNames(classes)}
                        name="username" // make it a little easier for browser's remember-password
                        autoComplete="email"
                        type="email"
                        key="email_input"
                        placeholder="joe@example.com"
                        value={this.props.username}
                        onChange={this.onUsernameChanged}
                        onBlur={this.onUsernameBlur}
                        disabled={this.props.busy}
                        autoFocus={autoFocus}
                        onValidate={this.onEmailValidate}
                        fieldRef={(field): void => {
                            this[LoginField.Email] = field;
                        }}
                    />
                );
            case LoginField.MatrixId:
                classes.error = this.props.loginIncorrect && !this.props.username;
                return (
                    <Field
                        id="mx_LoginForm_username"
                        className={classNames(classes)}
                        name="username" // make it a little easier for browser's remember-password
                        autoComplete="username"
                        key="username_input"
                        type="text"
                        label={_t("common|username")}
                        placeholder={_t("common|username")}
                        value={this.props.username}
                        onChange={this.onUsernameChanged}
                        onBlur={this.onUsernameBlur}
                        disabled={this.props.busy}
                        autoFocus={autoFocus}
                        onValidate={this.onUsernameValidate}
                        ref={(field): void => {
                            this[LoginField.MatrixId] = field;
                        }}
                    />
                );
            case LoginField.Phone: {
                classes.error = this.props.loginIncorrect && !this.props.phoneNumber;

                const phoneCountry = (
                    <CountryDropdown
                        value={this.props.phoneCountry}
                        isSmall={true}
                        showPrefix={true}
                        onOptionChange={this.onPhoneCountryChanged}
                    />
                );

                return (
                    <Field
                        id="mx_LoginForm_phone"
                        className={classNames(classes)}
                        name="phoneNumber"
                        autoComplete="tel-national"
                        key="phone_input"
                        type="text"
                        label={_t("auth|msisdn_field_label")}
                        value={this.props.phoneNumber}
                        prefixComponent={phoneCountry}
                        onChange={this.onPhoneNumberChanged}
                        disabled={this.props.busy}
                        autoFocus={autoFocus}
                        onValidate={this.onPhoneNumberValidate}
                        ref={(field): void => {
                            this[LoginField.Password] = field;
                        }}
                    />
                );
            }
        }
    }

    private isLoginEmpty(): boolean {
        switch (this.state.loginType) {
            case LoginField.Email:
            case LoginField.MatrixId:
                return !this.props.username;
            case LoginField.Phone:
                return !this.props.phoneCountry || !this.props.phoneNumber;
        }
    }

    public render(): React.ReactNode {
        let forgotPasswordJsx: JSX.Element | undefined;

        if (this.props.onForgotPasswordClick) {
            forgotPasswordJsx = (
                <AccessibleButton
                    className="mx_Login_forgot"
                    disabled={this.props.busy}
                    kind="link"
                    onClick={this.onForgotPasswordClick}
                >
                    {_t("auth|reset_password_button")}
                </AccessibleButton>
            );
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
                    <label className="mx_Login_type_label">{_t("auth|identifier_label")}</label>
                    <Field
                        element="select"
                        value={this.state.loginType}
                        onChange={this.onLoginTypeChange}
                        disabled={this.props.busy}
                    >
                        <option key={LoginField.MatrixId} value={LoginField.MatrixId}>
                            {_t("common|username")}
                        </option>
                        <option key={LoginField.Email} value={LoginField.Email}>
                            {_t("common|email_address")}
                        </option>
                        <option key={LoginField.Password} value={LoginField.Password}>
                            {_t("auth|msisdn_field_label")}
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
                        id="mx_LoginForm_password"
                        className={pwFieldClass}
                        autoComplete="current-password"
                        type="password"
                        name="password"
                        label={_t("common|password")}
                        value={this.state.password}
                        onChange={this.onPasswordChanged}
                        disabled={this.props.busy}
                        autoFocus={autoFocusPassword}
                        onValidate={this.onPasswordValidate}
                        ref={(field) => {
                            this[LoginField.Password] = field;
                        }}
                    />
                    {forgotPasswordJsx}
                    {!this.props.busy && (
                        <input
                            className="mx_Login_submit"
                            type="submit"
                            value={_t("action|sign_in")}
                            disabled={this.props.disableSubmit}
                        />
                    )}
                </form>
            </div>
        );
    }
}

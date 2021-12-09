/*
Copyright 2015, 2016 OpenMarket Ltd
Copyright 2017, 2018, 2019 New Vector Ltd
Copyright 2019 The Matrix.org Foundation C.I.C.

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
import { logger } from "matrix-js-sdk/src/logger";

import { _t, _td } from '../../../languageHandler';
import Modal from "../../../Modal";
import PasswordReset from "../../../PasswordReset";
import AutoDiscoveryUtils, { ValidatedServerConfig } from "../../../utils/AutoDiscoveryUtils";
import AuthPage from "../../views/auth/AuthPage";
import CountlyAnalytics from "../../../CountlyAnalytics";
import ServerPicker from "../../views/elements/ServerPicker";
import EmailField from "../../views/auth/EmailField";
import PassphraseField from '../../views/auth/PassphraseField';
import { replaceableComponent } from "../../../utils/replaceableComponent";
import { PASSWORD_MIN_SCORE } from '../../views/auth/RegistrationForm';
import InlineSpinner from '../../views/elements/InlineSpinner';
import Spinner from "../../views/elements/Spinner";
import QuestionDialog from "../../views/dialogs/QuestionDialog";
import ErrorDialog from "../../views/dialogs/ErrorDialog";
import AuthHeader from "../../views/auth/AuthHeader";
import AuthBody from "../../views/auth/AuthBody";
import PassphraseConfirmField from "../../views/auth/PassphraseConfirmField";

enum Phase {
    // Show the forgot password inputs
    Forgot = 1,
    // Email is in the process of being sent
    SendingEmail = 2,
    // Email has been sent
    EmailSent = 3,
    // User has clicked the link in email and completed reset
    Done = 4,
}

interface IProps {
    serverConfig: ValidatedServerConfig;
    onServerConfigChange: (serverConfig: ValidatedServerConfig) => void;
    onLoginClick?: () => void;
    onComplete: () => void;
}

interface IState {
    phase: Phase;
    email: string;
    password: string;
    password2: string;
    errorText: string;

    // We perform liveliness checks later, but for now suppress the errors.
    // We also track the server dead errors independently of the regular errors so
    // that we can render it differently, and override any other error the user may
    // be seeing.
    serverIsAlive: boolean;
    serverErrorIsFatal: boolean;
    serverDeadError: string;

    currentHttpRequest?: Promise<any>;
}

enum ForgotPasswordField {
    Email = 'field_email',
    Password = 'field_password',
    PasswordConfirm = 'field_password_confirm',
}

@replaceableComponent("structures.auth.ForgotPassword")
export default class ForgotPassword extends React.Component<IProps, IState> {
    private reset: PasswordReset;

    state: IState = {
        phase: Phase.Forgot,
        email: "",
        password: "",
        password2: "",
        errorText: null,

        // We perform liveliness checks later, but for now suppress the errors.
        // We also track the server dead errors independently of the regular errors so
        // that we can render it differently, and override any other error the user may
        // be seeing.
        serverIsAlive: true,
        serverErrorIsFatal: false,
        serverDeadError: "",
    };

    constructor(props: IProps) {
        super(props);

        CountlyAnalytics.instance.track("onboarding_forgot_password_begin");
    }

    public componentDidMount() {
        this.reset = null;
        this.checkServerLiveliness(this.props.serverConfig);
    }

    // TODO: [REACT-WARNING] Replace with appropriate lifecycle event
    // eslint-disable-next-line
    public UNSAFE_componentWillReceiveProps(newProps: IProps): void {
        if (newProps.serverConfig.hsUrl === this.props.serverConfig.hsUrl &&
            newProps.serverConfig.isUrl === this.props.serverConfig.isUrl) return;

        // Do a liveliness check on the new URLs
        this.checkServerLiveliness(newProps.serverConfig);
    }

    private async checkServerLiveliness(serverConfig): Promise<void> {
        try {
            await AutoDiscoveryUtils.validateServerConfigWithStaticUrls(
                serverConfig.hsUrl,
                serverConfig.isUrl,
            );

            this.setState({
                serverIsAlive: true,
            });
        } catch (e) {
            this.setState(AutoDiscoveryUtils.authComponentStateForError(e, "forgot_password") as IState);
        }
    }

    public submitPasswordReset(email: string, password: string): void {
        this.setState({
            phase: Phase.SendingEmail,
        });
        this.reset = new PasswordReset(this.props.serverConfig.hsUrl, this.props.serverConfig.isUrl);
        this.reset.resetPassword(email, password).then(() => {
            this.setState({
                phase: Phase.EmailSent,
            });
        }, (err) => {
            this.showErrorDialog(_t('Failed to send email') + ": " + err.message);
            this.setState({
                phase: Phase.Forgot,
            });
        });
    }

    private onVerify = async (ev: React.MouseEvent): Promise<void> => {
        ev.preventDefault();
        if (!this.reset) {
            logger.error("onVerify called before submitPasswordReset!");
            return;
        }
        if (this.state.currentHttpRequest) return;

        try {
            await this.handleHttpRequest(this.reset.checkEmailLinkClicked());
            this.setState({ phase: Phase.Done });
        } catch (err) {
            this.showErrorDialog(err.message);
        }
    };

    private onSubmitForm = async (ev: React.FormEvent): Promise<void> => {
        ev.preventDefault();
        if (this.state.currentHttpRequest) return;

        // refresh the server errors, just in case the server came back online
        await this.handleHttpRequest(this.checkServerLiveliness(this.props.serverConfig));

        const allFieldsValid = await this.verifyFieldsBeforeSubmit();
        if (!allFieldsValid) {
            return;
        }

        Modal.createTrackedDialog('Forgot Password Warning', '', QuestionDialog, {
            title: _t('Warning!'),
            description:
                <div>
                    { _t(
                        "Changing your password will reset any end-to-end encryption keys " +
                        "on all of your sessions, making encrypted chat history unreadable. Set up " +
                        "Key Backup or export your room keys from another session before resetting your " +
                        "password.",
                    ) }
                </div>,
            button: _t('Continue'),
            onFinished: (confirmed) => {
                if (confirmed) {
                    this.submitPasswordReset(this.state.email, this.state.password);
                }
            },
        });
    };

    private async verifyFieldsBeforeSubmit() {
        const fieldIdsInDisplayOrder = [
            ForgotPasswordField.Email,
            ForgotPasswordField.Password,
            ForgotPasswordField.PasswordConfirm,
        ];

        const invalidFields = [];
        for (const fieldId of fieldIdsInDisplayOrder) {
            const valid = await this[fieldId].validate({ allowEmpty: false });
            if (!valid) {
                invalidFields.push(this[fieldId]);
            }
        }

        if (invalidFields.length === 0) {
            return true;
        }

        // Focus on the first invalid field, then re-validate,
        // which will result in the error tooltip being displayed for that field.
        invalidFields[0].focus();
        invalidFields[0].validate({ allowEmpty: false, focused: true });

        return false;
    }

    private onInputChanged = (stateKey: string, ev: React.FormEvent<HTMLInputElement>) => {
        this.setState({
            [stateKey]: ev.currentTarget.value,
        } as any);
    };

    private onLoginClick = (ev: React.MouseEvent): void => {
        ev.preventDefault();
        ev.stopPropagation();
        this.props.onLoginClick();
    };

    public showErrorDialog(description: string, title?: string) {
        Modal.createTrackedDialog('Forgot Password Error', '', ErrorDialog, {
            title,
            description,
        });
    }

    private handleHttpRequest<T = unknown>(request: Promise<T>): Promise<T> {
        this.setState({
            currentHttpRequest: request,
        });
        return request.finally(() => {
            this.setState({
                currentHttpRequest: undefined,
            });
        });
    }

    renderForgot() {
        let errorText = null;
        const err = this.state.errorText;
        if (err) {
            errorText = <div className="mx_Login_error">{ err }</div>;
        }

        let serverDeadSection;
        if (!this.state.serverIsAlive) {
            const classes = classNames({
                "mx_Login_error": true,
                "mx_Login_serverError": true,
                "mx_Login_serverErrorNonFatal": !this.state.serverErrorIsFatal,
            });
            serverDeadSection = (
                <div className={classes}>
                    { this.state.serverDeadError }
                </div>
            );
        }

        return <div>
            { errorText }
            { serverDeadSection }
            <ServerPicker
                serverConfig={this.props.serverConfig}
                onServerConfigChange={this.props.onServerConfigChange}
            />
            <form onSubmit={this.onSubmitForm}>
                <div className="mx_AuthBody_fieldRow">
                    <EmailField
                        name="reset_email" // define a name so browser's password autofill gets less confused
                        labelRequired={_td('The email address linked to your account must be entered.')}
                        labelInvalid={_td("The email address doesn't appear to be valid.")}
                        value={this.state.email}
                        fieldRef={field => this[ForgotPasswordField.Email] = field}
                        autoFocus={true}
                        onChange={this.onInputChanged.bind(this, "email")}
                        onFocus={() => CountlyAnalytics.instance.track("onboarding_forgot_password_email_focus")}
                        onBlur={() => CountlyAnalytics.instance.track("onboarding_forgot_password_email_blur")}
                    />
                </div>
                <div className="mx_AuthBody_fieldRow">
                    <PassphraseField
                        name="reset_password"
                        type="password"
                        label={_td('New Password')}
                        value={this.state.password}
                        minScore={PASSWORD_MIN_SCORE}
                        fieldRef={field => this[ForgotPasswordField.Password] = field}
                        onChange={this.onInputChanged.bind(this, "password")}
                        onFocus={() => CountlyAnalytics.instance.track("onboarding_forgot_password_newPassword_focus")}
                        onBlur={() => CountlyAnalytics.instance.track("onboarding_forgot_password_newPassword_blur")}
                        autoComplete="new-password"
                    />
                    <PassphraseConfirmField
                        name="reset_password_confirm"
                        label={_td('Confirm')}
                        labelRequired={_td("A new password must be entered.")}
                        labelInvalid={_td("New passwords must match each other.")}
                        value={this.state.password2}
                        password={this.state.password}
                        fieldRef={field => this[ForgotPasswordField.PasswordConfirm] = field}
                        onChange={this.onInputChanged.bind(this, "password2")}
                        onFocus={() => CountlyAnalytics.instance.track("onboarding_forgot_password_newPassword2_focus")}
                        onBlur={() => CountlyAnalytics.instance.track("onboarding_forgot_password_newPassword2_blur")}
                        autoComplete="new-password"
                    />
                </div>
                <span>{ _t(
                    'A verification email will be sent to your inbox to confirm ' +
                    'setting your new password.',
                ) }</span>
                <input
                    className="mx_Login_submit"
                    type="submit"
                    value={_t('Send Reset Email')}
                />
            </form>
            <a className="mx_AuthBody_changeFlow" onClick={this.onLoginClick} href="#">
                { _t('Sign in instead') }
            </a>
        </div>;
    }

    renderSendingEmail() {
        return <Spinner />;
    }

    renderEmailSent() {
        return <div>
            { _t("An email has been sent to %(emailAddress)s. Once you've followed the " +
                "link it contains, click below.", { emailAddress: this.state.email }) }
            <br />
            <input
                className="mx_Login_submit"
                type="button"
                onClick={this.onVerify}
                value={_t('I have verified my email address')} />
            { this.state.currentHttpRequest && (
                <div className="mx_Login_spinner"><InlineSpinner w={64} h={64} /></div>)
            }
        </div>;
    }

    renderDone() {
        return <div>
            <p>{ _t("Your password has been reset.") }</p>
            <p>{ _t(
                "You have been logged out of all sessions and will no longer receive " +
                "push notifications. To re-enable notifications, sign in again on each " +
                "device.",
            ) }</p>
            <input
                className="mx_Login_submit"
                type="button"
                onClick={this.props.onComplete}
                value={_t('Return to login screen')} />
        </div>;
    }

    render() {
        let resetPasswordJsx;
        switch (this.state.phase) {
            case Phase.Forgot:
                resetPasswordJsx = this.renderForgot();
                break;
            case Phase.SendingEmail:
                resetPasswordJsx = this.renderSendingEmail();
                break;
            case Phase.EmailSent:
                resetPasswordJsx = this.renderEmailSent();
                break;
            case Phase.Done:
                resetPasswordJsx = this.renderDone();
                break;
            default:
                resetPasswordJsx = <div className="mx_Login_spinner"><InlineSpinner w={64} h={64} /></div>;
        }

        return (
            <AuthPage>
                <AuthHeader />
                <AuthBody>
                    <h2> { _t('Set a new password') } </h2>
                    { resetPasswordJsx }
                </AuthBody>
            </AuthPage>
        );
    }
}

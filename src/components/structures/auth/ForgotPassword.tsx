/*
Copyright 2024 New Vector Ltd.
Copyright 2019 The Matrix.org Foundation C.I.C.
Copyright 2017, 2018 , 2019 New Vector Ltd
Copyright 2015, 2016 OpenMarket Ltd

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import React, { ReactNode } from "react";
import { logger } from "matrix-js-sdk/src/logger";
import { sleep } from "matrix-js-sdk/src/utils";
import { LockSolidIcon, CheckIcon } from "@vector-im/compound-design-tokens/assets/web/icons";

import { _t, _td } from "../../../languageHandler";
import Modal from "../../../Modal";
import PasswordReset from "../../../PasswordReset";
import AuthPage from "../../views/auth/AuthPage";
import PassphraseField from "../../views/auth/PassphraseField";
import { PASSWORD_MIN_SCORE } from "../../views/auth/RegistrationForm";
import AuthHeader from "../../views/auth/AuthHeader";
import AuthBody from "../../views/auth/AuthBody";
import PassphraseConfirmField from "../../views/auth/PassphraseConfirmField";
import StyledCheckbox from "../../views/elements/StyledCheckbox";
import { ValidatedServerConfig } from "../../../utils/ValidatedServerConfig";
import QuestionDialog from "../../views/dialogs/QuestionDialog";
import { EnterEmail } from "./forgot-password/EnterEmail";
import { CheckEmail } from "./forgot-password/CheckEmail";
import Field from "../../views/elements/Field";
import { ErrorMessage } from "../ErrorMessage";
import { VerifyEmailModal } from "./forgot-password/VerifyEmailModal";
import Spinner from "../../views/elements/Spinner";
import { formatSeconds } from "../../../DateUtils";
import AutoDiscoveryUtils from "../../../utils/AutoDiscoveryUtils";

const emailCheckInterval = 2000;

enum Phase {
    // Show email input
    EnterEmail = 1,
    // Email is in the process of being sent
    SendingEmail = 2,
    // Email has been sent
    EmailSent = 3,
    // Show new password input
    PasswordInput = 4,
    // Password is in the process of being reset
    ResettingPassword = 5,
    // All done
    Done = 6,
}

interface Props {
    serverConfig: ValidatedServerConfig;
    onLoginClick: () => void;
    onComplete: () => void;
}

interface State {
    phase: Phase;
    email: string;
    password: string;
    password2: string;
    errorText: string | ReactNode | null;

    // We perform liveliness checks later, but for now suppress the errors.
    // We also track the server dead errors independently of the regular errors so
    // that we can render it differently, and override any other error the user may
    // be seeing.
    serverIsAlive: boolean;
    serverDeadError: string;

    logoutDevices: boolean;
}

export default class ForgotPassword extends React.Component<Props, State> {
    private reset: PasswordReset;
    private fieldPassword: Field | null = null;
    private fieldPasswordConfirm: Field | null = null;

    public constructor(props: Props) {
        super(props);
        this.state = {
            phase: Phase.EnterEmail,
            email: "",
            password: "",
            password2: "",
            errorText: null,
            // We perform liveliness checks later, but for now suppress the errors.
            // We also track the server dead errors independently of the regular errors so
            // that we can render it differently, and override any other error the user may
            // be seeing.
            serverIsAlive: true,
            serverDeadError: "",
            logoutDevices: false,
        };
        this.reset = new PasswordReset(this.props.serverConfig.hsUrl, this.props.serverConfig.isUrl);
    }

    public componentDidUpdate(prevProps: Readonly<Props>): void {
        if (
            prevProps.serverConfig.hsUrl !== this.props.serverConfig.hsUrl ||
            prevProps.serverConfig.isUrl !== this.props.serverConfig.isUrl
        ) {
            // Do a liveliness check on the new URLs
            this.checkServerLiveliness(this.props.serverConfig);
        }
    }

    private async checkServerLiveliness(serverConfig: ValidatedServerConfig): Promise<void> {
        try {
            await AutoDiscoveryUtils.validateServerConfigWithStaticUrls(serverConfig.hsUrl, serverConfig.isUrl);

            this.setState({
                serverIsAlive: true,
            });
        } catch (e: any) {
            const { serverIsAlive, serverDeadError } = AutoDiscoveryUtils.authComponentStateForError(
                e,
                "forgot_password",
            );
            this.setState({
                serverIsAlive,
                errorText: serverDeadError,
            });
        }
    }

    private async onPhaseEmailInputSubmit(): Promise<void> {
        this.phase = Phase.SendingEmail;

        if (await this.sendVerificationMail()) {
            this.phase = Phase.EmailSent;
            return;
        }

        this.phase = Phase.EnterEmail;
    }

    private sendVerificationMail = async (): Promise<boolean> => {
        try {
            await this.reset.requestResetToken(this.state.email);
            return true;
        } catch (err: any) {
            this.handleError(err);
        }

        return false;
    };

    private handleError(err: any): void {
        if (err?.httpStatus === 429) {
            // 429: rate limit
            const retryAfterMs = parseInt(err?.data?.retry_after_ms, 10);

            const errorText = isNaN(retryAfterMs)
                ? _t("auth|reset_password|rate_limit_error")
                : _t("auth|reset_password|rate_limit_error_with_time", {
                      timeout: formatSeconds(retryAfterMs / 1000),
                  });

            this.setState({
                errorText,
            });
            return;
        }

        if (err?.name === "ConnectionError") {
            this.setState({
                errorText: _t("cannot_reach_homeserver") + ": " + _t("cannot_reach_homeserver_detail"),
            });
            return;
        }

        this.setState({
            errorText: err.message,
        });
    }

    private async onPhaseEmailSentSubmit(): Promise<void> {
        this.setState({
            phase: Phase.PasswordInput,
        });
    }

    private set phase(phase: Phase) {
        this.setState({ phase });
    }

    private async verifyFieldsBeforeSubmit(): Promise<boolean> {
        const fieldIdsInDisplayOrder = [this.fieldPassword, this.fieldPasswordConfirm];

        const invalidFields: Field[] = [];

        for (const field of fieldIdsInDisplayOrder) {
            if (!field) continue;

            const valid = await field.validate({ allowEmpty: false });
            if (!valid) {
                invalidFields.push(field);
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

    private async onPhasePasswordInputSubmit(): Promise<void> {
        if (!(await this.verifyFieldsBeforeSubmit())) return;

        if (this.state.logoutDevices) {
            const logoutDevicesConfirmation = await this.renderConfirmLogoutDevicesDialog();
            if (!logoutDevicesConfirmation) return;
        }

        this.phase = Phase.ResettingPassword;
        this.reset.setLogoutDevices(this.state.logoutDevices);

        try {
            await this.reset.setNewPassword(this.state.password);
            this.setState({ phase: Phase.Done });
            return;
        } catch (err: any) {
            if (err.httpStatus !== 401) {
                // 401 = waiting for email verification, else unknown error
                this.handleError(err);
                return;
            }
        }

        const modal = Modal.createDialog(
            VerifyEmailModal,
            {
                email: this.state.email,
                errorText: this.state.errorText,
                onCloseClick: () => {
                    modal.close();
                    this.setState({ phase: Phase.PasswordInput });
                },
                onReEnterEmailClick: () => {
                    modal.close();
                    this.setState({ phase: Phase.EnterEmail });
                },
                onResendClick: this.sendVerificationMail,
            },
            "mx_VerifyEMailDialog",
            false,
            false,
            {
                onBeforeClose: async (reason?: string): Promise<boolean> => {
                    if (reason === "backgroundClick") {
                        // Modal dismissed by clicking the background.
                        // Go one phase back.
                        this.setState({ phase: Phase.PasswordInput });
                    }

                    return true;
                },
            },
        );

        // Don't retry if the phase changed. For example when going back to email input.
        while (this.state.phase === Phase.ResettingPassword) {
            try {
                await this.reset.setNewPassword(this.state.password);
                this.setState({ phase: Phase.Done });
                modal.close();
            } catch {
                // Email not confirmed, yet. Retry after a while.
                await sleep(emailCheckInterval);
            }
        }
    }

    private onSubmitForm = async (ev: React.FormEvent): Promise<void> => {
        ev.preventDefault();

        // Should not happen because of disabled forms, but just return if currently doing an action.
        if ([Phase.SendingEmail, Phase.ResettingPassword].includes(this.state.phase)) return;

        this.setState({
            errorText: "",
        });

        // Refresh the server errors. Just in case the server came back online of went offline.
        await this.checkServerLiveliness(this.props.serverConfig);

        // Server error
        if (!this.state.serverIsAlive) return;

        switch (this.state.phase) {
            case Phase.EnterEmail:
                this.onPhaseEmailInputSubmit();
                break;
            case Phase.EmailSent:
                this.onPhaseEmailSentSubmit();
                break;
            case Phase.PasswordInput:
                this.onPhasePasswordInputSubmit();
                break;
        }
    };

    private onInputChanged = (
        stateKey: "email" | "password" | "password2",
        ev: React.FormEvent<HTMLInputElement>,
    ): void => {
        let value = ev.currentTarget.value;
        if (stateKey === "email") value = value.trim();
        this.setState({
            [stateKey]: value,
        } as Pick<State, typeof stateKey>);
    };

    public renderEnterEmail(): JSX.Element {
        return (
            <EnterEmail
                email={this.state.email}
                errorText={this.state.errorText}
                homeserver={this.props.serverConfig.hsName}
                loading={this.state.phase === Phase.SendingEmail}
                onInputChanged={this.onInputChanged}
                onLoginClick={this.props.onLoginClick!} // set by default props
                onSubmitForm={this.onSubmitForm}
            />
        );
    }

    public async renderConfirmLogoutDevicesDialog(): Promise<boolean> {
        const { finished } = Modal.createDialog(QuestionDialog, {
            title: _t("common|warning"),
            description: (
                <div>
                    <p>{_t("auth|reset_password|other_devices_logout_warning_1")}</p>
                    <p>{_t("auth|reset_password|other_devices_logout_warning_2")}</p>
                </div>
            ),
            button: _t("action|continue"),
        });
        const [confirmed] = await finished;
        return !!confirmed;
    }

    public renderCheckEmail(): JSX.Element {
        return (
            <CheckEmail
                email={this.state.email}
                errorText={this.state.errorText}
                onReEnterEmailClick={() => this.setState({ phase: Phase.EnterEmail })}
                onResendClick={this.sendVerificationMail}
                onSubmitForm={this.onSubmitForm}
            />
        );
    }

    public renderSetPassword(): JSX.Element {
        const submitButtonChild =
            this.state.phase === Phase.ResettingPassword ? <Spinner w={16} h={16} /> : _t("auth|reset_password_action");

        return (
            <>
                <LockSolidIcon className="mx_AuthBody_lockIcon" />
                <h1>{_t("auth|reset_password_title")}</h1>
                <form onSubmit={this.onSubmitForm}>
                    <fieldset disabled={this.state.phase === Phase.ResettingPassword}>
                        <div className="mx_AuthBody_fieldRow">
                            <PassphraseField
                                name="reset_password"
                                type="password"
                                label={_td("auth|change_password_new_label")}
                                value={this.state.password}
                                minScore={PASSWORD_MIN_SCORE}
                                fieldRef={(field) => (this.fieldPassword = field)}
                                onChange={this.onInputChanged.bind(this, "password")}
                                autoComplete="new-password"
                            />
                            <PassphraseConfirmField
                                name="reset_password_confirm"
                                label={_td("auth|reset_password|confirm_new_password")}
                                labelRequired={_td("auth|reset_password|password_not_entered")}
                                labelInvalid={_td("auth|reset_password|passwords_mismatch")}
                                value={this.state.password2}
                                password={this.state.password}
                                fieldRef={(field) => (this.fieldPasswordConfirm = field)}
                                onChange={this.onInputChanged.bind(this, "password2")}
                                autoComplete="new-password"
                            />
                        </div>
                        <div className="mx_AuthBody_fieldRow">
                            <StyledCheckbox
                                onChange={() => this.setState({ logoutDevices: !this.state.logoutDevices })}
                                checked={this.state.logoutDevices}
                            >
                                {_t("auth|reset_password|sign_out_other_devices")}
                            </StyledCheckbox>
                        </div>
                        {this.state.errorText && <ErrorMessage message={this.state.errorText} />}
                        <button type="submit" className="mx_Login_submit">
                            {submitButtonChild}
                        </button>
                    </fieldset>
                </form>
            </>
        );
    }

    public renderDone(): JSX.Element {
        return (
            <>
                <CheckIcon className="mx_Icon mx_Icon_32 mx_Icon_accent" />
                <h1>{_t("auth|reset_password|reset_successful")}</h1>
                {this.state.logoutDevices ? <p>{_t("auth|reset_password|devices_logout_success")}</p> : null}
                <input
                    className="mx_Login_submit"
                    type="button"
                    onClick={this.props.onComplete}
                    value={_t("auth|reset_password|return_to_login")}
                />
            </>
        );
    }

    public render(): React.ReactNode {
        let resetPasswordJsx: JSX.Element;

        switch (this.state.phase) {
            case Phase.EnterEmail:
            case Phase.SendingEmail:
                resetPasswordJsx = this.renderEnterEmail();
                break;
            case Phase.EmailSent:
                resetPasswordJsx = this.renderCheckEmail();
                break;
            case Phase.PasswordInput:
            case Phase.ResettingPassword:
                resetPasswordJsx = this.renderSetPassword();
                break;
            case Phase.Done:
                resetPasswordJsx = this.renderDone();
                break;
            default:
                // This should not happen. However, it is logged and the user is sent to the start.
                logger.warn(`unknown forgot password phase ${this.state.phase}`);
                this.setState({
                    phase: Phase.EnterEmail,
                });
                return;
        }

        return (
            <AuthPage>
                <AuthHeader />
                <AuthBody className="mx_AuthBody_forgot-password">{resetPasswordJsx}</AuthBody>
            </AuthPage>
        );
    }
}

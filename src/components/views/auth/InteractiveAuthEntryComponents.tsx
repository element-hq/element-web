/*
Copyright 2024 New Vector Ltd.
Copyright 2016-2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import classNames from "classnames";
import { type InternationalisedPolicy, type Terms, type MatrixClient } from "matrix-js-sdk/src/matrix";
import { AuthType, type AuthDict, type IInputs, type IStageStatus } from "matrix-js-sdk/src/interactive-auth";
import { logger } from "matrix-js-sdk/src/logger";
import React, { type JSX, type ChangeEvent, createRef, type FormEvent, Fragment } from "react";
import { Button, Text } from "@vector-im/compound-web";
import PopOutIcon from "@vector-im/compound-design-tokens/assets/web/icons/pop-out";

import EmailPromptIcon from "../../../../res/img/element-icons/email-prompt.svg";
import { _t } from "../../../languageHandler";
import { AuthHeaderModifier } from "../../structures/auth/header/AuthHeaderModifier";
import AccessibleButton, { type AccessibleButtonKind, type ButtonEvent } from "../elements/AccessibleButton";
import Field from "../elements/Field";
import Spinner from "../elements/Spinner";
import CaptchaForm from "./CaptchaForm";
import { Flex } from "../../utils/Flex";
import { pickBestPolicyLanguage } from "../../../Terms.ts";

/* This file contains a collection of components which are used by the
 * InteractiveAuth to prompt the user to enter the information needed
 * for an auth stage. (The intention is that they could also be used for other
 * components, such as the registration flow).
 *
 * Call getEntryComponentForLoginType() to get a component suitable for a
 * particular login type. Each component requires the same properties:
 *
 * matrixClient:           A matrix client. May be a different one to the one
 *                         currently being used generally (eg. to register with
 *                         one HS whilst being a guest on another).
 * loginType:              the login type of the auth stage being attempted
 * authSessionId:          session id from the server
 * clientSecret:           The client secret in use for identity server auth sessions
 * stageParams:            params from the server for the stage being attempted
 * errorText:              error message from a previous attempt to authenticate
 * submitAuthDict:         a function which will be called with the new auth dict
 * busy:                   a boolean indicating whether the auth logic is doing something
 *                         the user needs to wait for.
 * inputs:                 Object of inputs provided by the user, as in js-sdk
 *                         interactive-auth
 * stageState:             Stage-specific object used for communicating state information
 *                         to the UI from the state-specific auth logic.
 *                         Defined keys for stages are:
 *                             m.login.email.identity:
 *                              * emailSid: string representing the sid of the active
 *                                          verification session from the identity server,
 *                                          or null if no session is active.
 * fail:                   a function which should be called with an error object if an
 *                         error occurred during the auth stage. This will cause the auth
 *                         session to be failed and the process to go back to the start.
 * setEmailSid:            m.login.email.identity only: a function to be called with the
 *                         email sid after a token is requested.
 * onPhaseChange:          A function which is called when the stage's phase changes. If
 *                         the stage has no phases, call this with DEFAULT_PHASE. Takes
 *                         one argument, the phase, and is always defined/required.
 * continueText:           For stages which have a continue button, the text to use.
 * continueKind:           For stages which have a continue button, the style of button to
 *                         use. For example, 'danger' or 'primary'.
 * onCancel                A function with no arguments which is called by the stage if the
 *                         user knowingly cancelled/dismissed the authentication attempt.
 *
 * Each component may also provide the following functions (beyond the standard React ones):
 *    focus: set the input focus appropriately in the form.
 */

export const DEFAULT_PHASE = 0;

interface IAuthEntryProps {
    matrixClient: MatrixClient;
    loginType: string;
    authSessionId?: string;
    errorText?: string;
    errorCode?: string;
    // Is the auth logic currently waiting for something to happen?
    busy?: boolean;
    onPhaseChange: (phase: number) => void;
    submitAuthDict: (auth: AuthDict) => void;
    requestEmailToken?: () => Promise<void>;
    fail: (error: Error) => void;
    clientSecret: string;
}

interface IPasswordAuthEntryState {
    password: string;
}

export class PasswordAuthEntry extends React.Component<IAuthEntryProps, IPasswordAuthEntryState> {
    public static LOGIN_TYPE = AuthType.Password;

    public constructor(props: IAuthEntryProps) {
        super(props);

        this.state = {
            password: "",
        };
    }

    public componentDidMount(): void {
        this.props.onPhaseChange(DEFAULT_PHASE);
    }

    private onSubmit = (e: FormEvent): void => {
        e.preventDefault();
        if (this.props.busy) return;

        this.props.submitAuthDict({
            type: AuthType.Password,
            identifier: {
                type: "m.id.user",
                user: this.props.matrixClient.credentials.userId,
            },
            password: this.state.password,
        });
    };

    private onPasswordFieldChange = (ev: ChangeEvent<HTMLInputElement>): void => {
        // enable the submit button iff the password is non-empty
        this.setState({
            password: ev.target.value,
        });
    };

    public render(): React.ReactNode {
        const passwordBoxClass = classNames({
            error: this.props.errorText,
        });

        let submitButtonOrSpinner;
        if (this.props.busy) {
            submitButtonOrSpinner = <Spinner />;
        } else {
            submitButtonOrSpinner = (
                <input
                    type="submit"
                    className="mx_Dialog_primary"
                    disabled={!this.state.password}
                    value={_t("action|continue")}
                />
            );
        }

        let errorSection;
        if (this.props.errorText) {
            errorSection = (
                <div className="error" role="alert">
                    {this.props.errorText}
                </div>
            );
        }

        return (
            <div>
                <p>{_t("auth|uia|password_prompt")}</p>
                <form onSubmit={this.onSubmit} className="mx_InteractiveAuthEntryComponents_passwordSection">
                    <Field
                        className={passwordBoxClass}
                        type="password"
                        name="passwordField"
                        label={_t("common|password")}
                        autoFocus={true}
                        value={this.state.password}
                        onChange={this.onPasswordFieldChange}
                    />
                    {errorSection}
                    <div className="mx_button_row">{submitButtonOrSpinner}</div>
                </form>
            </div>
        );
    }
}

/* eslint-disable camelcase */
interface IRecaptchaAuthEntryProps extends IAuthEntryProps {
    stageParams?: {
        public_key?: string;
    };
}
/* eslint-enable camelcase */

export class RecaptchaAuthEntry extends React.Component<IRecaptchaAuthEntryProps> {
    public static LOGIN_TYPE = AuthType.Recaptcha;

    public componentDidMount(): void {
        this.props.onPhaseChange(DEFAULT_PHASE);
    }

    private onCaptchaResponse = (response: string): void => {
        this.props.submitAuthDict({
            type: AuthType.Recaptcha,
            response: response,
        });
    };

    public render(): React.ReactNode {
        if (this.props.busy) {
            return <Spinner />;
        }

        let errorText = this.props.errorText;

        let sitePublicKey: string | undefined;
        if (!this.props.stageParams || !this.props.stageParams.public_key) {
            errorText = _t("auth|uia|recaptcha_missing_params");
        } else {
            sitePublicKey = this.props.stageParams.public_key;
        }

        let errorSection: JSX.Element | undefined;
        if (errorText) {
            errorSection = (
                <div className="error" role="alert">
                    {errorText}
                </div>
            );
        }

        return (
            <div>
                {sitePublicKey && (
                    <CaptchaForm sitePublicKey={sitePublicKey} onCaptchaResponse={this.onCaptchaResponse} />
                )}
                {errorSection}
            </div>
        );
    }
}

interface ITermsAuthEntryProps extends IAuthEntryProps {
    stageParams?: Partial<Terms>;
}

interface LocalisedPolicyWithId extends InternationalisedPolicy {
    id: string;
}

interface ITermsAuthEntryState {
    policies: LocalisedPolicyWithId[];
    toggledPolicies: {
        [policy: string]: boolean;
    };
    errorText?: string;
}

export class TermsAuthEntry extends React.Component<ITermsAuthEntryProps, ITermsAuthEntryState> {
    public static LOGIN_TYPE = AuthType.Terms;

    public constructor(props: ITermsAuthEntryProps) {
        super(props);

        // example stageParams:
        //
        // {
        //     "policies": {
        //         "privacy_policy": {
        //             "version": "1.0",
        //             "en": {
        //                 "name": "Privacy Policy",
        //                 "url": "https://example.org/privacy-1.0-en.html",
        //             },
        //             "fr": {
        //                 "name": "Politique de confidentialité",
        //                 "url": "https://example.org/privacy-1.0-fr.html",
        //             },
        //         },
        //         "other_policy": { ... },
        //     }
        // }

        const allPolicies = this.props.stageParams?.policies || {};
        const initToggles: Record<string, boolean> = {};
        const pickedPolicies: {
            id: string;
            name: string;
            url: string;
        }[] = [];
        for (const policyId of Object.keys(allPolicies)) {
            const policy = allPolicies[policyId];
            const langPolicy = pickBestPolicyLanguage(policy);
            if (!langPolicy) throw new Error("Failed to find a policy to show the user");

            initToggles[policyId] = false;

            pickedPolicies.push({
                id: policyId,
                name: langPolicy.name,
                url: langPolicy.url,
            });
        }

        this.state = {
            toggledPolicies: initToggles,
            policies: pickedPolicies,
        };
    }

    public componentDidMount(): void {
        this.props.onPhaseChange(DEFAULT_PHASE);
    }

    private togglePolicy(policyId: string): void {
        const newToggles: Record<string, boolean> = {};
        for (const policy of this.state.policies) {
            let checked = this.state.toggledPolicies[policy.id];
            if (policy.id === policyId) checked = !checked;

            newToggles[policy.id] = checked;
        }
        this.setState({ toggledPolicies: newToggles });
    }

    private trySubmit = (): void => {
        let allChecked = true;
        for (const policy of this.state.policies) {
            const checked = this.state.toggledPolicies[policy.id];
            allChecked = allChecked && checked;
        }

        if (allChecked) {
            this.props.submitAuthDict({ type: AuthType.Terms });
        } else {
            this.setState({ errorText: _t("auth|uia|terms_invalid") });
        }
    };

    public render(): React.ReactNode {
        if (this.props.busy) {
            return <Spinner />;
        }

        const checkboxes: JSX.Element[] = [];
        let allChecked = true;
        for (const policy of this.state.policies) {
            const checked = this.state.toggledPolicies[policy.id];
            allChecked = allChecked && checked;

            checkboxes.push(
                // XXX: replace with StyledCheckbox
                <label key={"policy_checkbox_" + policy.id} className="mx_InteractiveAuthEntryComponents_termsPolicy">
                    <input type="checkbox" onChange={() => this.togglePolicy(policy.id)} checked={checked} />
                    <a href={policy.url} target="_blank" rel="noreferrer noopener">
                        {policy.name}
                    </a>
                </label>,
            );
        }

        let errorSection;
        if (this.props.errorText || this.state.errorText) {
            errorSection = (
                <div className="error" role="alert">
                    {this.props.errorText || this.state.errorText}
                </div>
            );
        }

        return (
            <div className="mx_InteractiveAuthEntryComponents">
                <p>{_t("auth|uia|terms")}</p>
                {checkboxes}
                {errorSection}
                <AccessibleButton
                    kind="primary"
                    className="mx_InteractiveAuthEntryComponents_termsSubmit"
                    onClick={this.trySubmit}
                    disabled={!allChecked}
                >
                    {_t("action|accept")}
                </AccessibleButton>
            </div>
        );
    }
}

interface IEmailIdentityAuthEntryProps extends IAuthEntryProps {
    inputs?: {
        emailAddress?: string;
    };
    stageState?: {
        emailSid?: string;
    };
}

interface IEmailIdentityAuthEntryState {
    requested: boolean;
    requesting: boolean;
}

export class EmailIdentityAuthEntry extends React.Component<
    IEmailIdentityAuthEntryProps,
    IEmailIdentityAuthEntryState
> {
    public static LOGIN_TYPE = AuthType.Email;

    public constructor(props: IEmailIdentityAuthEntryProps) {
        super(props);

        this.state = {
            requested: false,
            requesting: false,
        };
    }

    public componentDidMount(): void {
        this.props.onPhaseChange(DEFAULT_PHASE);
    }

    public render(): React.ReactNode {
        let errorSection;
        // ignore the error when errcode is M_UNAUTHORIZED as we expect that error until the link is clicked.
        if (this.props.errorText && this.props.errorCode !== "M_UNAUTHORIZED") {
            errorSection = (
                <div className="error" role="alert">
                    {this.props.errorText}
                </div>
            );
        }

        // This component is now only displayed once the token has been requested,
        // so we know the email has been sent. It can also get loaded after the user
        // has clicked the validation link if the server takes a while to propagate
        // the validation internally. If we're in the session spawned from clicking
        // the validation link, we won't know the email address, so if we don't have it,
        // assume that the link has been clicked and the server will realise when we poll.
        // We only have a session ID if the user has clicked the link in their email,
        // so show a loading state instead of "an email has been sent to..." because
        // that's confusing when you've already read that email.
        if (this.props.inputs?.emailAddress === undefined || this.props.stageState?.emailSid) {
            if (errorSection) {
                return errorSection;
            }
            return <Spinner />;
        } else {
            return (
                <div className="mx_InteractiveAuthEntryComponents_emailWrapper">
                    <AuthHeaderModifier
                        title={_t("auth|uia|email_auth_header")}
                        icon={<img src={EmailPromptIcon} role="presentation" alt="" width={16} />}
                        hideServerPicker={true}
                    />
                    <p>
                        {_t("auth|uia|email", {
                            emailAddress: <strong>{this.props.inputs.emailAddress}</strong>,
                        })}
                    </p>
                    {this.state.requesting ? (
                        <p className="secondary">
                            {_t(
                                "auth|uia|email_resend_prompt",
                                {},
                                {
                                    a: (text: string) => (
                                        <Fragment>
                                            <AccessibleButton kind="link_inline" onClick={null} disabled>
                                                {text} <Spinner w={14} h={14} />
                                            </AccessibleButton>
                                        </Fragment>
                                    ),
                                },
                            )}
                        </p>
                    ) : (
                        <p className="secondary">
                            {_t(
                                "auth|uia|email_resend_prompt",
                                {},
                                {
                                    a: (text: string) => (
                                        <AccessibleButton
                                            kind="link_inline"
                                            title={
                                                this.state.requested ? _t("auth|uia|email_resent") : _t("action|resend")
                                            }
                                            onTooltipOpenChange={
                                                this.state.requested
                                                    ? (open) => {
                                                          if (!open) this.setState({ requested: false });
                                                      }
                                                    : undefined
                                            }
                                            onClick={async (): Promise<void> => {
                                                this.setState({ requesting: true });
                                                try {
                                                    await this.props.requestEmailToken?.();
                                                } catch (e) {
                                                    logger.warn("Email token request failed: ", e);
                                                } finally {
                                                    this.setState({ requested: true, requesting: false });
                                                }
                                            }}
                                        >
                                            {text}
                                        </AccessibleButton>
                                    ),
                                },
                            )}
                        </p>
                    )}
                    {errorSection}
                </div>
            );
        }
    }
}

interface IMsisdnAuthEntryProps extends IAuthEntryProps {
    inputs?: {
        phoneCountry?: string;
        phoneNumber?: string;
    };
}

interface IMsisdnAuthEntryState {
    token: string;
    requestingToken: boolean;
    errorText: string | null;
}

export class MsisdnAuthEntry extends React.Component<IMsisdnAuthEntryProps, IMsisdnAuthEntryState> {
    public static LOGIN_TYPE = AuthType.Msisdn;

    private submitUrl?: string;
    private sid?: string;
    private msisdn?: string;

    public constructor(props: IMsisdnAuthEntryProps) {
        super(props);

        this.state = {
            token: "",
            requestingToken: false,
            errorText: "",
        };
    }

    public componentDidMount(): void {
        this.props.onPhaseChange(DEFAULT_PHASE);

        this.setState({ requestingToken: true });
        this.requestMsisdnToken()
            .catch((e) => {
                this.props.fail(e);
            })
            .finally(() => {
                this.setState({ requestingToken: false });
            });
    }

    /*
     * Requests a verification token by SMS.
     */
    private requestMsisdnToken(): Promise<void> {
        return this.props.matrixClient
            .requestRegisterMsisdnToken(
                this.props.inputs?.phoneCountry ?? "",
                this.props.inputs?.phoneNumber ?? "",
                this.props.clientSecret,
                1, // TODO: Multiple send attempts?
            )
            .then((result) => {
                this.submitUrl = result.submit_url;
                this.sid = result.sid;
                this.msisdn = result.msisdn;
            });
    }

    private onTokenChange = (e: ChangeEvent<HTMLInputElement>): void => {
        this.setState({
            token: e.target.value,
        });
    };

    private onFormSubmit = async (e: FormEvent): Promise<void> => {
        e.preventDefault();
        if (this.state.token == "") return;

        this.setState({
            errorText: null,
        });

        try {
            let result: { success: boolean };
            if (this.submitUrl && this.sid) {
                result = await this.props.matrixClient.submitMsisdnTokenOtherUrl(
                    this.submitUrl,
                    this.sid,
                    this.props.clientSecret,
                    this.state.token,
                );
            } else {
                throw new Error("The registration with MSISDN flow is misconfigured");
            }
            if (result.success) {
                const creds = {
                    sid: this.sid,
                    client_secret: this.props.clientSecret,
                };
                this.props.submitAuthDict({
                    type: AuthType.Msisdn,
                    threepid_creds: creds,
                });
            } else {
                this.setState({
                    errorText: _t("auth|uia|msisdn_token_incorrect"),
                });
            }
        } catch (e) {
            this.props.fail(e instanceof Error ? e : new Error("Failed to submit msisdn token"));
            logger.log("Failed to submit msisdn token");
        }
    };

    public render(): React.ReactNode {
        if (this.state.requestingToken) {
            return <Spinner />;
        } else {
            const enableSubmit = Boolean(this.state.token);
            const submitClasses = classNames({
                mx_InteractiveAuthEntryComponents_msisdnSubmit: true,
                mx_GeneralButton: true,
            });
            let errorSection;
            if (this.state.errorText) {
                errorSection = (
                    <div className="error" role="alert">
                        {this.state.errorText}
                    </div>
                );
            }
            return (
                <div>
                    <p>{_t("auth|uia|msisdn", { msisdn: <i>{this.msisdn}</i> })}</p>
                    <p>{_t("auth|uia|msisdn_token_prompt")}</p>
                    <div className="mx_InteractiveAuthEntryComponents_msisdnWrapper">
                        <form onSubmit={this.onFormSubmit}>
                            <input
                                type="text"
                                className="mx_InteractiveAuthEntryComponents_msisdnEntry"
                                value={this.state.token}
                                onChange={this.onTokenChange}
                                aria-label={_t("auth|uia|code")}
                            />
                            <br />
                            <input
                                type="submit"
                                value={_t("action|submit")}
                                className={submitClasses}
                                disabled={!enableSubmit}
                            />
                        </form>
                        {errorSection}
                    </div>
                </div>
            );
        }
    }
}

interface IRegistrationTokenAuthEntryState {
    registrationToken: string;
}

export class RegistrationTokenAuthEntry extends React.Component<IAuthEntryProps, IRegistrationTokenAuthEntryState> {
    public static readonly LOGIN_TYPE = AuthType.RegistrationToken;

    public constructor(props: IAuthEntryProps) {
        super(props);

        this.state = {
            registrationToken: "",
        };
    }

    public componentDidMount(): void {
        this.props.onPhaseChange(DEFAULT_PHASE);
    }

    private onSubmit = (e: FormEvent): void => {
        e.preventDefault();
        if (this.props.busy) return;

        this.props.submitAuthDict({
            // Could be AuthType.RegistrationToken or AuthType.UnstableRegistrationToken
            type: this.props.loginType,
            token: this.state.registrationToken,
        });
    };

    private onRegistrationTokenFieldChange = (ev: ChangeEvent<HTMLInputElement>): void => {
        // enable the submit button if the registration token is non-empty
        this.setState({
            registrationToken: ev.target.value,
        });
    };

    public render(): React.ReactNode {
        const registrationTokenBoxClass = classNames({
            error: this.props.errorText,
        });

        let submitButtonOrSpinner;
        if (this.props.busy) {
            submitButtonOrSpinner = <Spinner />;
        } else {
            submitButtonOrSpinner = (
                <AccessibleButton onClick={this.onSubmit} kind="primary" disabled={!this.state.registrationToken}>
                    {_t("action|continue")}
                </AccessibleButton>
            );
        }

        let errorSection;
        if (this.props.errorText) {
            errorSection = (
                <div className="error" role="alert">
                    {this.props.errorText}
                </div>
            );
        }

        return (
            <div>
                <p>{_t("auth|uia|registration_token_prompt")}</p>
                <form onSubmit={this.onSubmit} className="mx_InteractiveAuthEntryComponents_registrationTokenSection">
                    <Field
                        className={registrationTokenBoxClass}
                        type="text"
                        name="registrationTokenField"
                        label={_t("auth|uia|registration_token_label")}
                        autoFocus={true}
                        value={this.state.registrationToken}
                        onChange={this.onRegistrationTokenFieldChange}
                    />
                    {errorSection}
                    <div className="mx_button_row">{submitButtonOrSpinner}</div>
                </form>
            </div>
        );
    }
}

// Subset of AccessibleButtonKind which can be specified for the continue button
export type ContinueKind = Extract<AccessibleButtonKind, "primary" | "danger">;

interface ISSOAuthEntryProps extends IAuthEntryProps {
    continueText?: string;
    continueKind?: ContinueKind;
    onCancel?: () => void;
}

interface ISSOAuthEntryState {
    phase: number;
    attemptFailed: boolean;
}

export class SSOAuthEntry extends React.Component<ISSOAuthEntryProps, ISSOAuthEntryState> {
    public static LOGIN_TYPE = AuthType.Sso;
    public static UNSTABLE_LOGIN_TYPE = AuthType.SsoUnstable;

    public static PHASE_PREAUTH = 1; // button to start SSO
    public static PHASE_POSTAUTH = 2; // button to confirm SSO completed

    private ssoUrl: string;
    private popupWindow: Window | null;

    public constructor(props: ISSOAuthEntryProps) {
        super(props);

        if (!this.props.authSessionId) throw new Error("This UIA flow requires an authSessionId");

        // We actually send the user through fallback auth so we don't have to
        // deal with a redirect back to us, losing application context.
        this.ssoUrl = props.matrixClient.getFallbackAuthUrl(this.props.loginType, this.props.authSessionId);

        this.popupWindow = null;

        this.state = {
            phase: SSOAuthEntry.PHASE_PREAUTH,
            attemptFailed: false,
        };
    }

    public componentDidMount(): void {
        window.addEventListener("message", this.onReceiveMessage);
        this.props.onPhaseChange(SSOAuthEntry.PHASE_PREAUTH);
    }

    public componentWillUnmount(): void {
        window.removeEventListener("message", this.onReceiveMessage);
        if (this.popupWindow) {
            this.popupWindow.close();
            this.popupWindow = null;
        }
    }

    public attemptFailed = (): void => {
        this.setState({
            attemptFailed: true,
        });
    };

    private onReceiveMessage = (event: MessageEvent): void => {
        if (event.data === "authDone" && event.source === this.popupWindow) {
            if (this.popupWindow) {
                this.popupWindow.close();
                this.popupWindow = null;
            }
        }
    };

    private onStartAuthClick = (): void => {
        // Note: We don't use PlatformPeg's startSsoAuth functions because we almost
        // certainly will need to open the thing in a new tab to avoid losing application
        // context.

        this.popupWindow = window.open(this.ssoUrl, "_blank");
        this.setState({ phase: SSOAuthEntry.PHASE_POSTAUTH });
        this.props.onPhaseChange(SSOAuthEntry.PHASE_POSTAUTH);
    };

    private onConfirmClick = (): void => {
        this.props.submitAuthDict({});
    };

    public render(): React.ReactNode {
        let continueButton: JSX.Element;

        const cancelButton = (
            <AccessibleButton
                onClick={this.props.onCancel ?? null}
                kind={this.props.continueKind ? `${this.props.continueKind}_outline` : "primary_outline"}
            >
                {_t("action|cancel")}
            </AccessibleButton>
        );
        if (this.state.phase === SSOAuthEntry.PHASE_PREAUTH) {
            continueButton = (
                <AccessibleButton onClick={this.onStartAuthClick} kind={this.props.continueKind || "primary"}>
                    {this.props.continueText || _t("auth|sso")}
                </AccessibleButton>
            );
        } else {
            continueButton = (
                <AccessibleButton onClick={this.onConfirmClick} kind={this.props.continueKind || "primary"}>
                    {this.props.continueText || _t("action|confirm")}
                </AccessibleButton>
            );
        }

        let errorSection;
        if (this.props.errorText) {
            errorSection = (
                <div className="error" role="alert">
                    {this.props.errorText}
                </div>
            );
        } else if (this.state.attemptFailed) {
            errorSection = (
                <div className="error" role="alert">
                    {_t("auth|uia|sso_failed")}
                </div>
            );
        }

        return (
            <Fragment>
                {errorSection}
                <div className="mx_InteractiveAuthEntryComponents_sso_buttons">
                    {this.props.busy ? (
                        <Spinner w={24} h={24} />
                    ) : (
                        <>
                            {cancelButton}
                            {continueButton}
                        </>
                    )}
                </div>
            </Fragment>
        );
    }
}

export class FallbackAuthEntry<T extends object> extends React.Component<IAuthEntryProps & T> {
    protected popupWindow: Window | null;
    protected fallbackButton = createRef<HTMLDivElement>();

    public constructor(props: IAuthEntryProps & T) {
        super(props);

        // we have to make the user click a button, as browsers will block
        // the popup if we open it immediately.
        this.popupWindow = null;
    }

    public componentDidMount(): void {
        window.addEventListener("message", this.onReceiveMessage);
        this.props.onPhaseChange(DEFAULT_PHASE);
    }

    public componentWillUnmount(): void {
        window.removeEventListener("message", this.onReceiveMessage);
        this.popupWindow?.close();
    }

    public focus = (): void => {
        this.fallbackButton.current?.focus();
    };

    private onShowFallbackClick = (e: ButtonEvent): void => {
        if (!this.props.authSessionId) return;

        e.preventDefault();
        e.stopPropagation();

        const url = this.props.matrixClient.getFallbackAuthUrl(this.props.loginType, this.props.authSessionId);
        this.popupWindow = window.open(url, "_blank");
    };

    private onReceiveMessage = (event: MessageEvent): void => {
        if (event.data === "authDone" && event.source === this.popupWindow) {
            this.props.submitAuthDict({});
        }
    };

    public render(): React.ReactNode {
        let errorSection;
        if (this.props.errorText) {
            errorSection = (
                <div className="error" role="alert">
                    {this.props.errorText}
                </div>
            );
        }
        return (
            <div>
                <AccessibleButton kind="link" ref={this.fallbackButton} onClick={this.onShowFallbackClick}>
                    {_t("auth|uia|fallback_button")}
                </AccessibleButton>
                {errorSection}
            </div>
        );
    }
}

export enum CustomAuthType {
    // Workaround for MAS requiring non-UIA authentication for resetting cross-signing.
    MasCrossSigningReset = "org.matrix.cross_signing_reset",
}

export class MasUnlockCrossSigningAuthEntry extends FallbackAuthEntry<{
    stageParams?: {
        url?: string;
    };
}> {
    public static LOGIN_TYPE = CustomAuthType.MasCrossSigningReset;

    private onGoToAccountClick = (): void => {
        if (!this.props.stageParams?.url) return;
        this.popupWindow = window.open(this.props.stageParams.url, "_blank");
    };

    private onRetryClick = (): void => {
        this.props.submitAuthDict({});
    };

    public render(): React.ReactNode {
        return (
            <div>
                <Text>{_t("auth|uia|mas_cross_signing_reset_description")}</Text>
                <Flex gap="var(--cpd-space-4x)">
                    <Button
                        Icon={PopOutIcon}
                        onClick={this.onGoToAccountClick}
                        autoFocus
                        kind="primary"
                        className="mx_Dialog_nonDialogButton"
                    >
                        {_t("auth|uia|mas_cross_signing_reset_cta")}
                    </Button>
                    <Button onClick={this.onRetryClick} kind="secondary" className="mx_Dialog_nonDialogButton">
                        {_t("action|retry")}
                    </Button>
                </Flex>
            </div>
        );
    }
}

export interface IStageComponentProps extends IAuthEntryProps {
    stageParams?: Record<string, any>;
    inputs?: IInputs;
    stageState?: IStageStatus;
    continueText?: string;
    continueKind?: ContinueKind;
    setEmailSid?(sid: string): void;
    onCancel?(): void;
    requestEmailToken?(): Promise<void>;
}

export interface IStageComponent extends React.ComponentClass<React.PropsWithRef<IStageComponentProps>> {
    attemptFailed?(): void;
    focus?(): void;
}

export default function getEntryComponentForLoginType(loginType: AuthType | CustomAuthType): IStageComponent {
    switch (loginType) {
        case CustomAuthType.MasCrossSigningReset:
            return MasUnlockCrossSigningAuthEntry;
        case AuthType.Password:
            return PasswordAuthEntry;
        case AuthType.Recaptcha:
            return RecaptchaAuthEntry;
        case AuthType.Email:
            return EmailIdentityAuthEntry;
        case AuthType.Msisdn:
            return MsisdnAuthEntry;
        case AuthType.Terms:
            return TermsAuthEntry;
        case AuthType.RegistrationToken:
        case AuthType.UnstableRegistrationToken:
            return RegistrationTokenAuthEntry;
        case AuthType.Sso:
        case AuthType.SsoUnstable:
            return SSOAuthEntry;
        default:
            return FallbackAuthEntry;
    }
}

/*
Copyright 2016-2021 The Matrix.org Foundation C.I.C.

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

import React, { ChangeEvent, createRef, FormEvent, MouseEvent } from 'react';
import classNames from 'classnames';
import { MatrixClient } from "matrix-js-sdk/src/client";

import * as sdk from '../../../index';
import { _t } from '../../../languageHandler';
import SettingsStore from "../../../settings/SettingsStore";
import AccessibleButton from "../elements/AccessibleButton";
import Spinner from "../elements/Spinner";
import CountlyAnalytics from "../../../CountlyAnalytics";
import {replaceableComponent} from "../../../utils/replaceableComponent";
import { LocalisedPolicy, Policies } from '../../../Terms';

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
 *                         one HS whilst beign a guest on another).
 * loginType:              the login type of the auth stage being attempted
 * authSessionId:          session id from the server
 * clientSecret:           The client secret in use for ID server auth sessions
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
 *                                          verification session from the ID server, or
 *                                          null if no session is active.
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

enum AuthType {
    Password = "m.login.password",
    Recaptcha = "m.login.recaptcha",
    Terms = "m.login.terms",
    Email = "m.login.email.identity",
    Msisdn = "m.login.msisdn",
    Sso = "m.login.sso",
    SsoUnstable = "org.matrix.login.sso",
}

/* eslint-disable camelcase */
interface IAuthDict {
    type?: AuthType;
    // TODO: Remove `user` once servers support proper UIA
    // See https://github.com/vector-im/element-web/issues/10312
    user?: string;
    identifier?: any;
    password?: string;
    response?: string;
    // TODO: Remove `threepid_creds` once servers support proper UIA
    // See https://github.com/vector-im/element-web/issues/10312
    // See https://github.com/matrix-org/matrix-doc/issues/2220
    threepid_creds?: any;
    threepidCreds?: any;
}
/* eslint-enable camelcase */

export const DEFAULT_PHASE = 0;

interface IAuthEntryProps {
    matrixClient: MatrixClient;
    loginType: string;
    authSessionId: string;
    errorText?: string;
    // Is the auth logic currently waiting for something to happen?
    busy?: boolean;
    onPhaseChange: (phase: number) => void;
    submitAuthDict: (auth: IAuthDict) => void;
}

interface IPasswordAuthEntryState {
    password: string;
}

@replaceableComponent("views.auth.PasswordAuthEntry")
export class PasswordAuthEntry extends React.Component<IAuthEntryProps, IPasswordAuthEntryState> {
    static LOGIN_TYPE = AuthType.Password;

    constructor(props) {
        super(props);

        this.state = {
            password: "",
        };
    }

    componentDidMount() {
        this.props.onPhaseChange(DEFAULT_PHASE);
    }

    private onSubmit = (e: FormEvent) => {
        e.preventDefault();
        if (this.props.busy) return;

        this.props.submitAuthDict({
            type: AuthType.Password,
            // TODO: Remove `user` once servers support proper UIA
            // See https://github.com/vector-im/element-web/issues/10312
            user: this.props.matrixClient.credentials.userId,
            identifier: {
                type: "m.id.user",
                user: this.props.matrixClient.credentials.userId,
            },
            password: this.state.password,
        });
    };

    private onPasswordFieldChange = (ev: ChangeEvent<HTMLInputElement>) => {
        // enable the submit button iff the password is non-empty
        this.setState({
            password: ev.target.value,
        });
    };

    render() {
        const passwordBoxClass = classNames({
            "error": this.props.errorText,
        });

        let submitButtonOrSpinner;
        if (this.props.busy) {
            const Loader = sdk.getComponent("elements.Spinner");
            submitButtonOrSpinner = <Loader />;
        } else {
            submitButtonOrSpinner = (
                <input type="submit"
                    className="mx_Dialog_primary"
                    disabled={!this.state.password}
                    value={_t("Continue")}
                />
            );
        }

        let errorSection;
        if (this.props.errorText) {
            errorSection = (
                <div className="error" role="alert">
                    { this.props.errorText }
                </div>
            );
        }

        const Field = sdk.getComponent('elements.Field');

        return (
            <div>
                <p>{ _t("Confirm your identity by entering your account password below.") }</p>
                <form onSubmit={this.onSubmit} className="mx_InteractiveAuthEntryComponents_passwordSection">
                    <Field
                        className={passwordBoxClass}
                        type="password"
                        name="passwordField"
                        label={_t('Password')}
                        autoFocus={true}
                        value={this.state.password}
                        onChange={this.onPasswordFieldChange}
                    />
                    <div className="mx_button_row">
                        { submitButtonOrSpinner }
                    </div>
                </form>
                { errorSection }
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

@replaceableComponent("views.auth.RecaptchaAuthEntry")
export class RecaptchaAuthEntry extends React.Component<IRecaptchaAuthEntryProps> {
    static LOGIN_TYPE = AuthType.Recaptcha;

    componentDidMount() {
        this.props.onPhaseChange(DEFAULT_PHASE);
    }

    private onCaptchaResponse = (response: string) => {
        CountlyAnalytics.instance.track("onboarding_grecaptcha_submit");
        this.props.submitAuthDict({
            type: AuthType.Recaptcha,
            response: response,
        });
    };

    render() {
        if (this.props.busy) {
            const Loader = sdk.getComponent("elements.Spinner");
            return <Loader />;
        }

        let errorText = this.props.errorText;

        const CaptchaForm = sdk.getComponent("views.auth.CaptchaForm");
        let sitePublicKey;
        if (!this.props.stageParams || !this.props.stageParams.public_key) {
            errorText = _t(
                "Missing captcha public key in homeserver configuration. Please report " +
                "this to your homeserver administrator.",
            );
        } else {
            sitePublicKey = this.props.stageParams.public_key;
        }

        let errorSection;
        if (errorText) {
            errorSection = (
                <div className="error" role="alert">
                    { errorText }
                </div>
            );
        }

        return (
            <div>
                <CaptchaForm sitePublicKey={sitePublicKey}
                    onCaptchaResponse={this.onCaptchaResponse}
                />
                { errorSection }
            </div>
        );
    }
}

interface ITermsAuthEntryProps extends IAuthEntryProps {
    stageParams?: {
        policies?: Policies;
    };
    showContinue: boolean;
}

interface LocalisedPolicyWithId extends LocalisedPolicy {
    id: string;
}

interface ITermsAuthEntryState {
    policies: LocalisedPolicyWithId[];
    toggledPolicies: {
        [policy: string]: boolean;
    };
    errorText?: string;
}

@replaceableComponent("views.auth.TermsAuthEntry")
export class TermsAuthEntry extends React.Component<ITermsAuthEntryProps, ITermsAuthEntryState> {
    static LOGIN_TYPE = AuthType.Terms;

    constructor(props) {
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

        const allPolicies = this.props.stageParams.policies || {};
        const prefLang = SettingsStore.getValue("language");
        const initToggles = {};
        const pickedPolicies = [];
        for (const policyId of Object.keys(allPolicies)) {
            const policy = allPolicies[policyId];

            // Pick a language based on the user's language, falling back to english,
            // and finally to the first language available. If there's still no policy
            // available then the homeserver isn't respecting the spec.
            let langPolicy = policy[prefLang];
            if (!langPolicy) langPolicy = policy["en"];
            if (!langPolicy) {
                // last resort
                const firstLang = Object.keys(policy).find(e => e !== "version");
                langPolicy = policy[firstLang];
            }
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

        CountlyAnalytics.instance.track("onboarding_terms_begin");
    }


    componentDidMount() {
        this.props.onPhaseChange(DEFAULT_PHASE);
    }

    public tryContinue = () => {
        this.trySubmit();
    };

    private togglePolicy(policyId: string) {
        const newToggles = {};
        for (const policy of this.state.policies) {
            let checked = this.state.toggledPolicies[policy.id];
            if (policy.id === policyId) checked = !checked;

            newToggles[policy.id] = checked;
        }
        this.setState({"toggledPolicies": newToggles});
    }

    private trySubmit = () => {
        let allChecked = true;
        for (const policy of this.state.policies) {
            const checked = this.state.toggledPolicies[policy.id];
            allChecked = allChecked && checked;
        }

        if (allChecked) {
            this.props.submitAuthDict({type: AuthType.Terms});
            CountlyAnalytics.instance.track("onboarding_terms_complete");
        } else {
            this.setState({errorText: _t("Please review and accept all of the homeserver's policies")});
        }
    };

    render() {
        if (this.props.busy) {
            const Loader = sdk.getComponent("elements.Spinner");
            return <Loader />;
        }

        const checkboxes = [];
        let allChecked = true;
        for (const policy of this.state.policies) {
            const checked = this.state.toggledPolicies[policy.id];
            allChecked = allChecked && checked;

            checkboxes.push(
                // XXX: replace with StyledCheckbox
                <label key={"policy_checkbox_" + policy.id} className="mx_InteractiveAuthEntryComponents_termsPolicy">
                    <input type="checkbox" onChange={() => this.togglePolicy(policy.id)} checked={checked} />
                    <a href={policy.url} target="_blank" rel="noreferrer noopener">{ policy.name }</a>
                </label>,
            );
        }

        let errorSection;
        if (this.props.errorText || this.state.errorText) {
            errorSection = (
                <div className="error" role="alert">
                    { this.props.errorText || this.state.errorText }
                </div>
            );
        }

        let submitButton;
        if (this.props.showContinue !== false) {
            // XXX: button classes
            submitButton = <button className="mx_InteractiveAuthEntryComponents_termsSubmit mx_GeneralButton"
                onClick={this.trySubmit} disabled={!allChecked}>{_t("Accept")}</button>;
        }

        return (
            <div>
                <p>{_t("Please review and accept the policies of this homeserver:")}</p>
                { checkboxes }
                { errorSection }
                { submitButton }
            </div>
        );
    }
}

interface IEmailIdentityAuthEntryProps extends IAuthEntryProps {
    inputs?: {
        emailAddress?: string;
    };
    stageState?: {
        emailSid: string;
    };
}

@replaceableComponent("views.auth.EmailIdentityAuthEntry")
export class EmailIdentityAuthEntry extends React.Component<IEmailIdentityAuthEntryProps> {
    static LOGIN_TYPE = AuthType.Email;

    componentDidMount() {
        this.props.onPhaseChange(DEFAULT_PHASE);
    }

    render() {
        // This component is now only displayed once the token has been requested,
        // so we know the email has been sent. It can also get loaded after the user
        // has clicked the validation link if the server takes a while to propagate
        // the validation internally. If we're in the session spawned from clicking
        // the validation link, we won't know the email address, so if we don't have it,
        // assume that the link has been clicked and the server will realise when we poll.
        if (this.props.inputs.emailAddress === undefined) {
            return <Spinner />;
        } else if (this.props.stageState?.emailSid) {
            // we only have a session ID if the user has clicked the link in their email,
            // so show a loading state instead of "an email has been sent to..." because
            // that's confusing when you've already read that email.
            return <Spinner />;
        } else {
            return (
                <div className="mx_InteractiveAuthEntryComponents_emailWrapper">
                    <p>{ _t("A confirmation email has been sent to %(emailAddress)s",
                        { emailAddress: <b>{ this.props.inputs.emailAddress }</b> },
                    ) }
                    </p>
                    <p>{ _t("Open the link in the email to continue registration.") }</p>
                </div>
            );
        }
    }
}

interface IMsisdnAuthEntryProps extends IAuthEntryProps {
    inputs: {
        phoneCountry: string;
        phoneNumber: string;
    };
    clientSecret: string;
    fail: (error: Error) => void;
}

interface IMsisdnAuthEntryState {
    token: string;
    requestingToken: boolean;
    errorText: string;
}

@replaceableComponent("views.auth.MsisdnAuthEntry")
export class MsisdnAuthEntry extends React.Component<IMsisdnAuthEntryProps, IMsisdnAuthEntryState> {
    static LOGIN_TYPE = AuthType.Msisdn;

    private submitUrl: string;
    private sid: string;
    private msisdn: string;

    constructor(props) {
        super(props);

        this.state = {
            token: '',
            requestingToken: false,
            errorText: '',
        };
    }

    componentDidMount() {
        this.props.onPhaseChange(DEFAULT_PHASE);

        this.setState({requestingToken: true});
        this.requestMsisdnToken().catch((e) => {
            this.props.fail(e);
        }).finally(() => {
            this.setState({requestingToken: false});
        });
    }

    /*
     * Requests a verification token by SMS.
     */
    private requestMsisdnToken(): Promise<void> {
        return this.props.matrixClient.requestRegisterMsisdnToken(
            this.props.inputs.phoneCountry,
            this.props.inputs.phoneNumber,
            this.props.clientSecret,
            1, // TODO: Multiple send attempts?
        ).then((result) => {
            this.submitUrl = result.submit_url;
            this.sid = result.sid;
            this.msisdn = result.msisdn;
        });
    }

    private onTokenChange = (e: ChangeEvent<HTMLInputElement>) => {
        this.setState({
            token: e.target.value,
        });
    };

    private onFormSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (this.state.token == '') return;

        this.setState({
            errorText: null,
        });

        try {
            let result;
            if (this.submitUrl) {
                result = await this.props.matrixClient.submitMsisdnTokenOtherUrl(
                    this.submitUrl, this.sid, this.props.clientSecret, this.state.token,
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
                    // TODO: Remove `threepid_creds` once servers support proper UIA
                    // See https://github.com/vector-im/element-web/issues/10312
                    // See https://github.com/matrix-org/matrix-doc/issues/2220
                    threepid_creds: creds,
                    threepidCreds: creds,
                });
            } else {
                this.setState({
                    errorText: _t("Token incorrect"),
                });
            }
        } catch (e) {
            this.props.fail(e);
            console.log("Failed to submit msisdn token");
        }
    };

    render() {
        if (this.state.requestingToken) {
            const Loader = sdk.getComponent("elements.Spinner");
            return <Loader />;
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
                        { this.state.errorText }
                    </div>
                );
            }
            return (
                <div>
                    <p>{ _t("A text message has been sent to %(msisdn)s",
                        { msisdn: <i>{ this.msisdn }</i> },
                    ) }
                    </p>
                    <p>{ _t("Please enter the code it contains:") }</p>
                    <div className="mx_InteractiveAuthEntryComponents_msisdnWrapper">
                        <form onSubmit={this.onFormSubmit}>
                            <input type="text"
                                className="mx_InteractiveAuthEntryComponents_msisdnEntry"
                                value={this.state.token}
                                onChange={this.onTokenChange}
                                aria-label={ _t("Code")}
                            />
                            <br />
                            <input type="submit" value={_t("Submit")}
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

interface ISSOAuthEntryProps extends IAuthEntryProps {
    continueText?: string;
    continueKind?: string;
    onCancel?: () => void;
}

interface ISSOAuthEntryState {
    phase: number;
    attemptFailed: boolean;
}

@replaceableComponent("views.auth.SSOAuthEntry")
export class SSOAuthEntry extends React.Component<ISSOAuthEntryProps, ISSOAuthEntryState> {
    static LOGIN_TYPE = AuthType.Sso;
    static UNSTABLE_LOGIN_TYPE = AuthType.SsoUnstable;

    static PHASE_PREAUTH = 1; // button to start SSO
    static PHASE_POSTAUTH = 2; // button to confirm SSO completed

    private ssoUrl: string;
    private popupWindow: Window;

    constructor(props) {
        super(props);

        // We actually send the user through fallback auth so we don't have to
        // deal with a redirect back to us, losing application context.
        this.ssoUrl = props.matrixClient.getFallbackAuthUrl(
            this.props.loginType,
            this.props.authSessionId,
        );

        this.popupWindow = null;
        window.addEventListener("message", this.onReceiveMessage);

        this.state = {
            phase: SSOAuthEntry.PHASE_PREAUTH,
            attemptFailed: false,
        };
    }

    componentDidMount() {
        this.props.onPhaseChange(SSOAuthEntry.PHASE_PREAUTH);
    }

    componentWillUnmount() {
        window.removeEventListener("message", this.onReceiveMessage);
        if (this.popupWindow) {
            this.popupWindow.close();
            this.popupWindow = null;
        }
    }

    public attemptFailed = () => {
        this.setState({
            attemptFailed: true,
        });
    };

    private onReceiveMessage = (event: MessageEvent) => {
        if (event.data === "authDone" && event.origin === this.props.matrixClient.getHomeserverUrl()) {
            if (this.popupWindow) {
                this.popupWindow.close();
                this.popupWindow = null;
            }
        }
    };

    private onStartAuthClick = () => {
        // Note: We don't use PlatformPeg's startSsoAuth functions because we almost
        // certainly will need to open the thing in a new tab to avoid losing application
        // context.

        this.popupWindow = window.open(this.ssoUrl, "_blank");
        this.setState({phase: SSOAuthEntry.PHASE_POSTAUTH});
        this.props.onPhaseChange(SSOAuthEntry.PHASE_POSTAUTH);
    };

    private onConfirmClick = () => {
        this.props.submitAuthDict({});
    };

    render() {
        let continueButton = null;
        const cancelButton = (
            <AccessibleButton
                onClick={this.props.onCancel}
                kind={this.props.continueKind ? (this.props.continueKind + '_outline') : 'primary_outline'}
            >{_t("Cancel")}</AccessibleButton>
        );
        if (this.state.phase === SSOAuthEntry.PHASE_PREAUTH) {
            continueButton = (
                <AccessibleButton
                    onClick={this.onStartAuthClick}
                    kind={this.props.continueKind || 'primary'}
                >{this.props.continueText || _t("Single Sign On")}</AccessibleButton>
            );
        } else {
            continueButton = (
                <AccessibleButton
                    onClick={this.onConfirmClick}
                    kind={this.props.continueKind || 'primary'}
                >{this.props.continueText || _t("Confirm")}</AccessibleButton>
            );
        }

        let errorSection;
        if (this.props.errorText) {
            errorSection = (
                <div className="error" role="alert">
                    { this.props.errorText }
                </div>
            );
        } else if (this.state.attemptFailed) {
            errorSection = (
                <div className="error" role="alert">
                    { _t("Something went wrong in confirming your identity. Cancel and try again.") }
                </div>
            );
        }

        return <React.Fragment>
            { errorSection }
            <div className="mx_InteractiveAuthEntryComponents_sso_buttons">
                {cancelButton}
                {continueButton}
            </div>
        </React.Fragment>;
    }
}

@replaceableComponent("views.auth.FallbackAuthEntry")
export class FallbackAuthEntry extends React.Component<IAuthEntryProps> {
    private popupWindow: Window;
    private fallbackButton = createRef<HTMLAnchorElement>();

    constructor(props) {
        super(props);

        // we have to make the user click a button, as browsers will block
        // the popup if we open it immediately.
        this.popupWindow = null;
        window.addEventListener("message", this.onReceiveMessage);
    }

    componentDidMount() {
        this.props.onPhaseChange(DEFAULT_PHASE);
    }

    componentWillUnmount() {
        window.removeEventListener("message", this.onReceiveMessage);
        if (this.popupWindow) {
            this.popupWindow.close();
        }
    }

    public focus = () => {
        if (this.fallbackButton.current) {
            this.fallbackButton.current.focus();
        }
    };

    private onShowFallbackClick = (e: MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        const url = this.props.matrixClient.getFallbackAuthUrl(
            this.props.loginType,
            this.props.authSessionId,
        );
        this.popupWindow = window.open(url, "_blank");
    };

    private onReceiveMessage = (event: MessageEvent) => {
        if (
            event.data === "authDone" &&
            event.origin === this.props.matrixClient.getHomeserverUrl()
        ) {
            this.props.submitAuthDict({});
        }
    };

    render() {
        let errorSection;
        if (this.props.errorText) {
            errorSection = (
                <div className="error" role="alert">
                    { this.props.errorText }
                </div>
            );
        }
        return (
            <div>
                <a href="" ref={this.fallbackButton} onClick={this.onShowFallbackClick}>{
                    _t("Start authentication")
                }</a>
                {errorSection}
            </div>
        );
    }
}

export default function getEntryComponentForLoginType(loginType: AuthType): typeof React.Component {
    switch (loginType) {
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
        case AuthType.Sso:
        case AuthType.SsoUnstable:
            return SSOAuthEntry;
        default:
            return FallbackAuthEntry;
    }
}

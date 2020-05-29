/*
Copyright 2016 OpenMarket Ltd
Copyright 2017 Vector Creations Ltd
Copyright 2019, 2020 The Matrix.org Foundation C.I.C.

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

import React, {createRef} from 'react';
import createReactClass from 'create-react-class';
import PropTypes from 'prop-types';
import url from 'url';
import classnames from 'classnames';

import * as sdk from '../../../index';
import { _t } from '../../../languageHandler';
import SettingsStore from "../../../settings/SettingsStore";
import AccessibleButton from "../elements/AccessibleButton";

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

export const DEFAULT_PHASE = 0;

export const PasswordAuthEntry = createReactClass({
    displayName: 'PasswordAuthEntry',

    statics: {
        LOGIN_TYPE: "m.login.password",
    },

    propTypes: {
        matrixClient: PropTypes.object.isRequired,
        submitAuthDict: PropTypes.func.isRequired,
        errorText: PropTypes.string,
        // is the auth logic currently waiting for something to
        // happen?
        busy: PropTypes.bool,
        onPhaseChange: PropTypes.func.isRequired,
    },

    componentDidMount: function() {
        this.props.onPhaseChange(DEFAULT_PHASE);
    },

    getInitialState: function() {
        return {
            password: "",
        };
    },

    _onSubmit: function(e) {
        e.preventDefault();
        if (this.props.busy) return;

        this.props.submitAuthDict({
            type: PasswordAuthEntry.LOGIN_TYPE,
            // TODO: Remove `user` once servers support proper UIA
            // See https://github.com/vector-im/riot-web/issues/10312
            user: this.props.matrixClient.credentials.userId,
            identifier: {
                type: "m.id.user",
                user: this.props.matrixClient.credentials.userId,
            },
            password: this.state.password,
        });
    },

    _onPasswordFieldChange: function(ev) {
        // enable the submit button iff the password is non-empty
        this.setState({
            password: ev.target.value,
        });
    },

    render: function() {
        const passwordBoxClass = classnames({
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
                <form onSubmit={this._onSubmit} className="mx_InteractiveAuthEntryComponents_passwordSection">
                    <Field
                        className={passwordBoxClass}
                        type="password"
                        name="passwordField"
                        label={_t('Password')}
                        autoFocus={true}
                        value={this.state.password}
                        onChange={this._onPasswordFieldChange}
                    />
                    <div className="mx_button_row">
                        { submitButtonOrSpinner }
                    </div>
                </form>
            { errorSection }
            </div>
        );
    },
});

export const RecaptchaAuthEntry = createReactClass({
    displayName: 'RecaptchaAuthEntry',

    statics: {
        LOGIN_TYPE: "m.login.recaptcha",
    },

    propTypes: {
        submitAuthDict: PropTypes.func.isRequired,
        stageParams: PropTypes.object.isRequired,
        errorText: PropTypes.string,
        busy: PropTypes.bool,
        onPhaseChange: PropTypes.func.isRequired,
    },

    componentDidMount: function() {
        this.props.onPhaseChange(DEFAULT_PHASE);
    },

    _onCaptchaResponse: function(response) {
        this.props.submitAuthDict({
            type: RecaptchaAuthEntry.LOGIN_TYPE,
            response: response,
        });
    },

    render: function() {
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
                    onCaptchaResponse={this._onCaptchaResponse}
                />
                { errorSection }
            </div>
        );
    },
});

export const TermsAuthEntry = createReactClass({
    displayName: 'TermsAuthEntry',

    statics: {
        LOGIN_TYPE: "m.login.terms",
    },

    propTypes: {
        submitAuthDict: PropTypes.func.isRequired,
        stageParams: PropTypes.object.isRequired,
        errorText: PropTypes.string,
        busy: PropTypes.bool,
        showContinue: PropTypes.bool,
        onPhaseChange: PropTypes.func.isRequired,
    },

    componentDidMount: function() {
        this.props.onPhaseChange(DEFAULT_PHASE);
    },

    // TODO: [REACT-WARNING] Move this to constructor
    componentWillMount: function() {
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

            langPolicy.id = policyId;
            pickedPolicies.push(langPolicy);
        }

        this.setState({
            "toggledPolicies": initToggles,
            "policies": pickedPolicies,
        });
    },

    tryContinue: function() {
        this._trySubmit();
    },

    _togglePolicy: function(policyId) {
        const newToggles = {};
        for (const policy of this.state.policies) {
            let checked = this.state.toggledPolicies[policy.id];
            if (policy.id === policyId) checked = !checked;

            newToggles[policy.id] = checked;
        }
        this.setState({"toggledPolicies": newToggles});
    },

    _trySubmit: function() {
        let allChecked = true;
        for (const policy of this.state.policies) {
            const checked = this.state.toggledPolicies[policy.id];
            allChecked = allChecked && checked;
        }

        if (allChecked) this.props.submitAuthDict({type: TermsAuthEntry.LOGIN_TYPE});
        else this.setState({errorText: _t("Please review and accept all of the homeserver's policies")});
    },

    render: function() {
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
                <label key={"policy_checkbox_" + policy.id} className="mx_InteractiveAuthEntryComponents_termsPolicy">
                    <input type="checkbox" onChange={() => this._togglePolicy(policy.id)} checked={checked} />
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
                                   onClick={this._trySubmit} disabled={!allChecked}>{_t("Accept")}</button>;
        }

        return (
            <div>
                <p>{_t("Please review and accept the policies of this homeserver:")}</p>
                { checkboxes }
                { errorSection }
                { submitButton }
            </div>
        );
    },
});

export const EmailIdentityAuthEntry = createReactClass({
    displayName: 'EmailIdentityAuthEntry',

    statics: {
        LOGIN_TYPE: "m.login.email.identity",
    },

    propTypes: {
        matrixClient: PropTypes.object.isRequired,
        submitAuthDict: PropTypes.func.isRequired,
        authSessionId: PropTypes.string.isRequired,
        clientSecret: PropTypes.string.isRequired,
        inputs: PropTypes.object.isRequired,
        stageState: PropTypes.object.isRequired,
        fail: PropTypes.func.isRequired,
        setEmailSid: PropTypes.func.isRequired,
        onPhaseChange: PropTypes.func.isRequired,
    },

    componentDidMount: function() {
        this.props.onPhaseChange(DEFAULT_PHASE);
    },

    render: function() {
        // This component is now only displayed once the token has been requested,
        // so we know the email has been sent. It can also get loaded after the user
        // has clicked the validation link if the server takes a while to propagate
        // the validation internally. If we're in the session spawned from clicking
        // the validation link, we won't know the email address, so if we don't have it,
        // assume that the link has been clicked and the server will realise when we poll.
        if (this.props.inputs.emailAddress === undefined) {
            const Loader = sdk.getComponent("elements.Spinner");
            return <Loader />;
        } else {
            return (
                <div>
                    <p>{ _t("An email has been sent to %(emailAddress)s",
                        { emailAddress: (sub) => <i>{ this.props.inputs.emailAddress }</i> },
                    ) }
                    </p>
                    <p>{ _t("Please check your email to continue registration.") }</p>
                </div>
            );
        }
    },
});

export const MsisdnAuthEntry = createReactClass({
    displayName: 'MsisdnAuthEntry',

    statics: {
        LOGIN_TYPE: "m.login.msisdn",
    },

    propTypes: {
        inputs: PropTypes.shape({
            phoneCountry: PropTypes.string,
            phoneNumber: PropTypes.string,
        }),
        fail: PropTypes.func,
        clientSecret: PropTypes.func,
        submitAuthDict: PropTypes.func.isRequired,
        matrixClient: PropTypes.object,
        onPhaseChange: PropTypes.func.isRequired,
    },

    getInitialState: function() {
        return {
            token: '',
            requestingToken: false,
        };
    },

    componentDidMount: function() {
        this.props.onPhaseChange(DEFAULT_PHASE);

        this._submitUrl = null;
        this._sid = null;
        this._msisdn = null;
        this._tokenBox = null;

        this.setState({requestingToken: true});
        this._requestMsisdnToken().catch((e) => {
            this.props.fail(e);
        }).finally(() => {
            this.setState({requestingToken: false});
        });
    },

    /*
     * Requests a verification token by SMS.
     */
    _requestMsisdnToken: function() {
        return this.props.matrixClient.requestRegisterMsisdnToken(
            this.props.inputs.phoneCountry,
            this.props.inputs.phoneNumber,
            this.props.clientSecret,
            1, // TODO: Multiple send attempts?
        ).then((result) => {
            this._submitUrl = result.submit_url;
            this._sid = result.sid;
            this._msisdn = result.msisdn;
        });
    },

    _onTokenChange: function(e) {
        this.setState({
            token: e.target.value,
        });
    },

    _onFormSubmit: async function(e) {
        e.preventDefault();
        if (this.state.token == '') return;

        this.setState({
            errorText: null,
        });

        try {
            const requiresIdServerParam =
                await this.props.matrixClient.doesServerRequireIdServerParam();
            let result;
            if (this._submitUrl) {
                result = await this.props.matrixClient.submitMsisdnTokenOtherUrl(
                    this._submitUrl, this._sid, this.props.clientSecret, this.state.token,
                );
            } else if (requiresIdServerParam) {
                result = await this.props.matrixClient.submitMsisdnToken(
                    this._sid, this.props.clientSecret, this.state.token,
                );
            } else {
                throw new Error("The registration with MSISDN flow is misconfigured");
            }
            if (result.success) {
                const creds = {
                    sid: this._sid,
                    client_secret: this.props.clientSecret,
                };
                if (requiresIdServerParam) {
                    const idServerParsedUrl = url.parse(
                        this.props.matrixClient.getIdentityServerUrl(),
                    );
                    creds.id_server = idServerParsedUrl.host;
                }
                this.props.submitAuthDict({
                    type: MsisdnAuthEntry.LOGIN_TYPE,
                    // TODO: Remove `threepid_creds` once servers support proper UIA
                    // See https://github.com/vector-im/riot-web/issues/10312
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
    },

    render: function() {
        if (this.state.requestingToken) {
            const Loader = sdk.getComponent("elements.Spinner");
            return <Loader />;
        } else {
            const enableSubmit = Boolean(this.state.token);
            const submitClasses = classnames({
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
                        { msisdn: <i>{ this._msisdn }</i> },
                    ) }
                    </p>
                    <p>{ _t("Please enter the code it contains:") }</p>
                    <div className="mx_InteractiveAuthEntryComponents_msisdnWrapper">
                        <form onSubmit={this._onFormSubmit}>
                            <input type="text"
                                className="mx_InteractiveAuthEntryComponents_msisdnEntry"
                                value={this.state.token}
                                onChange={this._onTokenChange}
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
    },
});

export class SSOAuthEntry extends React.Component {
    static propTypes = {
        matrixClient: PropTypes.object.isRequired,
        authSessionId: PropTypes.string.isRequired,
        loginType: PropTypes.string.isRequired,
        submitAuthDict: PropTypes.func.isRequired,
        errorText: PropTypes.string,
        onPhaseChange: PropTypes.func.isRequired,
        continueText: PropTypes.string,
        continueKind: PropTypes.string,
        onCancel: PropTypes.func,
    };

    static LOGIN_TYPE = "m.login.sso";
    static UNSTABLE_LOGIN_TYPE = "org.matrix.login.sso";

    static PHASE_PREAUTH = 1; // button to start SSO
    static PHASE_POSTAUTH = 2; // button to confirm SSO completed

    _ssoUrl: string;

    constructor(props) {
        super(props);

        // We actually send the user through fallback auth so we don't have to
        // deal with a redirect back to us, losing application context.
        this._ssoUrl = props.matrixClient.getFallbackAuthUrl(
            this.props.loginType,
            this.props.authSessionId,
        );

        this.state = {
            phase: SSOAuthEntry.PHASE_PREAUTH,
        };
    }

    componentDidMount(): void {
        this.props.onPhaseChange(SSOAuthEntry.PHASE_PREAUTH);
    }

    onStartAuthClick = () => {
        // Note: We don't use PlatformPeg's startSsoAuth functions because we almost
        // certainly will need to open the thing in a new tab to avoid losing application
        // context.

        window.open(this._ssoUrl, '_blank');
        this.setState({phase: SSOAuthEntry.PHASE_POSTAUTH});
        this.props.onPhaseChange(SSOAuthEntry.PHASE_POSTAUTH);
    };

    onConfirmClick = () => {
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

        return <div className='mx_InteractiveAuthEntryComponents_sso_buttons'>
            {cancelButton}
            {continueButton}
        </div>;
    }
}

export const FallbackAuthEntry = createReactClass({
    displayName: 'FallbackAuthEntry',

    propTypes: {
        matrixClient: PropTypes.object.isRequired,
        authSessionId: PropTypes.string.isRequired,
        loginType: PropTypes.string.isRequired,
        submitAuthDict: PropTypes.func.isRequired,
        errorText: PropTypes.string,
        onPhaseChange: PropTypes.func.isRequired,
    },

    componentDidMount: function() {
        this.props.onPhaseChange(DEFAULT_PHASE);
    },

    // TODO: [REACT-WARNING] Replace component with real class, use constructor for refs
    UNSAFE_componentWillMount: function() {
        // we have to make the user click a button, as browsers will block
        // the popup if we open it immediately.
        this._popupWindow = null;
        window.addEventListener("message", this._onReceiveMessage);

        this._fallbackButton = createRef();
    },

    componentWillUnmount: function() {
        window.removeEventListener("message", this._onReceiveMessage);
        if (this._popupWindow) {
            this._popupWindow.close();
        }
    },

    focus: function() {
        if (this._fallbackButton.current) {
            this._fallbackButton.current.focus();
        }
    },

    _onShowFallbackClick: function(e) {
        e.preventDefault();
        e.stopPropagation();

        const url = this.props.matrixClient.getFallbackAuthUrl(
            this.props.loginType,
            this.props.authSessionId,
        );
        this._popupWindow = window.open(url);
        this._popupWindow.opener = null;
    },

    _onReceiveMessage: function(event) {
        if (
            event.data === "authDone" &&
            event.origin === this.props.matrixClient.getHomeserverUrl()
        ) {
            this.props.submitAuthDict({});
        }
    },

    render: function() {
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
                <a href="" ref={this._fallbackButton} onClick={this._onShowFallbackClick}>{ _t("Start authentication") }</a>
                {errorSection}
            </div>
        );
    },
});

const AuthEntryComponents = [
    PasswordAuthEntry,
    RecaptchaAuthEntry,
    EmailIdentityAuthEntry,
    MsisdnAuthEntry,
    TermsAuthEntry,
    SSOAuthEntry,
];

export default function getEntryComponentForLoginType(loginType) {
    for (const c of AuthEntryComponents) {
        if (c.LOGIN_TYPE === loginType || c.UNSTABLE_LOGIN_TYPE === loginType) {
            return c;
        }
    }
    return FallbackAuthEntry;
}

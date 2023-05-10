/*
Copyright 2015-2021 The Matrix.org Foundation C.I.C.

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

import { AuthType, createClient, IAuthDict, IAuthData, IInputs, MatrixError } from "matrix-js-sdk/src/matrix";
import React, { Fragment, ReactNode } from "react";
import { IRegisterRequestParams, IRequestTokenResponse, MatrixClient } from "matrix-js-sdk/src/client";
import classNames from "classnames";
import { logger } from "matrix-js-sdk/src/logger";
import { ISSOFlow, SSOAction } from "matrix-js-sdk/src/@types/auth";

import { _t } from "../../../languageHandler";
import { adminContactStrings, messageForResourceLimitError, resourceLimitStrings } from "../../../utils/ErrorUtils";
import AutoDiscoveryUtils from "../../../utils/AutoDiscoveryUtils";
import * as Lifecycle from "../../../Lifecycle";
import { IMatrixClientCreds, MatrixClientPeg } from "../../../MatrixClientPeg";
import AuthPage from "../../views/auth/AuthPage";
import Login from "../../../Login";
import dis from "../../../dispatcher/dispatcher";
import SSOButtons from "../../views/elements/SSOButtons";
import ServerPicker from "../../views/elements/ServerPicker";
import RegistrationForm from "../../views/auth/RegistrationForm";
import AccessibleButton, { ButtonEvent } from "../../views/elements/AccessibleButton";
import AuthBody from "../../views/auth/AuthBody";
import AuthHeader from "../../views/auth/AuthHeader";
import InteractiveAuth, { InteractiveAuthCallback } from "../InteractiveAuth";
import Spinner from "../../views/elements/Spinner";
import { AuthHeaderDisplay } from "./header/AuthHeaderDisplay";
import { AuthHeaderProvider } from "./header/AuthHeaderProvider";
import SettingsStore from "../../../settings/SettingsStore";
import { ValidatedServerConfig } from "../../../utils/ValidatedServerConfig";

const debuglog = (...args: any[]): void => {
    if (SettingsStore.getValue("debug_registration")) {
        logger.log.call(console, "Registration debuglog:", ...args);
    }
};

interface IProps {
    serverConfig: ValidatedServerConfig;
    defaultDeviceDisplayName?: string;
    email?: string;
    brand?: string;
    clientSecret?: string;
    sessionId?: string;
    idSid?: string;
    fragmentAfterLogin?: string;

    // Called when the user has logged in. Params:
    // - object with userId, deviceId, homeserverUrl, identityServerUrl, accessToken
    // - The user's password, if available and applicable (may be cached in memory
    //   for a short time so the user is not required to re-enter their password
    //   for operations like uploading cross-signing keys).
    onLoggedIn(params: IMatrixClientCreds, password: string): void;
    makeRegistrationUrl(params: {
        /* eslint-disable camelcase */
        client_secret: string;
        hs_url: string;
        is_url?: string;
        session_id: string;
        /* eslint-enable camelcase */
    }): string;
    // registration shouldn't know or care how login is done.
    onLoginClick(): void;
    onServerConfigChange(config: ValidatedServerConfig): void;
}

interface IState {
    // true if we're waiting for the user to complete
    busy: boolean;
    errorText?: ReactNode;
    // We remember the values entered by the user because
    // the registration form will be unmounted during the
    // course of registration, but if there's an error we
    // want to bring back the registration form with the
    // values the user entered still in it. We can keep
    // them in this component's state since this component
    // persist for the duration of the registration process.
    formVals: Record<string, string | undefined>;
    // user-interactive auth
    // If we've been given a session ID, we're resuming
    // straight back into UI auth
    doingUIAuth: boolean;
    // If set, we've registered but are not going to log
    // the user in to their new account automatically.
    completedNoSignin: boolean;
    flows:
        | {
              stages: string[];
          }[]
        | null;
    // We perform liveliness checks later, but for now suppress the errors.
    // We also track the server dead errors independently of the regular errors so
    // that we can render it differently, and override any other error the user may
    // be seeing.
    serverIsAlive: boolean;
    serverErrorIsFatal: boolean;
    serverDeadError?: ReactNode;

    // Our matrix client - part of state because we can't render the UI auth
    // component without it.
    matrixClient?: MatrixClient;
    // The user ID we've just registered
    registeredUsername?: string;
    // if a different user ID to the one we just registered is logged in,
    // this is the user ID that's logged in.
    differentLoggedInUserId?: string;
    // the SSO flow definition, this is fetched from /login as that's the only
    // place it is exposed.
    ssoFlow?: ISSOFlow;
}

export default class Registration extends React.Component<IProps, IState> {
    private readonly loginLogic: Login;
    // `replaceClient` tracks latest serverConfig to spot when it changes under the async method which fetches flows
    private latestServerConfig?: ValidatedServerConfig;

    public constructor(props: IProps) {
        super(props);

        this.state = {
            busy: false,
            errorText: null,
            formVals: {
                email: this.props.email,
            },
            doingUIAuth: Boolean(this.props.sessionId),
            flows: null,
            completedNoSignin: false,
            serverIsAlive: true,
            serverErrorIsFatal: false,
            serverDeadError: "",
        };

        const { hsUrl, isUrl } = this.props.serverConfig;
        this.loginLogic = new Login(hsUrl, isUrl, null, {
            defaultDeviceDisplayName: "Element login check", // We shouldn't ever be used
        });
    }

    public componentDidMount(): void {
        this.replaceClient(this.props.serverConfig);
        //triggers a confirmation dialog for data loss before page unloads/refreshes
        window.addEventListener("beforeunload", this.unloadCallback);
    }

    public componentWillUnmount(): void {
        window.removeEventListener("beforeunload", this.unloadCallback);
    }

    private unloadCallback = (event: BeforeUnloadEvent): string | undefined => {
        if (this.state.doingUIAuth) {
            event.preventDefault();
            event.returnValue = "";
            return "";
        }
    };

    public componentDidUpdate(prevProps: IProps): void {
        if (
            prevProps.serverConfig.hsUrl !== this.props.serverConfig.hsUrl ||
            prevProps.serverConfig.isUrl !== this.props.serverConfig.isUrl
        ) {
            this.replaceClient(this.props.serverConfig);
        }
    }

    private async replaceClient(serverConfig: ValidatedServerConfig): Promise<void> {
        this.latestServerConfig = serverConfig;
        const { hsUrl, isUrl } = serverConfig;

        this.setState({
            errorText: null,
            serverDeadError: null,
            serverErrorIsFatal: false,
            // busy while we do live-ness check (we need to avoid trying to render
            // the UI auth component while we don't have a matrix client)
            busy: true,
        });

        // Do a liveliness check on the URLs
        try {
            await AutoDiscoveryUtils.validateServerConfigWithStaticUrls(hsUrl, isUrl);
            if (serverConfig !== this.latestServerConfig) return; // discard, serverConfig changed from under us
            this.setState({
                serverIsAlive: true,
                serverErrorIsFatal: false,
            });
        } catch (e) {
            if (serverConfig !== this.latestServerConfig) return; // discard, serverConfig changed from under us
            this.setState({
                busy: false,
                ...AutoDiscoveryUtils.authComponentStateForError(e, "register"),
            });
            if (this.state.serverErrorIsFatal) {
                return; // Server is dead - do not continue.
            }
        }

        const cli = createClient({
            baseUrl: hsUrl,
            idBaseUrl: isUrl,
        });

        this.loginLogic.setHomeserverUrl(hsUrl);
        this.loginLogic.setIdentityServerUrl(isUrl);

        let ssoFlow: ISSOFlow | undefined;
        try {
            const loginFlows = await this.loginLogic.getFlows();
            if (serverConfig !== this.latestServerConfig) return; // discard, serverConfig changed from under us
            ssoFlow = loginFlows.find((f) => f.type === "m.login.sso" || f.type === "m.login.cas") as ISSOFlow;
        } catch (e) {
            if (serverConfig !== this.latestServerConfig) return; // discard, serverConfig changed from under us
            logger.error("Failed to get login flows to check for SSO support", e);
        }

        this.setState({
            matrixClient: cli,
            ssoFlow,
            busy: false,
        });

        try {
            // We do the first registration request ourselves to discover whether we need to
            // do SSO instead. If we've already started the UI Auth process though, we don't
            // need to.
            if (!this.state.doingUIAuth) {
                await this.makeRegisterRequest(null);
                if (serverConfig !== this.latestServerConfig) return; // discard, serverConfig changed from under us
                // This should never succeed since we specified no auth object.
                logger.log("Expecting 401 from register request but got success!");
            }
        } catch (e) {
            if (serverConfig !== this.latestServerConfig) return; // discard, serverConfig changed from under us
            if (e.httpStatus === 401) {
                this.setState({
                    flows: e.data.flows,
                });
            } else if (e.httpStatus === 403 || e.errcode === "M_FORBIDDEN") {
                // Check for 403 or M_FORBIDDEN, Synapse used to send 403 M_UNKNOWN but now sends 403 M_FORBIDDEN.
                // At this point registration is pretty much disabled, but before we do that let's
                // quickly check to see if the server supports SSO instead. If it does, we'll send
                // the user off to the login page to figure their account out.
                if (ssoFlow) {
                    // Redirect to login page - server probably expects SSO only
                    dis.dispatch({ action: "start_login" });
                } else {
                    this.setState({
                        serverErrorIsFatal: true, // fatal because user cannot continue on this server
                        errorText: _t("Registration has been disabled on this homeserver."),
                        // add empty flows array to get rid of spinner
                        flows: [],
                    });
                }
            } else {
                logger.log("Unable to query for supported registration methods.", e);
                this.setState({
                    errorText: _t("Unable to query for supported registration methods."),
                    // add empty flows array to get rid of spinner
                    flows: [],
                });
            }
        }
    }

    private onFormSubmit = async (formVals: Record<string, string>): Promise<void> => {
        this.setState({
            errorText: "",
            busy: true,
            formVals,
            doingUIAuth: true,
        });
    };

    private requestEmailToken = (
        emailAddress: string,
        clientSecret: string,
        sendAttempt: number,
        sessionId: string,
    ): Promise<IRequestTokenResponse> => {
        if (!this.state.matrixClient) throw new Error("Matrix client has not yet been loaded");
        return this.state.matrixClient.requestRegisterEmailToken(
            emailAddress,
            clientSecret,
            sendAttempt,
            this.props.makeRegistrationUrl({
                client_secret: clientSecret,
                hs_url: this.state.matrixClient.getHomeserverUrl(),
                is_url: this.state.matrixClient.getIdentityServerUrl(),
                session_id: sessionId,
            }),
        );
    };

    private onUIAuthFinished: InteractiveAuthCallback = async (success, response): Promise<void> => {
        if (!this.state.matrixClient) throw new Error("Matrix client has not yet been loaded");

        debuglog("Registration: ui authentication finished: ", { success, response });
        if (!success) {
            let errorText: ReactNode = (response as Error).message || (response as Error).toString();
            // can we give a better error message?
            if (response instanceof MatrixError && response.errcode === "M_RESOURCE_LIMIT_EXCEEDED") {
                const errorTop = messageForResourceLimitError(
                    response.data.limit_type,
                    response.data.admin_contact,
                    resourceLimitStrings,
                );
                const errorDetail = messageForResourceLimitError(
                    response.data.limit_type,
                    response.data.admin_contact,
                    adminContactStrings,
                );
                errorText = (
                    <div>
                        <p>{errorTop}</p>
                        <p>{errorDetail}</p>
                    </div>
                );
            } else if ((response as IAuthData).required_stages?.includes(AuthType.Msisdn)) {
                const flows = (response as IAuthData).available_flows ?? [];
                const msisdnAvailable = flows.some((flow) => flow.stages.includes(AuthType.Msisdn));
                if (!msisdnAvailable) {
                    errorText = _t("This server does not support authentication with a phone number.");
                }
            } else if (response instanceof MatrixError && response.errcode === "M_USER_IN_USE") {
                errorText = _t("Someone already has that username, please try another.");
            } else if (response instanceof MatrixError && response.errcode === "M_THREEPID_IN_USE") {
                errorText = _t("That e-mail address or phone number is already in use.");
            }

            this.setState({
                busy: false,
                doingUIAuth: false,
                errorText,
            });
            return;
        }

        const userId = (response as IAuthData).user_id;
        const accessToken = (response as IAuthData).access_token;
        if (!userId || !accessToken) throw new Error("Registration failed");

        MatrixClientPeg.setJustRegisteredUserId(userId);

        const newState: Partial<IState> = {
            doingUIAuth: false,
            registeredUsername: (response as IAuthData).user_id,
            differentLoggedInUserId: undefined,
            completedNoSignin: false,
            // we're still busy until we get unmounted: don't show the registration form again
            busy: true,
        };

        // The user came in through an email validation link. To avoid overwriting
        // their session, check to make sure the session isn't someone else, and
        // isn't a guest user since we'll usually have set a guest user session before
        // starting the registration process. This isn't perfect since it's possible
        // the user had a separate guest session they didn't actually mean to replace.
        const [sessionOwner, sessionIsGuest] = await Lifecycle.getStoredSessionOwner();
        if (sessionOwner && !sessionIsGuest && sessionOwner !== (response as IAuthData).user_id) {
            logger.log(
                `Found a session for ${sessionOwner} but ${(response as IAuthData).user_id} has just registered.`,
            );
            newState.differentLoggedInUserId = sessionOwner;
        }

        // if we don't have an email at all, only one client can be involved in this flow, and we can directly log in.
        //
        // if we've got an email, it needs to be verified. in that case, two clients can be involved in this flow, the
        // original client starting the process and the client that submitted the verification token. After the token
        // has been submitted, it can not be used again.
        //
        // we can distinguish them based on whether the client has form values saved (if so, it's the one that started
        // the registration), or whether it doesn't have any form values saved (in which case it's the client that
        // verified the email address)
        //
        // as the client that started registration may be gone by the time we've verified the email, and only the client
        // that verified the email is guaranteed to exist, we'll always do the login in that client.
        const hasEmail = Boolean(this.state.formVals.email);
        const hasAccessToken = Boolean((response as IAuthData).access_token);
        debuglog("Registration: ui auth finished:", { hasEmail, hasAccessToken });
        // don’t log in if we found a session for a different user
        if (!hasEmail && hasAccessToken && !newState.differentLoggedInUserId) {
            // we'll only try logging in if we either have no email to verify at all or we're the client that verified
            // the email, not the client that started the registration flow
            await this.props.onLoggedIn(
                {
                    userId,
                    deviceId: (response as IAuthData).device_id,
                    homeserverUrl: this.state.matrixClient.getHomeserverUrl(),
                    identityServerUrl: this.state.matrixClient.getIdentityServerUrl(),
                    accessToken,
                },
                this.state.formVals.password!,
            );

            this.setupPushers();
        } else {
            newState.busy = false;
            newState.completedNoSignin = true;
        }

        this.setState(newState as IState);
    };

    private setupPushers(): Promise<void> {
        if (!this.props.brand) {
            return Promise.resolve();
        }
        const matrixClient = MatrixClientPeg.get();
        return matrixClient.getPushers().then(
            (resp) => {
                const pushers = resp.pushers;
                for (let i = 0; i < pushers.length; ++i) {
                    if (pushers[i].kind === "email") {
                        const emailPusher = pushers[i];
                        emailPusher.data = { brand: this.props.brand };
                        matrixClient.setPusher(emailPusher).then(
                            () => {
                                logger.log("Set email branding to " + this.props.brand);
                            },
                            (error) => {
                                logger.error("Couldn't set email branding: " + error);
                            },
                        );
                    }
                }
            },
            (error) => {
                logger.error("Couldn't get pushers: " + error);
            },
        );
    }

    private onLoginClick = (ev: ButtonEvent): void => {
        ev.preventDefault();
        ev.stopPropagation();
        this.props.onLoginClick();
    };

    private onGoToFormClicked = (ev: ButtonEvent): void => {
        ev.preventDefault();
        ev.stopPropagation();
        this.replaceClient(this.props.serverConfig);
        this.setState({
            busy: false,
            doingUIAuth: false,
        });
    };

    private makeRegisterRequest = (auth: IAuthDict | null): Promise<IAuthData> => {
        if (!this.state.matrixClient) throw new Error("Matrix client has not yet been loaded");

        const registerParams: IRegisterRequestParams = {
            username: this.state.formVals.username,
            password: this.state.formVals.password,
            initial_device_display_name: this.props.defaultDeviceDisplayName,
            auth: undefined,
            // we still want to avoid the race conditions involved with multiple clients handling registration, but
            // we'll handle these after we've received the access_token in onUIAuthFinished
            inhibit_login: undefined,
        };
        if (auth) registerParams.auth = auth;
        debuglog("Registration: sending registration request:", auth);
        return this.state.matrixClient.registerRequest(registerParams);
    };

    private getUIAuthInputs(): IInputs {
        return {
            emailAddress: this.state.formVals.email,
            phoneCountry: this.state.formVals.phoneCountry,
            phoneNumber: this.state.formVals.phoneNumber,
        };
    }

    // Links to the login page shown after registration is completed are routed through this
    // which checks the user hasn't already logged in somewhere else (perhaps we should do
    // this more generally?)
    private onLoginClickWithCheck = async (ev: ButtonEvent): Promise<boolean> => {
        ev.preventDefault();

        const sessionLoaded = await Lifecycle.loadSession({ ignoreGuest: true });
        if (!sessionLoaded) {
            // ok fine, there's still no session: really go to the login page
            this.props.onLoginClick();
        }

        return sessionLoaded;
    };

    private renderRegisterComponent(): ReactNode {
        if (this.state.matrixClient && this.state.doingUIAuth) {
            return (
                <InteractiveAuth
                    matrixClient={this.state.matrixClient}
                    makeRequest={this.makeRegisterRequest}
                    onAuthFinished={this.onUIAuthFinished}
                    inputs={this.getUIAuthInputs()}
                    requestEmailToken={this.requestEmailToken}
                    sessionId={this.props.sessionId}
                    clientSecret={this.props.clientSecret}
                    emailSid={this.props.idSid}
                    poll={true}
                />
            );
        } else if (!this.state.matrixClient && !this.state.busy) {
            return null;
        } else if (this.state.busy || !this.state.flows) {
            return (
                <div className="mx_AuthBody_spinner">
                    <Spinner />
                </div>
            );
        } else if (this.state.matrixClient && this.state.flows.length) {
            let ssoSection: JSX.Element | undefined;
            if (this.state.ssoFlow) {
                let continueWithSection;
                const providers = this.state.ssoFlow.identity_providers || [];
                // when there is only a single (or 0) providers we show a wide button with `Continue with X` text
                if (providers.length > 1) {
                    // i18n: ssoButtons is a placeholder to help translators understand context
                    continueWithSection = (
                        <h2 className="mx_AuthBody_centered">
                            {_t("Continue with %(ssoButtons)s", { ssoButtons: "" }).trim()}
                        </h2>
                    );
                }

                // i18n: ssoButtons & usernamePassword are placeholders to help translators understand context
                ssoSection = (
                    <React.Fragment>
                        {continueWithSection}
                        <SSOButtons
                            matrixClient={this.loginLogic.createTemporaryClient()}
                            flow={this.state.ssoFlow}
                            loginType={this.state.ssoFlow.type === "m.login.sso" ? "sso" : "cas"}
                            fragmentAfterLogin={this.props.fragmentAfterLogin}
                            action={SSOAction.REGISTER}
                        />
                        <h2 className="mx_AuthBody_centered">
                            {_t("%(ssoButtons)s Or %(usernamePassword)s", {
                                ssoButtons: "",
                                usernamePassword: "",
                            }).trim()}
                        </h2>
                    </React.Fragment>
                );
            }

            return (
                <React.Fragment>
                    {ssoSection}
                    <RegistrationForm
                        defaultUsername={this.state.formVals.username}
                        defaultEmail={this.state.formVals.email}
                        defaultPhoneCountry={this.state.formVals.phoneCountry}
                        defaultPhoneNumber={this.state.formVals.phoneNumber}
                        defaultPassword={this.state.formVals.password}
                        onRegisterClick={this.onFormSubmit}
                        flows={this.state.flows}
                        serverConfig={this.props.serverConfig}
                        canSubmit={!this.state.serverErrorIsFatal}
                        matrixClient={this.state.matrixClient}
                    />
                </React.Fragment>
            );
        }

        return null;
    }

    public render(): React.ReactNode {
        let errorText;
        const err = this.state.errorText;
        if (err) {
            errorText = <div className="mx_Login_error">{err}</div>;
        }

        let serverDeadSection;
        if (!this.state.serverIsAlive) {
            const classes = classNames({
                mx_Login_error: true,
                mx_Login_serverError: true,
                mx_Login_serverErrorNonFatal: !this.state.serverErrorIsFatal,
            });
            serverDeadSection = <div className={classes}>{this.state.serverDeadError}</div>;
        }

        const signIn = (
            <span className="mx_AuthBody_changeFlow">
                {_t(
                    "Already have an account? <a>Sign in here</a>",
                    {},
                    {
                        a: (sub) => (
                            <AccessibleButton kind="link_inline" onClick={this.onLoginClick}>
                                {sub}
                            </AccessibleButton>
                        ),
                    },
                )}
            </span>
        );

        // Only show the 'go back' button if you're not looking at the form
        let goBack;
        if (this.state.doingUIAuth) {
            goBack = (
                <AccessibleButton kind="link" className="mx_AuthBody_changeFlow" onClick={this.onGoToFormClicked}>
                    {_t("Go back")}
                </AccessibleButton>
            );
        }

        let body;
        if (this.state.completedNoSignin) {
            let regDoneText;
            if (this.state.differentLoggedInUserId) {
                regDoneText = (
                    <div>
                        <p>
                            {_t(
                                "Your new account (%(newAccountId)s) is registered, but you're already " +
                                    "logged into a different account (%(loggedInUserId)s).",
                                {
                                    newAccountId: this.state.registeredUsername,
                                    loggedInUserId: this.state.differentLoggedInUserId,
                                },
                            )}
                        </p>
                        <p>
                            <AccessibleButton
                                kind="link_inline"
                                onClick={async (event: ButtonEvent): Promise<void> => {
                                    const sessionLoaded = await this.onLoginClickWithCheck(event);
                                    if (sessionLoaded) {
                                        dis.dispatch({ action: "view_welcome_page" });
                                    }
                                }}
                            >
                                {_t("Continue with previous account")}
                            </AccessibleButton>
                        </p>
                    </div>
                );
            } else {
                // regardless of whether we're the client that started the registration or not, we should
                // try our credentials anyway
                regDoneText = (
                    <h2>
                        {_t(
                            "<a>Log in</a> to your new account.",
                            {},
                            {
                                a: (sub) => (
                                    <AccessibleButton
                                        kind="link_inline"
                                        onClick={async (event: ButtonEvent): Promise<void> => {
                                            const sessionLoaded = await this.onLoginClickWithCheck(event);
                                            if (sessionLoaded) {
                                                dis.dispatch({ action: "view_home_page" });
                                            }
                                        }}
                                    >
                                        {sub}
                                    </AccessibleButton>
                                ),
                            },
                        )}
                    </h2>
                );
            }
            body = (
                <div>
                    <h1>{_t("Registration Successful")}</h1>
                    {regDoneText}
                </div>
            );
        } else {
            body = (
                <Fragment>
                    <div className="mx_Register_mainContent">
                        <AuthHeaderDisplay
                            title={_t("Create account")}
                            serverPicker={
                                <ServerPicker
                                    title={_t("Host account on")}
                                    dialogTitle={_t("Decide where your account is hosted")}
                                    serverConfig={this.props.serverConfig}
                                    onServerConfigChange={
                                        this.state.doingUIAuth ? undefined : this.props.onServerConfigChange
                                    }
                                />
                            }
                        >
                            {errorText}
                            {serverDeadSection}
                        </AuthHeaderDisplay>
                        {this.renderRegisterComponent()}
                    </div>
                    <div className="mx_Register_footerActions">
                        {goBack}
                        {signIn}
                    </div>
                </Fragment>
            );
        }

        return (
            <AuthPage>
                <AuthHeader />
                <AuthHeaderProvider>
                    <AuthBody flex>{body}</AuthBody>
                </AuthHeaderProvider>
            </AuthPage>
        );
    }
}

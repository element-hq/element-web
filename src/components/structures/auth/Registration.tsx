/*
Copyright 2015, 2016, 2017, 2018, 2019, 2020 The Matrix.org Foundation C.I.C.

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

import Matrix from 'matrix-js-sdk';
import React, {ComponentProps, ReactNode} from 'react';
import {MatrixClient} from "matrix-js-sdk/src/client";

import * as sdk from '../../../index';
import { _t, _td } from '../../../languageHandler';
import SdkConfig from '../../../SdkConfig';
import { messageForResourceLimitError } from '../../../utils/ErrorUtils';
import * as ServerType from '../../views/auth/ServerTypeSelector';
import AutoDiscoveryUtils, {ValidatedServerConfig} from "../../../utils/AutoDiscoveryUtils";
import classNames from "classnames";
import * as Lifecycle from '../../../Lifecycle';
import {MatrixClientPeg} from "../../../MatrixClientPeg";
import AuthPage from "../../views/auth/AuthPage";
import Login from "../../../Login";
import dis from "../../../dispatcher/dispatcher";

// Phases
enum Phase {
    // Show controls to configure server details
    ServerDetails = 0,
    // Show the appropriate registration flow(s) for the server
    Registration = 1,
}

interface IProps {
    serverConfig: ValidatedServerConfig;
    defaultDeviceDisplayName: string;
    email?: string;
    brand?: string;
    clientSecret?: string;
    sessionId?: string;
    idSid?: string;

    // Called when the user has logged in. Params:
    // - object with userId, deviceId, homeserverUrl, identityServerUrl, accessToken
    // - The user's password, if available and applicable (may be cached in memory
    //   for a short time so the user is not required to re-enter their password
    //   for operations like uploading cross-signing keys).
    onLoggedIn(params: {
        userId: string;
        deviceId: string
        homeserverUrl: string;
        identityServerUrl?: string;
        accessToken: string;
    }, password: string): void;
    makeRegistrationUrl(params: {
        /* eslint-disable camelcase */
        client_secret: string;
        hs_url: string;
        is_url?: string;
        session_id: string;
        /* eslint-enable camelcase */
    }): void;
    // registration shouldn't know or care how login is done.
    onLoginClick(): void;
    onServerConfigChange(config: ValidatedServerConfig): void;
}

interface IState {
    busy: boolean;
    errorText?: ReactNode;
    // true if we're waiting for the user to complete
    // We remember the values entered by the user because
    // the registration form will be unmounted during the
    // course of registration, but if there's an error we
    // want to bring back the registration form with the
    // values the user entered still in it. We can keep
    // them in this component's state since this component
    // persist for the duration of the registration process.
    formVals: Record<string, string>;
    // user-interactive auth
    // If we've been given a session ID, we're resuming
    // straight back into UI auth
    doingUIAuth: boolean;
    // If set, we've registered but are not going to log
    // the user in to their new account automatically.
    completedNoSignin: boolean;
    serverType: ServerType.FREE | ServerType.PREMIUM | ServerType.ADVANCED;
    // Phase of the overall registration dialog.
    phase: Phase;
    flows: {
        stages: string[];
    }[];
    // We perform liveliness checks later, but for now suppress the errors.
    // We also track the server dead errors independently of the regular errors so
    // that we can render it differently, and override any other error the user may
    // be seeing.
    serverIsAlive: boolean;
    serverErrorIsFatal: boolean;
    serverDeadError: string;

    // Our matrix client - part of state because we can't render the UI auth
    // component without it.
    matrixClient?: MatrixClient;
    // whether the HS requires an ID server to register with a threepid
    serverRequiresIdServer?: boolean;
    // The user ID we've just registered
    registeredUsername?: string;
    // if a different user ID to the one we just registered is logged in,
    // this is the user ID that's logged in.
    differentLoggedInUserId?: string;
}

// Enable phases for registration
const PHASES_ENABLED = true;

export default class Registration extends React.Component<IProps, IState> {
    constructor(props) {
        super(props);

        const serverType = ServerType.getTypeFromServerConfig(this.props.serverConfig);
        this.state = {
            busy: false,
            errorText: null,
            formVals: {
                email: this.props.email,
            },
            doingUIAuth: Boolean(this.props.sessionId),
            serverType,
            phase: Phase.Registration,
            flows: null,
            completedNoSignin: false,
            serverIsAlive: true,
            serverErrorIsFatal: false,
            serverDeadError: "",
        };
    }

    componentDidMount() {
        this.replaceClient(this.props.serverConfig);
    }

    // TODO: [REACT-WARNING] Replace with appropriate lifecycle event
    // eslint-disable-next-line camelcase
    UNSAFE_componentWillReceiveProps(newProps) {
        if (newProps.serverConfig.hsUrl === this.props.serverConfig.hsUrl &&
            newProps.serverConfig.isUrl === this.props.serverConfig.isUrl) return;

        this.replaceClient(newProps.serverConfig);

        // Handle cases where the user enters "https://matrix.org" for their server
        // from the advanced option - we should default to FREE at that point.
        const serverType = ServerType.getTypeFromServerConfig(newProps.serverConfig);
        if (serverType !== this.state.serverType) {
            // Reset the phase to default phase for the server type.
            this.setState({
                serverType,
                phase: Registration.getDefaultPhaseForServerType(serverType),
            });
        }
    }

    private static getDefaultPhaseForServerType(type: IState["serverType"]) {
        switch (type) {
            case ServerType.FREE: {
                // Move directly to the registration phase since the server
                // details are fixed.
                return Phase.Registration;
            }
            case ServerType.PREMIUM:
            case ServerType.ADVANCED:
                return Phase.ServerDetails;
        }
    }

    private onServerTypeChange = (type: IState["serverType"]) => {
        this.setState({
            serverType: type,
        });

        // When changing server types, set the HS / IS URLs to reasonable defaults for the
        // the new type.
        switch (type) {
            case ServerType.FREE: {
                const { serverConfig } = ServerType.TYPES.FREE;
                this.props.onServerConfigChange(serverConfig);
                break;
            }
            case ServerType.PREMIUM:
                // We can accept whatever server config was the default here as this essentially
                // acts as a slightly different "custom server"/ADVANCED option.
                break;
            case ServerType.ADVANCED:
                // Use the default config from the config
                this.props.onServerConfigChange(SdkConfig.get()["validated_server_config"]);
                break;
        }

        // Reset the phase to default phase for the server type.
        this.setState({
            phase: Registration.getDefaultPhaseForServerType(type),
        });
    };

    private async replaceClient(serverConfig: ValidatedServerConfig) {
        this.setState({
            errorText: null,
            serverDeadError: null,
            serverErrorIsFatal: false,
            // busy while we do liveness check (we need to avoid trying to render
            // the UI auth component while we don't have a matrix client)
            busy: true,
        });

        // Do a liveliness check on the URLs
        try {
            await AutoDiscoveryUtils.validateServerConfigWithStaticUrls(
                serverConfig.hsUrl,
                serverConfig.isUrl,
            );
            this.setState({
                serverIsAlive: true,
                serverErrorIsFatal: false,
            });
        } catch (e) {
            this.setState({
                busy: false,
                ...AutoDiscoveryUtils.authComponentStateForError(e, "register"),
            });
            if (this.state.serverErrorIsFatal) {
                return; // Server is dead - do not continue.
            }
        }

        const {hsUrl, isUrl} = serverConfig;
        const cli = Matrix.createClient({
            baseUrl: hsUrl,
            idBaseUrl: isUrl,
        });

        let serverRequiresIdServer = true;
        try {
            serverRequiresIdServer = await cli.doesServerRequireIdServerParam();
        } catch (e) {
            console.log("Unable to determine is server needs id_server param", e);
        }

        this.setState({
            matrixClient: cli,
            serverRequiresIdServer,
            busy: false,
        });
        const showGenericError = (e) => {
            this.setState({
                errorText: _t("Unable to query for supported registration methods."),
                // add empty flows array to get rid of spinner
                flows: [],
            });
        };
        try {
            // We do the first registration request ourselves to discover whether we need to
            // do SSO instead. If we've already started the UI Auth process though, we don't
            // need to.
            if (!this.state.doingUIAuth) {
                await this.makeRegisterRequest(null);
                // This should never succeed since we specified no auth object.
                console.log("Expecting 401 from register request but got success!");
            }
        } catch (e) {
            if (e.httpStatus === 401) {
                this.setState({
                    flows: e.data.flows,
                });
            } else if (e.httpStatus === 403 && e.errcode === "M_UNKNOWN") {
                // At this point registration is pretty much disabled, but before we do that let's
                // quickly check to see if the server supports SSO instead. If it does, we'll send
                // the user off to the login page to figure their account out.
                try {
                    const loginLogic = new Login(hsUrl, isUrl, null, {
                        defaultDeviceDisplayName: "Element login check", // We shouldn't ever be used
                    });
                    const flows = await loginLogic.getFlows();
                    const hasSsoFlow = flows.find(f => f.type === 'm.login.sso' || f.type === 'm.login.cas');
                    if (hasSsoFlow) {
                        // Redirect to login page - server probably expects SSO only
                        dis.dispatch({action: 'start_login'});
                    } else {
                        this.setState({
                            serverErrorIsFatal: true, // fatal because user cannot continue on this server
                            errorText: _t("Registration has been disabled on this homeserver."),
                            // add empty flows array to get rid of spinner
                            flows: [],
                        });
                    }
                } catch (e) {
                    console.error("Failed to get login flows to check for SSO support", e);
                    showGenericError(e);
                }
            } else {
                console.log("Unable to query for supported registration methods.", e);
                showGenericError(e);
            }
        }
    }

    private onFormSubmit = formVals => {
        this.setState({
            errorText: "",
            busy: true,
            formVals: formVals,
            doingUIAuth: true,
        });
    };

    private requestEmailToken = (emailAddress, clientSecret, sendAttempt, sessionId) => {
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
    }

    private onUIAuthFinished = async (success, response, extra) => {
        if (!success) {
            let msg = response.message || response.toString();
            // can we give a better error message?
            if (response.errcode === 'M_RESOURCE_LIMIT_EXCEEDED') {
                const errorTop = messageForResourceLimitError(
                    response.data.limit_type,
                    response.data.admin_contact,
                    {
                        'monthly_active_user': _td("This homeserver has hit its Monthly Active User limit."),
                        '': _td("This homeserver has exceeded one of its resource limits."),
                    },
                );
                const errorDetail = messageForResourceLimitError(
                    response.data.limit_type,
                    response.data.admin_contact,
                    {
                        '': _td("Please <a>contact your service administrator</a> to continue using this service."),
                    },
                );
                msg = <div>
                    <p>{errorTop}</p>
                    <p>{errorDetail}</p>
                </div>;
            } else if (response.required_stages && response.required_stages.indexOf('m.login.msisdn') > -1) {
                let msisdnAvailable = false;
                for (const flow of response.available_flows) {
                    msisdnAvailable = msisdnAvailable || flow.stages.includes('m.login.msisdn');
                }
                if (!msisdnAvailable) {
                    msg = _t('This server does not support authentication with a phone number.');
                }
            }
            this.setState({
                busy: false,
                doingUIAuth: false,
                errorText: msg,
            });
            return;
        }

        MatrixClientPeg.setJustRegisteredUserId(response.user_id);

        const newState = {
            doingUIAuth: false,
            registeredUsername: response.user_id,
            differentLoggedInUserId: null,
            completedNoSignin: false,
            // we're still busy until we get unmounted: don't show the registration form again
            busy: true,
        };

        // The user came in through an email validation link. To avoid overwriting
        // their session, check to make sure the session isn't someone else, and
        // isn't a guest user since we'll usually have set a guest user session before
        // starting the registration process. This isn't perfect since it's possible
        // the user had a separate guest session they didn't actually mean to replace.
        const sessionOwner = Lifecycle.getStoredSessionOwner();
        const sessionIsGuest = Lifecycle.getStoredSessionIsGuest();
        if (sessionOwner && !sessionIsGuest && sessionOwner !== response.userId) {
            console.log(
                `Found a session for ${sessionOwner} but ${response.userId} has just registered.`,
            );
            newState.differentLoggedInUserId = sessionOwner;
        }

        if (response.access_token) {
            await this.props.onLoggedIn({
                userId: response.user_id,
                deviceId: response.device_id,
                homeserverUrl: this.state.matrixClient.getHomeserverUrl(),
                identityServerUrl: this.state.matrixClient.getIdentityServerUrl(),
                accessToken: response.access_token,
            }, this.state.formVals.password);

            this.setupPushers();
        } else {
            newState.busy = false;
            newState.completedNoSignin = true;
        }

        this.setState(newState);
    };

    private setupPushers() {
        if (!this.props.brand) {
            return Promise.resolve();
        }
        const matrixClient = MatrixClientPeg.get();
        return matrixClient.getPushers().then((resp)=>{
            const pushers = resp.pushers;
            for (let i = 0; i < pushers.length; ++i) {
                if (pushers[i].kind === 'email') {
                    const emailPusher = pushers[i];
                    emailPusher.data = { brand: this.props.brand };
                    matrixClient.setPusher(emailPusher).then(() => {
                        console.log("Set email branding to " + this.props.brand);
                    }, (error) => {
                        console.error("Couldn't set email branding: " + error);
                    });
                }
            }
        }, (error) => {
            console.error("Couldn't get pushers: " + error);
        });
    }

    private onLoginClick = ev => {
        ev.preventDefault();
        ev.stopPropagation();
        this.props.onLoginClick();
    };

    private onGoToFormClicked = ev => {
        ev.preventDefault();
        ev.stopPropagation();
        this.replaceClient(this.props.serverConfig);
        this.setState({
            busy: false,
            doingUIAuth: false,
            phase: Phase.Registration,
        });
    };

    private onServerDetailsNextPhaseClick = async () => {
        this.setState({
            phase: Phase.Registration,
        });
    };

    private onEditServerDetailsClick = ev => {
        ev.preventDefault();
        ev.stopPropagation();
        this.setState({
            phase: Phase.ServerDetails,
        });
    };

    private makeRegisterRequest = auth => {
        // We inhibit login if we're trying to register with an email address: this
        // avoids a lot of complex race conditions that can occur if we try to log
        // the user in one one or both of the tabs they might end up with after
        // clicking the email link.
        let inhibitLogin = Boolean(this.state.formVals.email);

        // Only send inhibitLogin if we're sending username / pw params
        // (Since we need to send no params at all to use the ones saved in the
        // session).
        if (!this.state.formVals.password) inhibitLogin = null;

        const registerParams = {
            username: this.state.formVals.username,
            password: this.state.formVals.password,
            initial_device_display_name: this.props.defaultDeviceDisplayName,
            auth: undefined,
            inhibit_login: undefined,
        };
        if (auth) registerParams.auth = auth;
        if (inhibitLogin !== undefined && inhibitLogin !== null) registerParams.inhibit_login = inhibitLogin;
        return this.state.matrixClient.registerRequest(registerParams);
    };

    private getUIAuthInputs() {
        return {
            emailAddress: this.state.formVals.email,
            phoneCountry: this.state.formVals.phoneCountry,
            phoneNumber: this.state.formVals.phoneNumber,
        };
    }

    // Links to the login page shown after registration is completed are routed through this
    // which checks the user hasn't already logged in somewhere else (perhaps we should do
    // this more generally?)
    private onLoginClickWithCheck = async ev => {
        ev.preventDefault();

        const sessionLoaded = await Lifecycle.loadSession({ignoreGuest: true});
        if (!sessionLoaded) {
            // ok fine, there's still no session: really go to the login page
            this.props.onLoginClick();
        }
    };

    private renderServerComponent() {
        const ServerTypeSelector = sdk.getComponent("auth.ServerTypeSelector");
        const ServerConfig = sdk.getComponent("auth.ServerConfig");
        const ModularServerConfig = sdk.getComponent("auth.ModularServerConfig");

        if (SdkConfig.get()['disable_custom_urls']) {
            return null;
        }

        // Hide the server picker once the user is doing UI Auth unless encountered a fatal server error
        if (this.state.phase !== Phase.ServerDetails && this.state.doingUIAuth && !this.state.serverErrorIsFatal) {
            return null;
        }

        // If we're on a different phase, we only show the server type selector,
        // which is always shown if we allow custom URLs at all.
        // (if there's a fatal server error, we need to show the full server
        // config as the user may need to change servers to resolve the error).
        if (PHASES_ENABLED && this.state.phase !== Phase.ServerDetails && !this.state.serverErrorIsFatal) {
            return <div>
                <ServerTypeSelector
                    selected={this.state.serverType}
                    onChange={this.onServerTypeChange}
                />
            </div>;
        }

        const serverDetailsProps: ComponentProps<typeof ServerConfig> = {};
        if (PHASES_ENABLED) {
            serverDetailsProps.onAfterSubmit = this.onServerDetailsNextPhaseClick;
            serverDetailsProps.submitText = _t("Next");
            serverDetailsProps.submitClass = "mx_Login_submit";
        }

        let serverDetails = null;
        switch (this.state.serverType) {
            case ServerType.FREE:
                break;
            case ServerType.PREMIUM:
                serverDetails = <ModularServerConfig
                    serverConfig={this.props.serverConfig}
                    onServerConfigChange={this.props.onServerConfigChange}
                    delayTimeMs={250}
                    {...serverDetailsProps}
                />;
                break;
            case ServerType.ADVANCED:
                serverDetails = <ServerConfig
                    serverConfig={this.props.serverConfig}
                    onServerConfigChange={this.props.onServerConfigChange}
                    delayTimeMs={250}
                    showIdentityServerIfRequiredByHomeserver={true}
                    {...serverDetailsProps}
                />;
                break;
        }

        return <div>
            <ServerTypeSelector
                selected={this.state.serverType}
                onChange={this.onServerTypeChange}
            />
            {serverDetails}
        </div>;
    }

    private renderRegisterComponent() {
        if (PHASES_ENABLED && this.state.phase !== Phase.Registration) {
            return null;
        }

        const InteractiveAuth = sdk.getComponent('structures.InteractiveAuth');
        const Spinner = sdk.getComponent('elements.Spinner');
        const RegistrationForm = sdk.getComponent('auth.RegistrationForm');

        if (this.state.matrixClient && this.state.doingUIAuth) {
            return <InteractiveAuth
                matrixClient={this.state.matrixClient}
                makeRequest={this.makeRegisterRequest}
                onAuthFinished={this.onUIAuthFinished}
                inputs={this.getUIAuthInputs()}
                requestEmailToken={this.requestEmailToken}
                sessionId={this.props.sessionId}
                clientSecret={this.props.clientSecret}
                emailSid={this.props.idSid}
                poll={true}
            />;
        } else if (!this.state.matrixClient && !this.state.busy) {
            return null;
        } else if (this.state.busy || !this.state.flows) {
            return <div className="mx_AuthBody_spinner">
                <Spinner />
            </div>;
        } else if (this.state.flows.length) {
            return <RegistrationForm
                defaultUsername={this.state.formVals.username}
                defaultEmail={this.state.formVals.email}
                defaultPhoneCountry={this.state.formVals.phoneCountry}
                defaultPhoneNumber={this.state.formVals.phoneNumber}
                defaultPassword={this.state.formVals.password}
                onRegisterClick={this.onFormSubmit}
                flows={this.state.flows}
                serverConfig={this.props.serverConfig}
                canSubmit={!this.state.serverErrorIsFatal}
                serverRequiresIdServer={this.state.serverRequiresIdServer}
            />;
        }
    }

    render() {
        const AuthHeader = sdk.getComponent('auth.AuthHeader');
        const AuthBody = sdk.getComponent("auth.AuthBody");
        const AccessibleButton = sdk.getComponent('elements.AccessibleButton');

        let errorText;
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
                    {this.state.serverDeadError}
                </div>
            );
        }

        const signIn = <a className="mx_AuthBody_changeFlow" onClick={this.onLoginClick} href="#">
            { _t('Sign in instead') }
        </a>;

        // Only show the 'go back' button if you're not looking at the form
        let goBack;
        if ((PHASES_ENABLED && this.state.phase !== Phase.Registration) || this.state.doingUIAuth) {
            goBack = <a className="mx_AuthBody_changeFlow" onClick={this.onGoToFormClicked} href="#">
                { _t('Go back') }
            </a>;
        }

        let body;
        if (this.state.completedNoSignin) {
            let regDoneText;
            if (this.state.differentLoggedInUserId) {
                regDoneText = <div>
                    <p>{_t(
                        "Your new account (%(newAccountId)s) is registered, but you're already " +
                        "logged into a different account (%(loggedInUserId)s).", {
                            newAccountId: this.state.registeredUsername,
                            loggedInUserId: this.state.differentLoggedInUserId,
                        },
                    )}</p>
                    <p><AccessibleButton element="span" className="mx_linkButton" onClick={this.onLoginClickWithCheck}>
                        {_t("Continue with previous account")}
                    </AccessibleButton></p>
                </div>;
            } else if (this.state.formVals.password) {
                // We're the client that started the registration
                regDoneText = <h3>{_t(
                    "<a>Log in</a> to your new account.", {},
                    {
                        a: (sub) => <a href="#/login" onClick={this.onLoginClickWithCheck}>{sub}</a>,
                    },
                )}</h3>;
            } else {
                // We're not the original client: the user probably got to us by clicking the
                // email validation link. We can't offer a 'go straight to your account' link
                // as we don't have the original creds.
                regDoneText = <h3>{_t(
                    "You can now close this window or <a>log in</a> to your new account.", {},
                    {
                        a: (sub) => <a href="#/login" onClick={this.onLoginClickWithCheck}>{sub}</a>,
                    },
                )}</h3>;
            }
            body = <div>
                <h2>{_t("Registration Successful")}</h2>
                { regDoneText }
            </div>;
        } else {
            let yourMatrixAccountText: ReactNode = _t('Create your Matrix account on %(serverName)s', {
                serverName: this.props.serverConfig.hsName,
            });
            if (this.props.serverConfig.hsNameIsDifferent) {
                const TextWithTooltip = sdk.getComponent("elements.TextWithTooltip");

                yourMatrixAccountText = _t('Create your Matrix account on <underlinedServerName />', {}, {
                    'underlinedServerName': () => {
                        return <TextWithTooltip
                            class="mx_Login_underlinedServerName"
                            tooltip={this.props.serverConfig.hsUrl}
                        >
                            {this.props.serverConfig.hsName}
                        </TextWithTooltip>;
                    },
                });
            }

            // If custom URLs are allowed, user is not doing UIA flows and they haven't selected the Free server type,
            // wire up the server details edit link.
            let editLink = null;
            if (PHASES_ENABLED &&
                !SdkConfig.get()['disable_custom_urls'] &&
                this.state.serverType !== ServerType.FREE &&
                !this.state.doingUIAuth
            ) {
                editLink = (
                    <a className="mx_AuthBody_editServerDetails" href="#" onClick={this.onEditServerDetailsClick}>
                        {_t('Change')}
                    </a>
                );
            }

            body = <div>
                <h2>{ _t('Create your account') }</h2>
                { errorText }
                { serverDeadSection }
                { this.renderServerComponent() }
                { this.state.phase !== Phase.ServerDetails && <h3>
                    {yourMatrixAccountText}
                    {editLink}
                </h3> }
                { this.renderRegisterComponent() }
                { goBack }
                { signIn }
            </div>;
        }

        return (
            <AuthPage>
                <AuthHeader />
                <AuthBody>
                    { body }
                </AuthBody>
            </AuthPage>
        );
    }
}

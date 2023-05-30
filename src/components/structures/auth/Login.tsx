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

import React, { ReactNode } from "react";
import classNames from "classnames";
import { logger } from "matrix-js-sdk/src/logger";
import { ISSOFlow, LoginFlow, SSOAction } from "matrix-js-sdk/src/@types/auth";

import { _t, _td, UserFriendlyError } from "../../../languageHandler";
import Login from "../../../Login";
import { messageForConnectionError, messageForLoginError } from "../../../utils/ErrorUtils";
import AutoDiscoveryUtils from "../../../utils/AutoDiscoveryUtils";
import AuthPage from "../../views/auth/AuthPage";
import PlatformPeg from "../../../PlatformPeg";
import SettingsStore from "../../../settings/SettingsStore";
import { UIFeature } from "../../../settings/UIFeature";
import { IMatrixClientCreds } from "../../../MatrixClientPeg";
import PasswordLogin from "../../views/auth/PasswordLogin";
import InlineSpinner from "../../views/elements/InlineSpinner";
import Spinner from "../../views/elements/Spinner";
import SSOButtons from "../../views/elements/SSOButtons";
import ServerPicker from "../../views/elements/ServerPicker";
import AuthBody from "../../views/auth/AuthBody";
import AuthHeader from "../../views/auth/AuthHeader";
import AccessibleButton, { ButtonEvent } from "../../views/elements/AccessibleButton";
import { ValidatedServerConfig } from "../../../utils/ValidatedServerConfig";
import { filterBoolean } from "../../../utils/arrays";

// These are used in several places, and come from the js-sdk's autodiscovery
// stuff. We define them here so that they'll be picked up by i18n.
_td("Invalid homeserver discovery response");
_td("Failed to get autodiscovery configuration from server");
_td("Invalid base_url for m.homeserver");
_td("Homeserver URL does not appear to be a valid Matrix homeserver");
_td("Invalid identity server discovery response");
_td("Invalid base_url for m.identity_server");
_td("Identity server URL does not appear to be a valid identity server");
_td("General failure");

interface IProps {
    serverConfig: ValidatedServerConfig;
    // If true, the component will consider itself busy.
    busy?: boolean;
    isSyncing?: boolean;
    // Secondary HS which we try to log into if the user is using
    // the default HS but login fails. Useful for migrating to a
    // different homeserver without confusing users.
    fallbackHsUrl?: string;
    defaultDeviceDisplayName?: string;
    fragmentAfterLogin?: string;
    defaultUsername?: string;

    // Called when the user has logged in. Params:
    // - The object returned by the login API
    // - The user's password, if applicable, (may be cached in memory for a
    //   short time so the user is not required to re-enter their password
    //   for operations like uploading cross-signing keys).
    onLoggedIn(data: IMatrixClientCreds, password: string): void;

    // login shouldn't know or care how registration, password recovery, etc is done.
    onRegisterClick(): void;
    onForgotPasswordClick?(): void;
    onServerConfigChange(config: ValidatedServerConfig): void;
}

interface IState {
    busy: boolean;
    busyLoggingIn?: boolean;
    errorText?: ReactNode;
    loginIncorrect: boolean;
    // can we attempt to log in or are there validation errors?
    canTryLogin: boolean;

    flows?: LoginFlow[];

    // used for preserving form values when changing homeserver
    username: string;
    phoneCountry: string;
    phoneNumber: string;

    // We perform liveliness checks later, but for now suppress the errors.
    // We also track the server dead errors independently of the regular errors so
    // that we can render it differently, and override any other error the user may
    // be seeing.
    serverIsAlive: boolean;
    serverErrorIsFatal: boolean;
    serverDeadError?: ReactNode;
}

type OnPasswordLogin = {
    (username: string, phoneCountry: undefined, phoneNumber: undefined, password: string): Promise<void>;
    (username: undefined, phoneCountry: string, phoneNumber: string, password: string): Promise<void>;
};

/*
 * A wire component which glues together login UI components and Login logic
 */
export default class LoginComponent extends React.PureComponent<IProps, IState> {
    private unmounted = false;
    private loginLogic!: Login;

    private readonly stepRendererMap: Record<string, () => ReactNode>;

    public constructor(props: IProps) {
        super(props);

        this.state = {
            busy: false,
            errorText: null,
            loginIncorrect: false,
            canTryLogin: true,

            username: props.defaultUsername ? props.defaultUsername : "",
            phoneCountry: "",
            phoneNumber: "",

            serverIsAlive: true,
            serverErrorIsFatal: false,
            serverDeadError: "",
        };

        // map from login step type to a function which will render a control
        // letting you do that login type
        this.stepRendererMap = {
            "m.login.password": this.renderPasswordStep,

            // CAS and SSO are the same thing, modulo the url we link to
            // eslint-disable-next-line @typescript-eslint/naming-convention
            "m.login.cas": () => this.renderSsoStep("cas"),
            // eslint-disable-next-line @typescript-eslint/naming-convention
            "m.login.sso": () => this.renderSsoStep("sso"),
        };
    }

    public componentDidMount(): void {
        this.initLoginLogic(this.props.serverConfig);
    }

    public componentWillUnmount(): void {
        this.unmounted = true;
    }

    public componentDidUpdate(prevProps: IProps): void {
        if (
            prevProps.serverConfig.hsUrl !== this.props.serverConfig.hsUrl ||
            prevProps.serverConfig.isUrl !== this.props.serverConfig.isUrl
        ) {
            // Ensure that we end up actually logging in to the right place
            this.initLoginLogic(this.props.serverConfig);
        }
    }

    public isBusy = (): boolean => !!this.state.busy || !!this.props.busy;

    public onPasswordLogin: OnPasswordLogin = async (
        username: string | undefined,
        phoneCountry: string | undefined,
        phoneNumber: string | undefined,
        password: string,
    ): Promise<void> => {
        if (!this.state.serverIsAlive) {
            this.setState({ busy: true });
            // Do a quick liveliness check on the URLs
            let aliveAgain = true;
            try {
                await AutoDiscoveryUtils.validateServerConfigWithStaticUrls(
                    this.props.serverConfig.hsUrl,
                    this.props.serverConfig.isUrl,
                );
                this.setState({ serverIsAlive: true, errorText: "" });
            } catch (e) {
                const componentState = AutoDiscoveryUtils.authComponentStateForError(e);
                this.setState({
                    busy: false,
                    busyLoggingIn: false,
                    ...componentState,
                });
                aliveAgain = !componentState.serverErrorIsFatal;
            }

            // Prevent people from submitting their password when something isn't right.
            if (!aliveAgain) {
                return;
            }
        }

        this.setState({
            busy: true,
            busyLoggingIn: true,
            errorText: null,
            loginIncorrect: false,
        });

        this.loginLogic.loginViaPassword(username, phoneCountry, phoneNumber, password).then(
            (data) => {
                this.setState({ serverIsAlive: true }); // it must be, we logged in.
                this.props.onLoggedIn(data, password);
            },
            (error) => {
                if (this.unmounted) return;

                let errorText: ReactNode;
                // Some error strings only apply for logging in
                if (error.httpStatus === 400 && username && username.indexOf("@") > 0) {
                    errorText = _t("This homeserver does not support login using email address.");
                } else {
                    errorText = messageForLoginError(error, this.props.serverConfig);
                }

                this.setState({
                    busy: false,
                    busyLoggingIn: false,
                    errorText,
                    // 401 would be the sensible status code for 'incorrect password'
                    // but the login API gives a 403 https://matrix.org/jira/browse/SYN-744
                    // mentions this (although the bug is for UI auth which is not this)
                    // We treat both as an incorrect password
                    loginIncorrect: error.httpStatus === 401 || error.httpStatus === 403,
                });
            },
        );
    };

    public onUsernameChanged = (username: string): void => {
        this.setState({ username });
    };

    public onUsernameBlur = async (username: string): Promise<void> => {
        const doWellknownLookup = username[0] === "@";
        this.setState({
            username: username,
            busy: doWellknownLookup,
            errorText: null,
            canTryLogin: true,
        });
        if (doWellknownLookup) {
            const serverName = username.split(":").slice(1).join(":");
            try {
                const result = await AutoDiscoveryUtils.validateServerName(serverName);
                this.props.onServerConfigChange(result);
                // We'd like to rely on new props coming in via `onServerConfigChange`
                // so that we know the servers have definitely updated before clearing
                // the busy state. In the case of a full MXID that resolves to the same
                // HS as Element's default HS though, there may not be any server change.
                // To avoid this trap, we clear busy here. For cases where the server
                // actually has changed, `initLoginLogic` will be called and manages
                // busy state for its own liveness check.
                this.setState({
                    busy: false,
                });
            } catch (e) {
                logger.error("Problem parsing URL or unhandled error doing .well-known discovery:", e);

                let message = _t("Failed to perform homeserver discovery");
                if (e instanceof UserFriendlyError && e.translatedMessage) {
                    message = e.translatedMessage;
                }

                let errorText: ReactNode = message;
                let discoveryState = {};
                if (AutoDiscoveryUtils.isLivelinessError(e)) {
                    errorText = this.state.errorText;
                    discoveryState = AutoDiscoveryUtils.authComponentStateForError(e);
                }

                this.setState({
                    busy: false,
                    errorText,
                    ...discoveryState,
                });
            }
        }
    };

    public onPhoneCountryChanged = (phoneCountry: string): void => {
        this.setState({ phoneCountry });
    };

    public onPhoneNumberChanged = (phoneNumber: string): void => {
        this.setState({ phoneNumber });
    };

    public onRegisterClick = (ev: ButtonEvent): void => {
        ev.preventDefault();
        ev.stopPropagation();
        this.props.onRegisterClick();
    };

    public onTryRegisterClick = (ev: ButtonEvent): void => {
        const hasPasswordFlow = this.state.flows?.find((flow) => flow.type === "m.login.password");
        const ssoFlow = this.state.flows?.find((flow) => flow.type === "m.login.sso" || flow.type === "m.login.cas");
        // If has no password flow but an SSO flow guess that the user wants to register with SSO.
        // TODO: instead hide the Register button if registration is disabled by checking with the server,
        // has no specific errCode currently and uses M_FORBIDDEN.
        if (ssoFlow && !hasPasswordFlow) {
            ev.preventDefault();
            ev.stopPropagation();
            const ssoKind = ssoFlow.type === "m.login.sso" ? "sso" : "cas";
            PlatformPeg.get()?.startSingleSignOn(
                this.loginLogic.createTemporaryClient(),
                ssoKind,
                this.props.fragmentAfterLogin,
                undefined,
                SSOAction.REGISTER,
            );
        } else {
            // Don't intercept - just go through to the register page
            this.onRegisterClick(ev);
        }
    };

    private async initLoginLogic({ hsUrl, isUrl }: ValidatedServerConfig): Promise<void> {
        let isDefaultServer = false;
        if (
            this.props.serverConfig.isDefault &&
            hsUrl === this.props.serverConfig.hsUrl &&
            isUrl === this.props.serverConfig.isUrl
        ) {
            isDefaultServer = true;
        }

        const fallbackHsUrl = isDefaultServer ? this.props.fallbackHsUrl! : null;

        const loginLogic = new Login(hsUrl, isUrl, fallbackHsUrl, {
            defaultDeviceDisplayName: this.props.defaultDeviceDisplayName,
        });
        this.loginLogic = loginLogic;

        this.setState({
            busy: true,
            loginIncorrect: false,
        });

        // Do a quick liveliness check on the URLs
        try {
            const { warning } = await AutoDiscoveryUtils.validateServerConfigWithStaticUrls(hsUrl, isUrl);
            if (warning) {
                this.setState({
                    ...AutoDiscoveryUtils.authComponentStateForError(warning),
                    errorText: "",
                });
            } else {
                this.setState({
                    serverIsAlive: true,
                    errorText: "",
                });
            }
        } catch (e) {
            this.setState({
                busy: false,
                ...AutoDiscoveryUtils.authComponentStateForError(e),
            });
        }

        loginLogic
            .getFlows()
            .then(
                (flows) => {
                    // look for a flow where we understand all of the steps.
                    const supportedFlows = flows.filter(this.isSupportedFlow);

                    if (supportedFlows.length > 0) {
                        this.setState({
                            flows: supportedFlows,
                        });
                        return;
                    }

                    // we got to the end of the list without finding a suitable flow.
                    this.setState({
                        errorText: _t(
                            "This homeserver doesn't offer any login flows which are supported by this client.",
                        ),
                    });
                },
                (err) => {
                    this.setState({
                        errorText: messageForConnectionError(err, this.props.serverConfig),
                        loginIncorrect: false,
                        canTryLogin: false,
                    });
                },
            )
            .finally(() => {
                this.setState({
                    busy: false,
                });
            });
    }

    private isSupportedFlow = (flow: LoginFlow): boolean => {
        // technically the flow can have multiple steps, but no one does this
        // for login and loginLogic doesn't support it so we can ignore it.
        if (!this.stepRendererMap[flow.type]) {
            logger.log("Skipping flow", flow, "due to unsupported login type", flow.type);
            return false;
        }
        return true;
    };

    public renderLoginComponentForFlows(): ReactNode {
        if (!this.state.flows) return null;

        // this is the ideal order we want to show the flows in
        const order = ["m.login.password", "m.login.sso"];

        const flows = filterBoolean(order.map((type) => this.state.flows?.find((flow) => flow.type === type)));
        return (
            <React.Fragment>
                {flows.map((flow) => {
                    const stepRenderer = this.stepRendererMap[flow.type];
                    return <React.Fragment key={flow.type}>{stepRenderer()}</React.Fragment>;
                })}
            </React.Fragment>
        );
    }

    private renderPasswordStep = (): JSX.Element => {
        return (
            <PasswordLogin
                onSubmit={this.onPasswordLogin}
                username={this.state.username}
                phoneCountry={this.state.phoneCountry}
                phoneNumber={this.state.phoneNumber}
                onUsernameChanged={this.onUsernameChanged}
                onUsernameBlur={this.onUsernameBlur}
                onPhoneCountryChanged={this.onPhoneCountryChanged}
                onPhoneNumberChanged={this.onPhoneNumberChanged}
                onForgotPasswordClick={this.props.onForgotPasswordClick}
                loginIncorrect={this.state.loginIncorrect}
                serverConfig={this.props.serverConfig}
                disableSubmit={this.isBusy()}
                busy={this.props.isSyncing || this.state.busyLoggingIn}
            />
        );
    };

    private renderSsoStep = (loginType: "cas" | "sso"): JSX.Element => {
        const flow = this.state.flows?.find((flow) => flow.type === "m.login." + loginType) as ISSOFlow;

        return (
            <SSOButtons
                matrixClient={this.loginLogic.createTemporaryClient()}
                flow={flow}
                loginType={loginType}
                fragmentAfterLogin={this.props.fragmentAfterLogin}
                primary={!this.state.flows?.find((flow) => flow.type === "m.login.password")}
                action={SSOAction.LOGIN}
            />
        );
    };

    public render(): React.ReactNode {
        const loader =
            this.isBusy() && !this.state.busyLoggingIn ? (
                <div className="mx_Login_loader">
                    <Spinner />
                </div>
            ) : null;

        const errorText = this.state.errorText;

        let errorTextSection;
        if (errorText) {
            errorTextSection = <div className="mx_Login_error">{errorText}</div>;
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

        let footer;
        if (this.props.isSyncing || this.state.busyLoggingIn) {
            footer = (
                <div className="mx_AuthBody_paddedFooter">
                    <div className="mx_AuthBody_paddedFooter_title">
                        <InlineSpinner w={20} h={20} />
                        {this.props.isSyncing ? _t("Syncing…") : _t("Signing In…")}
                    </div>
                    {this.props.isSyncing && (
                        <div className="mx_AuthBody_paddedFooter_subtitle">
                            {_t("If you've joined lots of rooms, this might take a while")}
                        </div>
                    )}
                </div>
            );
        } else if (SettingsStore.getValue(UIFeature.Registration)) {
            footer = (
                <span className="mx_AuthBody_changeFlow">
                    {_t(
                        "New? <a>Create account</a>",
                        {},
                        {
                            a: (sub) => (
                                <AccessibleButton kind="link_inline" onClick={this.onTryRegisterClick}>
                                    {sub}
                                </AccessibleButton>
                            ),
                        },
                    )}
                </span>
            );
        }

        return (
            <AuthPage>
                <AuthHeader disableLanguageSelector={this.props.isSyncing || this.state.busyLoggingIn} />
                <AuthBody>
                    <h1>
                        {_t("Sign in")}
                        {loader}
                    </h1>
                    {errorTextSection}
                    {serverDeadSection}
                    <ServerPicker
                        serverConfig={this.props.serverConfig}
                        onServerConfigChange={this.props.onServerConfigChange}
                    />
                    {this.renderLoginComponentForFlows()}
                    {footer}
                </AuthBody>
            </AuthPage>
        );
    }
}

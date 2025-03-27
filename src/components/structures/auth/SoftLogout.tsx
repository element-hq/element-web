/*
Copyright 2024 New Vector Ltd.
Copyright 2019-2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX, type ChangeEvent, type SyntheticEvent } from "react";
import { logger } from "matrix-js-sdk/src/logger";
import { type Optional } from "matrix-events-sdk";
import { type LoginFlow, MatrixError, SSOAction, type SSOFlow } from "matrix-js-sdk/src/matrix";

import { _t } from "../../../languageHandler";
import dis from "../../../dispatcher/dispatcher";
import * as Lifecycle from "../../../Lifecycle";
import Modal from "../../../Modal";
import { type IMatrixClientCreds, MatrixClientPeg } from "../../../MatrixClientPeg";
import { sendLoginRequest } from "../../../Login";
import AuthPage from "../../views/auth/AuthPage";
import { SSO_HOMESERVER_URL_KEY, SSO_ID_SERVER_URL_KEY } from "../../../BasePlatform";
import SSOButtons from "../../views/elements/SSOButtons";
import ConfirmWipeDeviceDialog from "../../views/dialogs/ConfirmWipeDeviceDialog";
import Field from "../../views/elements/Field";
import AccessibleButton from "../../views/elements/AccessibleButton";
import Spinner from "../../views/elements/Spinner";
import AuthHeader from "../../views/auth/AuthHeader";
import AuthBody from "../../views/auth/AuthBody";
import { SDKContext } from "../../../contexts/SDKContext";

enum LoginView {
    Loading,
    Password,
    CAS, // SSO, but old
    SSO,
    PasswordWithSocialSignOn,
    Unsupported,
}

const STATIC_FLOWS_TO_VIEWS: Record<string, LoginView> = {
    "m.login.password": LoginView.Password,
    "m.login.cas": LoginView.CAS,
    "m.login.sso": LoginView.SSO,
};

interface IProps {
    // Query parameters from MatrixChat
    realQueryParams: {
        loginToken?: string;
    };
    fragmentAfterLogin?: string;

    // Called when the SSO login completes
    onTokenLoginCompleted: () => void;
}

interface IState {
    loginView: LoginView;
    busy: boolean;
    password: string;
    errorText: string;
    flows: LoginFlow[];
}

export default class SoftLogout extends React.Component<IProps, IState> {
    public static contextType = SDKContext;
    declare public context: React.ContextType<typeof SDKContext>;

    public constructor(props: IProps) {
        super(props);

        this.state = {
            loginView: LoginView.Loading,
            busy: false,
            password: "",
            errorText: "",
            flows: [],
        };
    }

    public componentDidMount(): void {
        // We've ended up here when we don't need to - navigate to login
        if (!Lifecycle.isSoftLogout()) {
            dis.dispatch({ action: "start_login" });
            return;
        }

        this.initLogin();
    }

    private onClearAll = (): void => {
        Modal.createDialog(ConfirmWipeDeviceDialog, {
            onFinished: (wipeData) => {
                if (!wipeData) return;

                logger.log("Clearing data from soft-logged-out session");
                Lifecycle.logout(this.context.oidcClientStore);
            },
        });
    };

    private async initLogin(): Promise<void> {
        const queryParams = this.props.realQueryParams;
        const hasAllParams = queryParams?.["loginToken"];
        if (hasAllParams) {
            this.setState({ loginView: LoginView.Loading });

            const loggedIn = await this.trySsoLogin();
            if (loggedIn) return;
        }

        // Note: we don't use the existing Login class because it is heavily flow-based. We don't
        // care about login flows here, unless it is the single flow we support.
        const client = MatrixClientPeg.safeGet();
        const flows = (await client.loginFlows()).flows;
        const loginViews = flows.map((f) => STATIC_FLOWS_TO_VIEWS[f.type]);

        const isSocialSignOn = loginViews.includes(LoginView.Password) && loginViews.includes(LoginView.SSO);
        const firstView = loginViews.filter((f) => !!f)[0] || LoginView.Unsupported;
        const chosenView = isSocialSignOn ? LoginView.PasswordWithSocialSignOn : firstView;
        this.setState({ flows, loginView: chosenView });
    }

    private onPasswordChange = (ev: ChangeEvent<HTMLInputElement>): void => {
        this.setState({ password: ev.target.value });
    };

    private onForgotPassword = (): void => {
        dis.dispatch({ action: "start_password_recovery" });
    };

    private onPasswordLogin = async (ev: SyntheticEvent): Promise<void> => {
        ev.preventDefault();
        ev.stopPropagation();

        this.setState({ busy: true });

        const cli = MatrixClientPeg.safeGet();
        const hsUrl = cli.getHomeserverUrl();
        const isUrl = cli.getIdentityServerUrl();
        const loginType = "m.login.password";
        const loginParams = {
            identifier: {
                type: "m.id.user",
                user: cli.getUserId(),
            },
            password: this.state.password,
            device_id: cli.getDeviceId() ?? undefined,
        };

        let credentials: IMatrixClientCreds;
        try {
            credentials = await sendLoginRequest(hsUrl, isUrl, loginType, loginParams);
        } catch (e) {
            let errorText = _t("auth|failed_soft_logout_homeserver");
            if (
                e instanceof MatrixError &&
                e.errcode === "M_FORBIDDEN" &&
                (e.httpStatus === 401 || e.httpStatus === 403)
            ) {
                errorText = _t("auth|incorrect_password");
            }

            this.setState({
                busy: false,
                errorText: errorText,
            });
            return;
        }

        Lifecycle.setLoggedIn(credentials).catch((e) => {
            logger.error(e);
            this.setState({ busy: false, errorText: _t("auth|failed_soft_logout_auth") });
        });
    };

    /**
     * Attempt to login via SSO
     * @returns A promise that resolves to a boolean -  true when sso login was successful
     */
    private async trySsoLogin(): Promise<boolean> {
        this.setState({ busy: true });

        const hsUrl = localStorage.getItem(SSO_HOMESERVER_URL_KEY);
        if (!hsUrl) {
            logger.error("Homeserver URL unknown for SSO login callback");
            this.setState({ busy: false, loginView: LoginView.Unsupported });
            return false;
        }

        const isUrl = localStorage.getItem(SSO_ID_SERVER_URL_KEY) || MatrixClientPeg.safeGet().getIdentityServerUrl();
        const loginType = "m.login.token";
        const loginParams = {
            token: this.props.realQueryParams["loginToken"],
            device_id: MatrixClientPeg.safeGet().getDeviceId() ?? undefined,
        };

        let credentials: IMatrixClientCreds;
        try {
            credentials = await sendLoginRequest(hsUrl, isUrl, loginType, loginParams);
        } catch (e) {
            logger.error(e);
            this.setState({ busy: false, loginView: LoginView.Unsupported });
            return false;
        }

        return Lifecycle.setLoggedIn(credentials)
            .then(() => {
                if (this.props.onTokenLoginCompleted) {
                    this.props.onTokenLoginCompleted();
                }
                return true;
            })
            .catch((e) => {
                logger.error(e);
                this.setState({ busy: false, loginView: LoginView.Unsupported });
                return false;
            });
    }

    private renderPasswordForm(introText: Optional<string>): JSX.Element {
        let error: JSX.Element | undefined;
        if (this.state.errorText) {
            error = <span className="mx_Login_error">{this.state.errorText}</span>;
        }

        return (
            <form onSubmit={this.onPasswordLogin}>
                {introText ? <p>{introText}</p> : null}
                {error}
                <Field
                    type="password"
                    label={_t("common|password")}
                    onChange={this.onPasswordChange}
                    value={this.state.password}
                    disabled={this.state.busy}
                />
                <AccessibleButton onClick={this.onPasswordLogin} kind="primary" disabled={this.state.busy}>
                    {_t("action|sign_in")}
                </AccessibleButton>
                <AccessibleButton onClick={this.onForgotPassword} kind="link">
                    {_t("auth|forgot_password_prompt")}
                </AccessibleButton>
            </form>
        );
    }

    private renderSsoForm(introText: Optional<string>): JSX.Element {
        const loginType = this.state.loginView === LoginView.CAS ? "cas" : "sso";
        const flow = this.state.flows.find((flow) => flow.type === "m.login." + loginType) as SSOFlow;

        return (
            <div>
                {introText ? <p>{introText}</p> : null}
                <SSOButtons
                    matrixClient={MatrixClientPeg.safeGet()}
                    flow={flow}
                    loginType={loginType}
                    fragmentAfterLogin={this.props.fragmentAfterLogin}
                    primary={!this.state.flows.find((flow) => flow.type === "m.login.password")}
                    action={SSOAction.LOGIN}
                />
            </div>
        );
    }

    private renderSignInSection(): JSX.Element {
        if (this.state.loginView === LoginView.Loading) {
            return <Spinner />;
        }

        if (this.state.loginView === LoginView.Password) {
            return this.renderPasswordForm(_t("auth|soft_logout_intro_password"));
        }

        if (this.state.loginView === LoginView.SSO || this.state.loginView === LoginView.CAS) {
            return this.renderSsoForm(_t("auth|soft_logout_intro_sso"));
        }

        if (this.state.loginView === LoginView.PasswordWithSocialSignOn) {
            // We render both forms with no intro/error to ensure the layout looks reasonably
            // okay enough.
            //
            // Note: "mx_AuthBody_centered" text taken from registration page.
            return (
                <>
                    <p>{_t("auth|soft_logout_intro_sso")}</p>
                    {this.renderSsoForm(null)}
                    <h2 className="mx_AuthBody_centered">
                        {_t("auth|sso_or_username_password", {
                            ssoButtons: "",
                            usernamePassword: "",
                        }).trim()}
                    </h2>
                    {this.renderPasswordForm(null)}
                </>
            );
        }

        // Default: assume unsupported/error
        return <p>{_t("auth|soft_logout_intro_unsupported_auth")}</p>;
    }

    public render(): React.ReactNode {
        return (
            <AuthPage>
                <AuthHeader />
                <AuthBody>
                    <h1>{_t("auth|soft_logout_heading")}</h1>

                    <h2>{_t("action|sign_in")}</h2>
                    <div>{this.renderSignInSection()}</div>

                    <h2>{_t("auth|soft_logout_subheading")}</h2>
                    <p>{_t("auth|soft_logout_warning")}</p>
                    <div>
                        <AccessibleButton onClick={this.onClearAll} kind="danger">
                            {_t("auth|soft_logout|clear_data_button")}
                        </AccessibleButton>
                    </div>
                </AuthBody>
            </AuthPage>
        );
    }
}

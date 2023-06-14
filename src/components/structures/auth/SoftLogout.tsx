/*
Copyright 2019-2022 The Matrix.org Foundation C.I.C.

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

import React, { ChangeEvent, SyntheticEvent } from "react";
import { logger } from "matrix-js-sdk/src/logger";
import { Optional } from "matrix-events-sdk";
import { ISSOFlow, LoginFlow, SSOAction } from "matrix-js-sdk/src/@types/auth";
import { MatrixError } from "matrix-js-sdk/src/http-api";

import { _t } from "../../../languageHandler";
import dis from "../../../dispatcher/dispatcher";
import * as Lifecycle from "../../../Lifecycle";
import Modal from "../../../Modal";
import { IMatrixClientCreds, MatrixClientPeg } from "../../../MatrixClientPeg";
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
    keyBackupNeeded: boolean;
    busy: boolean;
    password: string;
    errorText: string;
    flows: LoginFlow[];
}

export default class SoftLogout extends React.Component<IProps, IState> {
    public constructor(props: IProps) {
        super(props);

        this.state = {
            loginView: LoginView.Loading,
            keyBackupNeeded: true, // assume we do while we figure it out (see componentDidMount)
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

        const cli = MatrixClientPeg.get();
        if (cli.isCryptoEnabled()) {
            cli.countSessionsNeedingBackup().then((remaining) => {
                this.setState({ keyBackupNeeded: remaining > 0 });
            });
        }
    }

    private onClearAll = (): void => {
        Modal.createDialog(ConfirmWipeDeviceDialog, {
            onFinished: (wipeData) => {
                if (!wipeData) return;

                logger.log("Clearing data from soft-logged-out session");
                Lifecycle.logout();
            },
        });
    };

    private async initLogin(): Promise<void> {
        const queryParams = this.props.realQueryParams;
        const hasAllParams = queryParams?.["loginToken"];
        if (hasAllParams) {
            this.setState({ loginView: LoginView.Loading });
            this.trySsoLogin();
            return;
        }

        // Note: we don't use the existing Login class because it is heavily flow-based. We don't
        // care about login flows here, unless it is the single flow we support.
        const client = MatrixClientPeg.get();
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

        const hsUrl = MatrixClientPeg.get().getHomeserverUrl();
        const isUrl = MatrixClientPeg.get().getIdentityServerUrl();
        const loginType = "m.login.password";
        const loginParams = {
            identifier: {
                type: "m.id.user",
                user: MatrixClientPeg.get().getUserId(),
            },
            password: this.state.password,
            device_id: MatrixClientPeg.get().getDeviceId() ?? undefined,
        };

        let credentials: IMatrixClientCreds;
        try {
            credentials = await sendLoginRequest(hsUrl, isUrl, loginType, loginParams);
        } catch (e) {
            let errorText = _t("Failed to re-authenticate due to a homeserver problem");
            if (
                e instanceof MatrixError &&
                e.errcode === "M_FORBIDDEN" &&
                (e.httpStatus === 401 || e.httpStatus === 403)
            ) {
                errorText = _t("Incorrect password");
            }

            this.setState({
                busy: false,
                errorText: errorText,
            });
            return;
        }

        Lifecycle.hydrateSession(credentials).catch((e) => {
            logger.error(e);
            this.setState({ busy: false, errorText: _t("Failed to re-authenticate") });
        });
    };

    private async trySsoLogin(): Promise<void> {
        this.setState({ busy: true });

        const hsUrl = localStorage.getItem(SSO_HOMESERVER_URL_KEY);
        if (!hsUrl) {
            logger.error("Homeserver URL unknown for SSO login callback");
            this.setState({ busy: false, loginView: LoginView.Unsupported });
            return;
        }

        const isUrl = localStorage.getItem(SSO_ID_SERVER_URL_KEY) || MatrixClientPeg.get().getIdentityServerUrl();
        const loginType = "m.login.token";
        const loginParams = {
            token: this.props.realQueryParams["loginToken"],
            device_id: MatrixClientPeg.get().getDeviceId() ?? undefined,
        };

        let credentials: IMatrixClientCreds;
        try {
            credentials = await sendLoginRequest(hsUrl, isUrl, loginType, loginParams);
        } catch (e) {
            logger.error(e);
            this.setState({ busy: false, loginView: LoginView.Unsupported });
            return;
        }

        Lifecycle.hydrateSession(credentials)
            .then(() => {
                if (this.props.onTokenLoginCompleted) this.props.onTokenLoginCompleted();
            })
            .catch((e) => {
                logger.error(e);
                this.setState({ busy: false, loginView: LoginView.Unsupported });
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
                    label={_t("Password")}
                    onChange={this.onPasswordChange}
                    value={this.state.password}
                    disabled={this.state.busy}
                />
                <AccessibleButton
                    onClick={this.onPasswordLogin}
                    kind="primary"
                    type="submit"
                    disabled={this.state.busy}
                >
                    {_t("Sign In")}
                </AccessibleButton>
                <AccessibleButton onClick={this.onForgotPassword} kind="link">
                    {_t("Forgotten your password?")}
                </AccessibleButton>
            </form>
        );
    }

    private renderSsoForm(introText: Optional<string>): JSX.Element {
        const loginType = this.state.loginView === LoginView.CAS ? "cas" : "sso";
        const flow = this.state.flows.find((flow) => flow.type === "m.login." + loginType) as ISSOFlow;

        return (
            <div>
                {introText ? <p>{introText}</p> : null}
                <SSOButtons
                    matrixClient={MatrixClientPeg.get()}
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

        let introText: string | null = null; // null is translated to something area specific in this function
        if (this.state.keyBackupNeeded) {
            introText = _t(
                "Regain access to your account and recover encryption keys stored in this session. " +
                    "Without them, you won't be able to read all of your secure messages in any session.",
            );
        }

        if (this.state.loginView === LoginView.Password) {
            if (!introText) {
                introText = _t("Enter your password to sign in and regain access to your account.");
            } // else we already have a message and should use it (key backup warning)

            return this.renderPasswordForm(introText);
        }

        if (this.state.loginView === LoginView.SSO || this.state.loginView === LoginView.CAS) {
            if (!introText) {
                introText = _t("Sign in and regain access to your account.");
            } // else we already have a message and should use it (key backup warning)

            return this.renderSsoForm(introText);
        }

        if (this.state.loginView === LoginView.PasswordWithSocialSignOn) {
            if (!introText) {
                introText = _t("Sign in and regain access to your account.");
            }

            // We render both forms with no intro/error to ensure the layout looks reasonably
            // okay enough.
            //
            // Note: "mx_AuthBody_centered" text taken from registration page.
            return (
                <>
                    <p>{introText}</p>
                    {this.renderSsoForm(null)}
                    <h2 className="mx_AuthBody_centered">
                        {_t("%(ssoButtons)s Or %(usernamePassword)s", {
                            ssoButtons: "",
                            usernamePassword: "",
                        }).trim()}
                    </h2>
                    {this.renderPasswordForm(null)}
                </>
            );
        }

        // Default: assume unsupported/error
        return (
            <p>
                {_t(
                    "You cannot sign in to your account. Please contact your " +
                        "homeserver admin for more information.",
                )}
            </p>
        );
    }

    public render(): React.ReactNode {
        return (
            <AuthPage>
                <AuthHeader />
                <AuthBody>
                    <h1>{_t("You're signed out")}</h1>

                    <h2>{_t("Sign in")}</h2>
                    <div>{this.renderSignInSection()}</div>

                    <h2>{_t("Clear personal data")}</h2>
                    <p>
                        {_t(
                            "Warning: your personal data (including encryption keys) is still stored " +
                                "in this session. Clear it if you're finished using this session, or want to sign " +
                                "in to another account.",
                        )}
                    </p>
                    <div>
                        <AccessibleButton onClick={this.onClearAll} kind="danger">
                            {_t("Clear all data")}
                        </AccessibleButton>
                    </div>
                </AuthBody>
            </AuthPage>
        );
    }
}

/*
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
import PropTypes from 'prop-types';
import {_t} from '../../../languageHandler';
import * as sdk from '../../../index';
import dis from '../../../dispatcher/dispatcher';
import * as Lifecycle from '../../../Lifecycle';
import Modal from '../../../Modal';
import {MatrixClientPeg} from "../../../MatrixClientPeg";
import {sendLoginRequest} from "../../../Login";
import AuthPage from "../../views/auth/AuthPage";
import SSOButton from "../../views/elements/SSOButton";
import {HOMESERVER_URL_KEY, ID_SERVER_URL_KEY} from "../../../BasePlatform";

const LOGIN_VIEW = {
    LOADING: 1,
    PASSWORD: 2,
    CAS: 3, // SSO, but old
    SSO: 4,
    UNSUPPORTED: 5,
};

const FLOWS_TO_VIEWS = {
    "m.login.password": LOGIN_VIEW.PASSWORD,
    "m.login.cas": LOGIN_VIEW.CAS,
    "m.login.sso": LOGIN_VIEW.SSO,
};

export default class SoftLogout extends React.Component {
    static propTypes = {
        // Query parameters from MatrixChat
        realQueryParams: PropTypes.object, // {loginToken}

        // Called when the SSO login completes
        onTokenLoginCompleted: PropTypes.func,
    };

    constructor() {
        super();

        this.state = {
            loginView: LOGIN_VIEW.LOADING,
            keyBackupNeeded: true, // assume we do while we figure it out (see componentDidMount)

            busy: false,
            password: "",
            errorText: "",
        };
    }

    componentDidMount(): void {
        // We've ended up here when we don't need to - navigate to login
        if (!Lifecycle.isSoftLogout()) {
            dis.dispatch({action: "start_login"});
            return;
        }

        this._initLogin();

        MatrixClientPeg.get().flagAllGroupSessionsForBackup().then(remaining => {
            this.setState({keyBackupNeeded: remaining > 0});
        });
    }

    onClearAll = () => {
        const ConfirmWipeDeviceDialog = sdk.getComponent('dialogs.ConfirmWipeDeviceDialog');
        Modal.createTrackedDialog('Clear Data', 'Soft Logout', ConfirmWipeDeviceDialog, {
            onFinished: (wipeData) => {
                if (!wipeData) return;

                console.log("Clearing data from soft-logged-out session");
                Lifecycle.logout();
            },
        });
    };

    async _initLogin() {
        const queryParams = this.props.realQueryParams;
        const hasAllParams = queryParams && queryParams['loginToken'];
        if (hasAllParams) {
            this.setState({loginView: LOGIN_VIEW.LOADING});
            this.trySsoLogin();
            return;
        }

        // Note: we don't use the existing Login class because it is heavily flow-based. We don't
        // care about login flows here, unless it is the single flow we support.
        const client = MatrixClientPeg.get();
        const loginViews = (await client.loginFlows()).flows.map(f => FLOWS_TO_VIEWS[f.type]);

        const chosenView = loginViews.filter(f => !!f)[0] || LOGIN_VIEW.UNSUPPORTED;
        this.setState({loginView: chosenView});
    }

    onPasswordChange = (ev) => {
        this.setState({password: ev.target.value});
    };

    onForgotPassword = () => {
        dis.dispatch({action: 'start_password_recovery'});
    };

    onPasswordLogin = async (ev) => {
        ev.preventDefault();
        ev.stopPropagation();

        this.setState({busy: true});

        const hsUrl = MatrixClientPeg.get().getHomeserverUrl();
        const isUrl = MatrixClientPeg.get().getIdentityServerUrl();
        const loginType = "m.login.password";
        const loginParams = {
            identifier: {
                type: "m.id.user",
                user: MatrixClientPeg.get().getUserId(),
            },
            password: this.state.password,
            device_id: MatrixClientPeg.get().getDeviceId(),
        };

        let credentials = null;
        try {
            credentials = await sendLoginRequest(hsUrl, isUrl, loginType, loginParams);
        } catch (e) {
            let errorText = _t("Failed to re-authenticate due to a homeserver problem");
            if (e.errcode === "M_FORBIDDEN" && (e.httpStatus === 401 || e.httpStatus === 403)) {
                errorText = _t("Incorrect password");
            }

            this.setState({
                busy: false,
                errorText: errorText,
            });
            return;
        }

        Lifecycle.hydrateSession(credentials).catch((e) => {
            console.error(e);
            this.setState({busy: false, errorText: _t("Failed to re-authenticate")});
        });
    };

    async trySsoLogin() {
        this.setState({busy: true});

        const hsUrl = localStorage.getItem(HOMESERVER_URL_KEY);
        const isUrl = localStorage.getItem(ID_SERVER_URL_KEY) || MatrixClientPeg.get().getIdentityServerUrl();
        const loginType = "m.login.token";
        const loginParams = {
            token: this.props.realQueryParams['loginToken'],
            device_id: MatrixClientPeg.get().getDeviceId(),
        };

        let credentials = null;
        try {
            credentials = await sendLoginRequest(hsUrl, isUrl, loginType, loginParams);
        } catch (e) {
            console.error(e);
            this.setState({busy: false, loginView: LOGIN_VIEW.UNSUPPORTED});
            return;
        }

        Lifecycle.hydrateSession(credentials).then(() => {
            if (this.props.onTokenLoginCompleted) this.props.onTokenLoginCompleted();
        }).catch((e) => {
            console.error(e);
            this.setState({busy: false, loginView: LOGIN_VIEW.UNSUPPORTED});
        });
    }

    _renderSignInSection() {
        if (this.state.loginView === LOGIN_VIEW.LOADING) {
            const Spinner = sdk.getComponent("elements.Spinner");
            return <Spinner />;
        }

        let introText = null; // null is translated to something area specific in this function
        if (this.state.keyBackupNeeded) {
            introText = _t(
                "Regain access to your account and recover encryption keys stored in this session. " +
                "Without them, you won’t be able to read all of your secure messages in any session.");
        }

        if (this.state.loginView === LOGIN_VIEW.PASSWORD) {
            const Field = sdk.getComponent("elements.Field");
            const AccessibleButton = sdk.getComponent('elements.AccessibleButton');

            let error = null;
            if (this.state.errorText) {
                error = <span className='mx_Login_error'>{this.state.errorText}</span>;
            }

            if (!introText) {
                introText = _t("Enter your password to sign in and regain access to your account.");
            } // else we already have a message and should use it (key backup warning)

            return (
                <form onSubmit={this.onPasswordLogin}>
                    <p>{introText}</p>
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

        if (this.state.loginView === LOGIN_VIEW.SSO || this.state.loginView === LOGIN_VIEW.CAS) {
            if (!introText) {
                introText = _t("Sign in and regain access to your account.");
            } // else we already have a message and should use it (key backup warning)

            return (
                <div>
                    <p>{introText}</p>
                    <SSOButton
                        matrixClient={MatrixClientPeg.get()}
                        loginType={this.state.loginView === LOGIN_VIEW.CAS ? "cas" : "sso"}
                        fragmentAfterLogin={this.props.fragmentAfterLogin}
                    />
                </div>
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

    render() {
        const AuthHeader = sdk.getComponent("auth.AuthHeader");
        const AuthBody = sdk.getComponent("auth.AuthBody");
        const AccessibleButton = sdk.getComponent('elements.AccessibleButton');

        return (
            <AuthPage>
                <AuthHeader />
                <AuthBody>
                    <h2>
                        {_t("You're signed out")}
                    </h2>

                    <h3>{_t("Sign in")}</h3>
                    <div>
                        {this._renderSignInSection()}
                    </div>

                    <h3>{_t("Clear personal data")}</h3>
                    <p>
                        {_t(
                            "Warning: Your personal data (including encryption keys) is still stored " +
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

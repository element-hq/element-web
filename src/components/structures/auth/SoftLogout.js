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
import {_t} from '../../../languageHandler';
import sdk from '../../../index';
import dis from '../../../dispatcher';
import * as Lifecycle from '../../../Lifecycle';
import Modal from '../../../Modal';
import {ValidatedServerConfig} from "../../../utils/AutoDiscoveryUtils";
import SdkConfig from "../../../SdkConfig";
import MatrixClientPeg from "../../../MatrixClientPeg";
import {sendLoginRequest} from "../../../Login";

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
        // Nothing.
    };

    constructor() {
        super();

        const defaultServerConfig: ValidatedServerConfig = SdkConfig.get()["validated_server_config"];

        const hsUrl = MatrixClientPeg.get().getHomeserverUrl();
        const domainName = hsUrl === defaultServerConfig.hsUrl
            ? defaultServerConfig.hsName
            : MatrixClientPeg.get().getHomeServerName();

        const userId = MatrixClientPeg.get().getUserId();
        const user = MatrixClientPeg.get().getUser(userId);

        const displayName = user ? user.displayName : userId.substring(1).split(':')[0];

        this.state = {
            domainName,
            userId,
            displayName,
            loginView: LOGIN_VIEW.LOADING,
            keyBackupNeeded: true, // assume we do while we figure it out (see componentWillMount)

            busy: false,
            password: "",
            errorText: "",
        };
    }

    componentDidMount(): void {
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

                console.log("Clearing data from soft-logged-out device");
                Lifecycle.logout();
            },
        });
    };

    async _initLogin() {
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

    _renderSignInSection() {
        if (this.state.loginView === LOGIN_VIEW.LOADING) {
            const Spinner = sdk.getComponent("elements.Spinner");
            return <Spinner />;
        }

        if (this.state.loginView === LOGIN_VIEW.PASSWORD) {
            const Field = sdk.getComponent("elements.Field");
            const AccessibleButton = sdk.getComponent('elements.AccessibleButton');

            let error = null;
            if (this.state.errorText) {
                error = <span className='mx_Login_error'>{this.state.errorText}</span>;
            }

            let introText = _t("Enter your password to sign in and regain access to your account.");
            if (this.state.keyBackupNeeded) {
                introText = _t(
                    "Regain access your account and recover encryption keys stored on this device. " +
                    "Without them, you won’t be able to read all of your secure messages on any device.");
            }

            return (
                <form onSubmit={this.onPasswordLogin}>
                    <p>{introText}</p>
                    {error}
                    <Field
                        id="softlogout_password"
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
            // TODO: TravisR - https://github.com/vector-im/riot-web/issues/10238
            return <p>PLACEHOLDER</p>;
        }

        // Default: assume unsupported
        return (
            <p>
                {_t(
                    "Cannot re-authenticate with your account. Please contact your " +
                    "homeserver admin for more information.",
                )}
            </p>
        );
    }

    render() {
        const AuthPage = sdk.getComponent("auth.AuthPage");
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
                    <div>
                        {_t(
                            "Your homeserver (%(domainName)s) admin has signed you out of your " +
                            "account %(displayName)s (%(userId)s).",
                            {
                                domainName: this.state.domainName,
                                displayName: this.state.displayName,
                                userId: this.state.userId,
                            },
                        )}
                    </div>

                    <h3>{_t("I don't want to sign in")}</h3>
                    <div>
                        {_t(
                            "If this is a shared device, or you don't want to access your account " +
                            "again from it, clear all data stored locally on this device.",
                        )}
                    </div>
                    <div>
                        <AccessibleButton onClick={this.onClearAll} kind="primary">
                            {_t("Clear all data")}
                        </AccessibleButton>
                    </div>

                    <h3>{_t("Sign in")}</h3>
                    <div>
                        {this._renderSignInSection()}
                    </div>
                </AuthBody>
            </AuthPage>
        );
    }
}

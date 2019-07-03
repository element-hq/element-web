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

export default class SoftLogout extends React.Component {
    static propTypes = {
        // Nothing.
    };

    constructor() {
        super();

        const defaultServerConfig: ValidatedServerConfig = SdkConfig.get()["validated_server_config"];

        const hsUrl = MatrixClientPeg.get().getHomeserverUrl();
        const  domainName = hsUrl === defaultServerConfig.hsUrl
            ? defaultServerConfig.hsName
            : MatrixClientPeg.get().getHomeServerName();

        const userId = MatrixClientPeg.get().getUserId();
        const user = MatrixClientPeg.get().getUser(userId);

        const displayName = user ? user.displayName : userId.substring(1).split(':')[0];

        this.state = {
            domainName,
            userId,
            displayName,
        };
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

    onLogin = () => {
        dis.dispatch({action: 'start_login'});
    };

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
                        {_t(
                            "Sign in again to regain access to your account, or a different one.",
                        )}
                    </div>
                    <div>
                        <AccessibleButton onClick={this.onLogin} kind="primary">
                            {_t("Sign in")}
                        </AccessibleButton>
                    </div>
                </AuthBody>
            </AuthPage>
        );
    }
}

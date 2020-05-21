/*
Copyright 2019 New Vector Ltd

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
import * as sdk from '../../../index';
import SdkConfig from '../../../SdkConfig';
import AuthPage from "./AuthPage";
import * as Matrix from "matrix-js-sdk";
import {_td} from "../../../languageHandler";
import PlatformPeg from "../../../PlatformPeg";

// translatable strings for Welcome pages
_td("Sign in with SSO");

export default class Welcome extends React.PureComponent {
    render() {
        const EmbeddedPage = sdk.getComponent('structures.EmbeddedPage');
        const LanguageSelector = sdk.getComponent('auth.LanguageSelector');

        const pagesConfig = SdkConfig.get().embeddedPages;
        let pageUrl = null;
        if (pagesConfig) {
            pageUrl = pagesConfig.welcomeUrl;
        }
        if (!pageUrl) {
            pageUrl = 'welcome.html';
        }

        const {hsUrl, isUrl} = this.props.serverConfig;
        const tmpClient = Matrix.createClient({
            baseUrl: hsUrl,
            idBaseUrl: isUrl,
        });
        const plaf = PlatformPeg.get();
        const callbackUrl = plaf.getSSOCallbackUrl(tmpClient.getHomeserverUrl(), tmpClient.getIdentityServerUrl(),
            this.props.fragmentAfterLogin);

        return (
            <AuthPage>
                <div className="mx_Welcome">
                    <EmbeddedPage
                        className="mx_WelcomePage"
                        url={pageUrl}
                        replaceMap={{
                            "$riot:ssoUrl": tmpClient.getSsoLoginUrl(callbackUrl.toString(), "sso"),
                            "$riot:casUrl": tmpClient.getSsoLoginUrl(callbackUrl.toString(), "cas"),
                        }}
                    />
                    <LanguageSelector />
                </div>
            </AuthPage>
        );
    }
}

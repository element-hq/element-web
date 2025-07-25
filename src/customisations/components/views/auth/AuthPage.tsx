/*
Copyright 2025 Keypair Establishment.
Copyright 2019-2024 New Vector Ltd.
Copyright 2019 The Matrix.org Foundation C.I.C.
Copyright 2015, 2016 OpenMarket Ltd

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";

import SdkConfig from "../../../../SdkConfig";
import AuthFooter from "../../../../components/views/auth/AuthFooter";

export default class AuthPage extends React.PureComponent<React.PropsWithChildren> {
    private static welcomeBackgroundUrl?: string;

    // cache the url as a static to prevent it changing without refreshing
    private static getWelcomeBackgroundUrl(): string {
        if (AuthPage.welcomeBackgroundUrl) return AuthPage.welcomeBackgroundUrl;

        const brandingConfig = SdkConfig.getObject("branding");
        AuthPage.welcomeBackgroundUrl = "themes/element/img/backgrounds/lake.jpg";

        const configuredUrl = brandingConfig?.get("welcome_background_url");
        if (configuredUrl) {
            if (Array.isArray(configuredUrl)) {
                const index = Math.floor(Math.random() * configuredUrl.length);
                AuthPage.welcomeBackgroundUrl = configuredUrl[index];
            } else {
                AuthPage.welcomeBackgroundUrl = configuredUrl;
            }
        }

        return AuthPage.welcomeBackgroundUrl;
    }

    public render(): React.ReactElement {
        const pageStyle = {
            background: `center/cover fixed url(${AuthPage.getWelcomeBackgroundUrl()})`,
        };

        return (
            <div className="mx_AuthPage" style={pageStyle}>
                {this.props.children}
                <AuthFooter />
            </div>
        );
    }
}

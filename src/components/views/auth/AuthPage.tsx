/*
Copyright 2019-2024 New Vector Ltd.
Copyright 2019 The Matrix.org Foundation C.I.C.
Copyright 2015, 2016 OpenMarket Ltd

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";

import SdkConfig from "../../../SdkConfig";
import AuthFooter from "./AuthFooter";

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

        const modalStyle: React.CSSProperties = {
            position: "relative",
            background: "initial",
        };

        const blurStyle: React.CSSProperties = {
            position: "absolute",
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            filter: "blur(40px)",
            background: pageStyle.background,
        };

        const modalContentStyle: React.CSSProperties = {
            display: "flex",
            zIndex: 1,
            background: "rgba(255, 255, 255, 0.59)",
            borderRadius: "8px",
        };

        return (
            <div className="mx_AuthPage" style={pageStyle}>
                <div className="mx_AuthPage_modal" style={modalStyle}>
                    <div className="mx_AuthPage_modalBlur" style={blurStyle} />
                    <div className="mx_AuthPage_modalContent" style={modalContentStyle}>
                        {this.props.children}
                    </div>
                </div>
                <AuthFooter />
            </div>
        );
    }
}

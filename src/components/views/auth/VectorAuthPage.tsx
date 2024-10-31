/*
Copyright 2019-2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import * as React from "react";

import SdkConfig from "../../../SdkConfig";
import VectorAuthFooter from "./VectorAuthFooter";

export default class VectorAuthPage extends React.PureComponent<React.PropsWithChildren> {
    private static welcomeBackgroundUrl?: string;

    // cache the url as a static to prevent it changing without refreshing
    private static getWelcomeBackgroundUrl(): string {
        if (VectorAuthPage.welcomeBackgroundUrl) return VectorAuthPage.welcomeBackgroundUrl;

        const brandingConfig = SdkConfig.getObject("branding");
        VectorAuthPage.welcomeBackgroundUrl = "themes/element/img/backgrounds/lake.jpg";

        const configuredUrl = brandingConfig?.get("welcome_background_url");
        if (configuredUrl) {
            if (Array.isArray(configuredUrl)) {
                const index = Math.floor(Math.random() * configuredUrl.length);
                VectorAuthPage.welcomeBackgroundUrl = configuredUrl[index];
            } else {
                VectorAuthPage.welcomeBackgroundUrl = configuredUrl;
            }
        }

        return VectorAuthPage.welcomeBackgroundUrl;
    }

    public render(): React.ReactElement {
        const pageStyle = {
            background: `center/cover fixed url(${VectorAuthPage.getWelcomeBackgroundUrl()})`,
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
                <VectorAuthFooter />
            </div>
        );
    }
}

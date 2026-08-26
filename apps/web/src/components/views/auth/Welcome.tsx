/*
Copyright 2019-2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type ReactNode } from "react";
import classNames from "classnames";
import { Glass } from "@vector-im/compound-web";

import SdkConfig from "../../../SdkConfig";
import AuthPage from "./AuthPage";
import SettingsStore from "../../../settings/SettingsStore";
import { UIFeature } from "../../../settings/UIFeature";
import LanguageSelector from "./LanguageSelector";
import EmbeddedPage from "../../structures/EmbeddedPage";
import { MATRIX_LOGO_HTML } from "../../structures/static-page-vars";
import DefaultWelcome from "./DefaultWelcome.tsx";
import { type ValidatedServerConfig } from "../../../utils/ValidatedServerConfig.ts";

interface Props {
    serverConfig: ValidatedServerConfig;
}

export default class Welcome extends React.PureComponent<Props> {
    public render(): React.ReactNode {
        const pagesConfig = SdkConfig.getObject("embedded_pages");
        const pageUrl = pagesConfig?.get("welcome_url");

        const replaceMap: Record<string, string> = {
            "$brand": SdkConfig.get("brand"),
            "$riot:ssoUrl": "#/start_sso",
            "$riot:casUrl": "#/start_cas",
            "$matrixLogo": MATRIX_LOGO_HTML,
            "[matrix]": MATRIX_LOGO_HTML,
        };

        let body: ReactNode;
        if (pageUrl) {
            body = <EmbeddedPage className="mx_WelcomePage" url={pageUrl} replaceMap={replaceMap} />;
        } else {
            body = <DefaultWelcome serverConfig={this.props.serverConfig} />;
        }

        return (
            <AuthPage addBlur={false}>
                <Glass>
                    <div
                        className={classNames("mx_Welcome", {
                            mx_WelcomePage_registrationDisabled: !SettingsStore.getValue(UIFeature.Registration),
                        })}
                    >
                        {body}
                        <LanguageSelector />
                    </div>
                </Glass>
            </AuthPage>
        );
    }
}

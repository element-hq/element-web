/*
Copyright 2019-2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type ReactNode } from "react";
import classNames from "classnames";
import { type EmptyObject } from "matrix-js-sdk/src/matrix";

import SdkConfig from "../../../SdkConfig";
import AuthPage from "./AuthPage";
import SettingsStore from "../../../settings/SettingsStore";
import { UIFeature } from "../../../settings/UIFeature";
import LanguageSelector from "./LanguageSelector";
import EmbeddedPage from "../../structures/EmbeddedPage";
import { MATRIX_LOGO_HTML } from "../../structures/static-page-vars";
import DefaultWelcome from "./DefaultWelcome.tsx";

export default class Welcome extends React.PureComponent<EmptyObject> {
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
            body = <DefaultWelcome />;
        }

        return (
            <AuthPage>
                <div
                    className={classNames("mx_Welcome", {
                        mx_WelcomePage_registrationDisabled: !SettingsStore.getValue(UIFeature.Registration),
                    })}
                    data-testid="mx_welcome_screen"
                >
                    {body}
                    <hr />
                    <LanguageSelector />
                </div>
            </AuthPage>
        );
    }
}

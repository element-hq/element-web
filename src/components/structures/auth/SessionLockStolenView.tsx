/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";

import SplashPage from "../SplashPage";
import { _t } from "../../../languageHandler";
import SdkConfig from "../../../SdkConfig";

/**
 * Component shown by {@link MatrixChat} when another session is started in the same browser.
 */
export function SessionLockStolenView(): JSX.Element {
    const brand = SdkConfig.get().brand;

    return (
        <SplashPage className="mx_SessionLockStolenView">
            <h1>{_t("error_app_open_in_another_tab_title", { brand })}</h1>
            <h2>{_t("error_app_open_in_another_tab", { brand })}</h2>
        </SplashPage>
    );
}

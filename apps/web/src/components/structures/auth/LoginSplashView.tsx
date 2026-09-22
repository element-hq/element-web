/*
Copyright 2024 New Vector Ltd.
Copyright 2015-2024 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX } from "react";

import { messageForSyncError } from "../../../utils/ErrorUtils";
import Spinner from "../../views/elements/Spinner";
import AccessibleButton, { type ButtonEvent } from "../../views/elements/AccessibleButton";
import { _t } from "../../../languageHandler";

interface Props {
    /**
     * A callback function. Will be called if the user clicks the "logout" button on the splash screen.
     *
     * @param event - The click event
     */
    onLogoutClick: (this: void, event: ButtonEvent) => void;

    /**
     * Error that caused `/sync` to fail. If set, an error message will be shown on the splash screen.
     */
    syncError: Error | null;
}

/**
 * The view that is displayed after we have logged in, before the first /sync is completed.
 */
export function LoginSplashView(props: Props): JSX.Element {
    let errorBox: JSX.Element | undefined;
    if (props.syncError) {
        errorBox = <div className="mx_LoginSplashView_syncError">{messageForSyncError(props.syncError)}</div>;
    }

    return (
        <div className="mx_MatrixChat_splash">
            {errorBox}
            <Spinner />
            <div className="mx_LoginSplashView_splashButtons">
                <AccessibleButton kind="link_inline" onClick={props.onLogoutClick}>
                    {_t("action|logout")}
                </AccessibleButton>
            </div>
        </div>
    );
}

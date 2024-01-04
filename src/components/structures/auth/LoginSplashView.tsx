/*
Copyright 2015-2024 The Matrix.org Foundation C.I.C.

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

import React from "react";

import { messageForSyncError } from "../../../utils/ErrorUtils";
import Spinner from "../../views/elements/Spinner";
import AccessibleButton, { ButtonEvent } from "../../views/elements/AccessibleButton";
import { _t } from "../../../languageHandler";

interface Props {
    /**
     * A callback function. Will be called if the user clicks the "logout" button on the splash screen.
     *
     * @param event - The click event
     */
    onLogoutClick: (event: ButtonEvent) => void;

    /**
     * Error that caused `/sync` to fail. If set, an error message will be shown on the splash screen.
     */
    syncError: Error | null;
}

/**
 * The view that is displayed after we have logged in, before the first /sync is completed.
 */
export function LoginSplashView(props: Props): React.JSX.Element {
    let errorBox: React.JSX.Element | undefined;

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

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
import { CryptoEvent, MatrixClient } from "matrix-js-sdk/src/matrix";

import { messageForSyncError } from "../../../utils/ErrorUtils";
import Spinner from "../../views/elements/Spinner";
import ProgressBar from "../../views/elements/ProgressBar";
import AccessibleButton, { ButtonEvent } from "../../views/elements/AccessibleButton";
import { _t } from "../../../languageHandler";
import { useTypedEventEmitterState } from "../../../hooks/useEventEmitter";
import SdkConfig from "../../../SdkConfig";

interface Props {
    /** The matrix client which is logging in */
    matrixClient: MatrixClient;

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

type MigrationState = {
    progress: number;
    totalSteps: number;
};

/**
 * The view that is displayed after we have logged in, before the first /sync is completed.
 */
export function LoginSplashView(props: Props): React.JSX.Element {
    const migrationState = useTypedEventEmitterState(
        props.matrixClient,
        CryptoEvent.LegacyCryptoStoreMigrationProgress,
        (progress?: number, total?: number): MigrationState => ({ progress: progress ?? -1, totalSteps: total ?? -1 }),
    );
    let errorBox: React.JSX.Element | undefined;
    if (props.syncError) {
        errorBox = <div className="mx_LoginSplashView_syncError">{messageForSyncError(props.syncError)}</div>;
    }

    // If we are migrating the crypto data, show a progress bar. Otherwise, show a normal spinner.
    let spinnerOrProgress;
    if (migrationState.totalSteps !== -1) {
        spinnerOrProgress = (
            <div className="mx_LoginSplashView_migrationProgress">
                <p>{_t("migrating_crypto", { brand: SdkConfig.get().brand })}</p>
                <ProgressBar value={migrationState.progress} max={migrationState.totalSteps} />
            </div>
        );
    } else {
        spinnerOrProgress = <Spinner />;
    }

    return (
        <div className="mx_MatrixChat_splash">
            {errorBox}
            {spinnerOrProgress}
            <div className="mx_LoginSplashView_splashButtons">
                <AccessibleButton kind="link_inline" onClick={props.onLogoutClick}>
                    {_t("action|logout")}
                </AccessibleButton>
            </div>
        </div>
    );
}

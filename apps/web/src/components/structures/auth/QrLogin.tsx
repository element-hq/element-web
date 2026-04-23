/*
Copyright 2026 Element Creations Ltd.
SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type FC, type JSX, useCallback, useMemo } from "react";
import { RendezvousIntent } from "matrix-js-sdk/src/rendezvous";
import { createClient } from "matrix-js-sdk/src/matrix";

import AuthPage from "../../views/auth/AuthPage";
import AuthHeader from "../../views/auth/AuthHeader";
import AuthBody from "../../views/auth/AuthBody";
import { type ValidatedServerConfig } from "../../../utils/ValidatedServerConfig";
import type { IMatrixClientCreds } from "../../../MatrixClientPeg.ts";
import LoginWithQR from "../../views/auth/LoginWithQR.tsx";
import { Mode } from "../../views/auth/LoginWithQR-types.ts";
import { useAsyncMemo } from "../../../hooks/useAsyncMemo.ts";
import { getOidcClientId } from "../../../utils/oidc/registerClient.ts";
import SdkConfig from "../../../SdkConfig.ts";
import Spinner from "../../views/elements/Spinner.tsx";

interface Props {
    serverConfig: ValidatedServerConfig;
    isSyncing?: boolean;
    fragmentAfterLogin: string;
    defaultDeviceDisplayName?: string; // TODO is this useful?
    onLoggedIn(this: void, credentials: IMatrixClientCreds, alreadySignedIn: boolean): void;
}

const QrLogin: FC<Props> = ({ serverConfig, onLoggedIn }) => {
    const tempClient = useMemo(() => createClient({ baseUrl: serverConfig.hsUrl }), [serverConfig]);
    const onFinished = useCallback(
        (success: boolean, credentials?: IMatrixClientCreds) => {
            if (success) {
                onLoggedIn(credentials!, true);
            } else {
                // TODO handle
            }
        },
        [onLoggedIn],
    );
    const clientId = useAsyncMemo(
        () => getOidcClientId(serverConfig.delegatedAuthentication!, SdkConfig.get().oidc_static_clients),
        [serverConfig],
    );

    let body: JSX.Element;
    if (clientId === undefined) {
        body = <Spinner />;
    } else {
        body = (
            <LoginWithQR
                intent={RendezvousIntent.LOGIN_ON_NEW_DEVICE}
                client={tempClient}
                onFinished={onFinished}
                mode={Mode.Show}
                clientId={clientId}
            />
        );
    }

    // TODO className
    return (
        <AuthPage>
            <AuthHeader />
            <AuthBody className="mx_AuthBody_forgot-password">{body}</AuthBody>
        </AuthPage>
    );
};

export default QrLogin;

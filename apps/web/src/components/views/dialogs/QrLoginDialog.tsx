/*
Copyright 2026 Element Creations Ltd.
SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type FC, useMemo, useState } from "react";
import { RendezvousIntent } from "matrix-js-sdk/src/rendezvous";
import { createClient } from "matrix-js-sdk/src/matrix";

import { type ValidatedServerConfig } from "../../../utils/ValidatedServerConfig";
import LoginWithQR, { type QrLoginCredentials } from "../../views/auth/LoginWithQR.tsx";
import { Mode, Phase } from "../../views/auth/LoginWithQR-types.ts";
import { useAsyncMemo } from "../../../hooks/useAsyncMemo.ts";
import { getOidcClientId } from "../../../utils/oidc/registerClient.ts";
import SdkConfig from "../../../SdkConfig.ts";
import BaseDialog from "./BaseDialog.tsx";
import { _t } from "../../../languageHandler.tsx";

interface Props {
    serverConfig: ValidatedServerConfig;
    onFinished(this: void): void;
    onLoggedIn(this: void, credentials: QrLoginCredentials): Promise<void>;
}

const QrLoginDialog: FC<Props> = ({ serverConfig, onLoggedIn, onFinished }) => {
    const tempClient = useMemo(() => createClient({ baseUrl: serverConfig.hsUrl }), [serverConfig]);
    const clientId = useAsyncMemo(
        () => getOidcClientId(serverConfig.delegatedAuthentication!, SdkConfig.get().oidc_static_clients),
        [serverConfig],
    );

    const [phase, setPhase] = useState<Phase>();

    const hasCancel = phase === Phase.ShowingQR;

    return (
        <BaseDialog
            onFinished={onFinished}
            hasCancel={hasCancel}
            aria-label={_t("auth|sign_in_with_qr")}
            fixedWidth={false}
        >
            <LoginWithQR
                intent={RendezvousIntent.LOGIN_ON_NEW_DEVICE}
                clientId={clientId}
                client={tempClient}
                onFinished={onFinished}
                onLoggedIn={onLoggedIn}
                mode={Mode.Show}
                onPhaseChange={setPhase}
            />
        </BaseDialog>
    );
};

export default QrLoginDialog;

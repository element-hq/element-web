/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type FC, useMemo, useState } from "react";
import { RendezvousIntent } from "matrix-js-sdk/src/rendezvous";
import { createClient } from "matrix-js-sdk/src/matrix";

import { type ValidatedServerConfig } from "../../../utils/ValidatedServerConfig";
import LoginWithQR, { type QrLoginCredentials } from "../../../components/views/auth/LoginWithQR.tsx";
import { Mode, Phase } from "../../../components/views/auth/LoginWithQR-types.ts";
import BaseDialog from "../../../components/views/dialogs/BaseDialog.tsx";
import { _t } from "../../../languageHandler.tsx";

interface Props {
    /**
     * The server config to use for QR code login
     */
    serverConfig: ValidatedServerConfig;

    /**
     * Handler for when the dialog is to be closed
     */
    onFinished(this: void): void;

    /**
     * Handler for successful completion of QR Login
     * @param credentials - the credentials to log in with
     */
    onLoggedIn(this: void, credentials: QrLoginCredentials): Promise<void>;
}

/**
 * Dialog for facilitating the Login with QR flow, shown from DefaultWelcome.
 */
const QrLoginDialog: FC<Props> = ({ serverConfig, onLoggedIn, onFinished }) => {
    const tempClient = useMemo(() => createClient({ baseUrl: serverConfig.hsUrl }), [serverConfig]);

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

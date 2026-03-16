/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import {
    type IServerVersions,
    type OidcClientConfig,
    type MatrixClient,
    OAuthGrantType,
} from "matrix-js-sdk/src/matrix";
import { isSignInWithQRAvailable } from "matrix-js-sdk/src/rendezvous";
import QrCodeIcon from "@vector-im/compound-design-tokens/assets/web/icons/qr-code";
import { Text } from "@vector-im/compound-web";

import { _t } from "../../../../languageHandler";
import AccessibleButton from "../../elements/AccessibleButton";
import { SettingsSubsection } from "../shared/SettingsSubsection";
import { useMatrixClientContext } from "../../../../contexts/MatrixClientContext";
import { useAsyncMemo } from "../../../../hooks/useAsyncMemo";

interface IProps {
    onShowQr: () => void;
    versions?: IServerVersions;
    oidcClientConfig?: OidcClientConfig;
    isCrossSigningReady?: boolean;
}

export async function shouldShowQrForLinkNewDevice(
    cli: MatrixClient,
    isCrossSigningReady: boolean,
    oidcClientConfig?: OidcClientConfig,
    versions?: IServerVersions,
): Promise<boolean> {
    // support MSC4108 v2025 which uses MSC4388
    const msc4108v2025Available = await isSignInWithQRAvailable(cli);

    // support MSC4108 v2024
    const msc4108Supported = !!versions?.unstable_features?.["org.matrix.msc4108"];

    const deviceAuthorizationGrantSupported = oidcClientConfig?.grant_types_supported.includes(
        OAuthGrantType.DeviceAuthorization,
    );

    return (
        !!deviceAuthorizationGrantSupported &&
        (msc4108Supported || msc4108v2025Available) &&
        !!cli.getCrypto()?.exportSecretsBundle &&
        isCrossSigningReady
    );
}

const LoginWithQRSection: React.FC<IProps> = ({ onShowQr, versions, oidcClientConfig, isCrossSigningReady }) => {
    const cli = useMatrixClientContext();
    const offerShowQr = useAsyncMemo(
        () => shouldShowQrForLinkNewDevice(cli, !!isCrossSigningReady, oidcClientConfig, versions),
        [cli, isCrossSigningReady, oidcClientConfig, versions],
        false,
    );

    return (
        <SettingsSubsection heading={_t("settings|sessions|sign_in_with_qr")}>
            <div className="mx_LoginWithQRSection">
                <p className="mx_SettingsTab_subsectionText">{_t("settings|sessions|sign_in_with_qr_description")}</p>
                <AccessibleButton onClick={onShowQr} kind="primary" disabled={!offerShowQr}>
                    <QrCodeIcon height={20} width={20} />
                    {_t("settings|sessions|sign_in_with_qr_button")}
                </AccessibleButton>
                {!offerShowQr && <Text size="sm">{_t("settings|sessions|sign_in_with_qr_unsupported")}</Text>}
            </div>
        </SettingsSubsection>
    );
};

export default LoginWithQRSection;

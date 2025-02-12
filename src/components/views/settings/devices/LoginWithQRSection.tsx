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
    DEVICE_CODE_SCOPE,
} from "matrix-js-sdk/src/matrix";
import QrCodeIcon from "@vector-im/compound-design-tokens/assets/web/icons/qr-code";
import { Text } from "@vector-im/compound-web";

import { _t } from "../../../../languageHandler";
import AccessibleButton from "../../elements/AccessibleButton";
import { SettingsSubsection } from "../shared/SettingsSubsection";
import { useMatrixClientContext } from "../../../../contexts/MatrixClientContext";

interface IProps {
    onShowQr: () => void;
    versions?: IServerVersions;
    oidcClientConfig?: OidcClientConfig;
    isCrossSigningReady?: boolean;
}

export function shouldShowQr(
    cli: MatrixClient,
    isCrossSigningReady: boolean,
    oidcClientConfig?: OidcClientConfig,
    versions?: IServerVersions,
): boolean {
    const msc4108Supported = !!versions?.unstable_features?.["org.matrix.msc4108"];

    const deviceAuthorizationGrantSupported = oidcClientConfig?.grant_types_supported.includes(DEVICE_CODE_SCOPE);

    return (
        !!deviceAuthorizationGrantSupported &&
        msc4108Supported &&
        !!cli.getCrypto()?.exportSecretsBundle &&
        isCrossSigningReady
    );
}

const LoginWithQRSection: React.FC<IProps> = ({ onShowQr, versions, oidcClientConfig, isCrossSigningReady }) => {
    const cli = useMatrixClientContext();
    const offerShowQr = shouldShowQr(cli, !!isCrossSigningReady, oidcClientConfig, versions);

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

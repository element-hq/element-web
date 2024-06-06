/*
Copyright 2022 The Matrix.org Foundation C.I.C.

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
import {
    IGetLoginTokenCapability,
    IServerVersions,
    GET_LOGIN_TOKEN_CAPABILITY,
    Capabilities,
    IClientWellKnown,
    OidcClientConfig,
    MatrixClient,
    DEVICE_CODE_SCOPE,
} from "matrix-js-sdk/src/matrix";
import { Icon as QrCodeIcon } from "@vector-im/compound-design-tokens/icons/qr-code.svg";

import { _t } from "../../../../languageHandler";
import AccessibleButton from "../../elements/AccessibleButton";
import SettingsSubsection from "../shared/SettingsSubsection";
import SettingsStore from "../../../../settings/SettingsStore";
import { Features } from "../../../../settings/Settings";
import { useMatrixClientContext } from "../../../../contexts/MatrixClientContext";

interface IProps {
    onShowQr: () => void;
    versions?: IServerVersions;
    capabilities?: Capabilities;
    wellKnown?: IClientWellKnown;
    oidcClientConfig?: OidcClientConfig;
    isCrossSigningReady?: boolean;
}

function shouldShowQrLegacy(
    versions?: IServerVersions,
    wellKnown?: IClientWellKnown,
    capabilities?: Capabilities,
): boolean {
    // Needs server support for (get_login_token or OIDC Device Authorization Grant) and MSC3886:
    // in r0 of MSC3882 it is exposed as a feature flag, but in stable and unstable r1 it is a capability
    const loginTokenCapability = GET_LOGIN_TOKEN_CAPABILITY.findIn<IGetLoginTokenCapability>(capabilities);
    const getLoginTokenSupported =
        !!versions?.unstable_features?.["org.matrix.msc3882"] || !!loginTokenCapability?.enabled;
    const msc3886Supported =
        !!versions?.unstable_features?.["org.matrix.msc3886"] || !!wellKnown?.["io.element.rendezvous"]?.server;
    return getLoginTokenSupported && msc3886Supported;
}

export function shouldShowQr(
    cli: MatrixClient,
    isCrossSigningReady: boolean,
    oidcClientConfig?: OidcClientConfig,
    versions?: IServerVersions,
    wellKnown?: IClientWellKnown,
): boolean {
    const msc4108Supported =
        !!versions?.unstable_features?.["org.matrix.msc4108"] || !!wellKnown?.["io.element.rendezvous"]?.server;

    const deviceAuthorizationGrantSupported =
        oidcClientConfig?.metadata?.grant_types_supported.includes(DEVICE_CODE_SCOPE);

    return (
        deviceAuthorizationGrantSupported &&
        msc4108Supported &&
        SettingsStore.getValue(Features.OidcNativeFlow) &&
        !!cli.getCrypto()?.exportSecretsBundle &&
        isCrossSigningReady
    );
}

const LoginWithQRSection: React.FC<IProps> = ({
    onShowQr,
    versions,
    capabilities,
    wellKnown,
    oidcClientConfig,
    isCrossSigningReady,
}) => {
    const cli = useMatrixClientContext();
    const offerShowQr = oidcClientConfig
        ? shouldShowQr(cli, !!isCrossSigningReady, oidcClientConfig, versions, wellKnown)
        : shouldShowQrLegacy(versions, wellKnown, capabilities);

    // don't show anything if no method is available
    if (!offerShowQr) {
        return null;
    }

    return (
        <SettingsSubsection heading={_t("settings|sessions|sign_in_with_qr")}>
            <div className="mx_LoginWithQRSection">
                <p className="mx_SettingsTab_subsectionText">{_t("settings|sessions|sign_in_with_qr_description")}</p>
                <AccessibleButton onClick={onShowQr} kind="primary">
                    <QrCodeIcon height={20} width={20} />
                    {_t("settings|sessions|sign_in_with_qr_button")}
                </AccessibleButton>
            </div>
        </SettingsSubsection>
    );
};

export default LoginWithQRSection;

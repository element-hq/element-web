/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX } from "react";
import { Button, Heading, Text } from "@vector-im/compound-web";
import { isSignInWithQRAvailable } from "matrix-js-sdk/src/rendezvous";
import { createClient } from "matrix-js-sdk/src/matrix";
import { QrCodeIcon } from "@vector-im/compound-design-tokens/assets/web/icons";

import { _t } from "../../../languageHandler";
import SdkConfig from "../../../SdkConfig.ts";
import { MatrixClientPeg } from "../../../MatrixClientPeg.ts";
import { isElementBranded } from "../../../branding.ts";
import { useFeatureEnabled } from "../../../hooks/useSettings.ts";
import { type ValidatedServerConfig } from "../../../utils/ValidatedServerConfig.ts";
import { useAsyncMemo } from "../../../hooks/useAsyncMemo.ts";
import Spinner from "../elements/Spinner.tsx";

interface Props {
    serverConfig: ValidatedServerConfig;
}

const DefaultWelcome: React.FC<Props> = ({ serverConfig }) => {
    const brand = SdkConfig.get("brand");
    const branding = SdkConfig.getObject("branding");
    const logoUrl = branding.get("auth_header_logo_url");

    const showGuestFunctions = !!MatrixClientPeg.get();
    const isElement = isElementBranded();

    const isQrLoginEnabled = useFeatureEnabled("feature_login_with_qr");
    const showQrButton = useAsyncMemo(async () => {
        if (!isQrLoginEnabled) return false;
        const tempClient = createClient({
            baseUrl: serverConfig.hsUrl,
        });
        return isSignInWithQRAvailable(tempClient);
    }, [serverConfig, isQrLoginEnabled]);

    const loading = isQrLoginEnabled && showQrButton === undefined;

    let body: JSX.Element;
    if (loading) {
        body = <Spinner />;
    } else {
        body = (
            <div className="mx_DefaultWelcome_buttons">
                {showQrButton && (
                    <Button as="a" href="#/qr_login" kind="primary" size="md" Icon={QrCodeIcon}>
                        {_t("auth|sign_in_with_qr")}
                    </Button>
                )}
                <Button as="a" href="#/login" kind="primary" size="md">
                    {showQrButton ? _t("auth|sign_in_manually") : _t("action|sign_in")}
                </Button>
                <Button as="a" href="#/register" kind="secondary" size="md">
                    {_t("action|create_account")}
                </Button>
                {showGuestFunctions && (
                    <Button as="a" href="#/directory" kind="tertiary" size="md">
                        {_t("action|explore_rooms")}
                    </Button>
                )}
            </div>
        );
    }

    return (
        <div className="mx_DefaultWelcome">
            <a href={branding.get("logo_link_url")} target="_blank" rel="noopener" className="mx_DefaultWelcome_logo">
                <img src={logoUrl} alt={brand} />
            </a>
            <Heading as="h1" weight="semibold">
                {isElement ? _t("welcome|title_element") : _t("welcome|title_generic", { brand })}
            </Heading>
            {isElement && <Text size="md">{_t("welcome|tagline_element")}</Text>}

            {body}
        </div>
    );
};

export default DefaultWelcome;

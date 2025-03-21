/*
Copyright 2024 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX } from "react";
import { chunk } from "lodash";
import classNames from "classnames";
import {
    type MatrixClient,
    IdentityProviderBrand,
    type SSOFlow,
    type SSOAction,
    type IIdentityProvider,
    DELEGATED_OIDC_COMPATIBILITY,
} from "matrix-js-sdk/src/matrix";
import { type Signup } from "@matrix-org/analytics-events/types/typescript/Signup";

import PlatformPeg from "../../../PlatformPeg";
import AccessibleButton from "./AccessibleButton";
import { _t } from "../../../languageHandler";
import { mediaFromMxc } from "../../../customisations/Media";
import { PosthogAnalytics } from "../../../PosthogAnalytics";

interface ISSOButtonProps extends IProps {
    idp?: IIdentityProvider;
    mini?: boolean;
    action?: SSOAction;
}

const getIcon = (brand: IdentityProviderBrand | string): string | null => {
    switch (brand) {
        /* eslint-disable @typescript-eslint/no-require-imports */
        case IdentityProviderBrand.Apple:
            return require(`../../../../res/img/element-icons/brands/apple.svg`).default;
        case IdentityProviderBrand.Facebook:
            return require(`../../../../res/img/element-icons/brands/facebook.svg`).default;
        case IdentityProviderBrand.Github:
            return require(`../../../../res/img/element-icons/brands/github.svg`).default;
        case IdentityProviderBrand.Gitlab:
            return require(`../../../../res/img/element-icons/brands/gitlab.svg`).default;
        case IdentityProviderBrand.Google:
            return require(`../../../../res/img/element-icons/brands/google.svg`).default;
        case IdentityProviderBrand.Twitter:
            return require(`../../../../res/img/element-icons/brands/twitter.svg`).default;
        default:
            return null;
        /* eslint-enable @typescript-eslint/no-require-imports */
    }
};

const getAuthenticationType = (brand: IdentityProviderBrand | string): Signup["authenticationType"] => {
    switch (brand) {
        case IdentityProviderBrand.Apple:
            return "Apple";
        case IdentityProviderBrand.Facebook:
            return "Facebook";
        case IdentityProviderBrand.Github:
            return "GitHub";
        case IdentityProviderBrand.Gitlab:
            return "GitLab";
        case IdentityProviderBrand.Google:
            return "Google";
        // Not supported on the analytics SDK at the moment.
        // case IdentityProviderBrand.Twitter:
        //     return "Twitter";
        default:
            return "SSO";
    }
};

const SSOButton: React.FC<ISSOButtonProps> = ({
    matrixClient,
    loginType,
    fragmentAfterLogin,
    idp,
    primary,
    mini,
    action,
    flow,
    ...props
}) => {
    let label: string;
    if (idp) {
        label = _t("auth|continue_with_idp", { provider: idp.name });
    } else if (DELEGATED_OIDC_COMPATIBILITY.findIn<boolean>(flow)) {
        label = _t("action|continue");
    } else {
        label = _t("auth|sign_in_with_sso");
    }

    const onClick = (): void => {
        const authenticationType = getAuthenticationType(idp?.brand ?? "");
        PosthogAnalytics.instance.setAuthenticationType(authenticationType);
        PlatformPeg.get()?.startSingleSignOn(matrixClient, loginType, fragmentAfterLogin, idp?.id, action);
    };

    let icon: JSX.Element | undefined;
    let brandClass: string | undefined;
    const brandIcon = idp?.brand ? getIcon(idp.brand) : null;
    if (idp?.brand && brandIcon) {
        const brandName = idp.brand.split(".").pop();
        brandClass = `mx_SSOButton_brand_${brandName}`;
        icon = <img src={brandIcon} height="24" width="24" alt={brandName} />;
    } else if (typeof idp?.icon === "string" && idp.icon.startsWith("mxc://")) {
        const src = mediaFromMxc(idp.icon, matrixClient).getSquareThumbnailHttp(24) ?? undefined;
        icon = <img src={src} height="24" width="24" alt={idp.name} />;
    }

    const brandPart = brandClass ? { [brandClass]: brandClass } : undefined;
    const classes = classNames(
        "mx_SSOButton",
        {
            mx_SSOButton_mini: mini,
            mx_SSOButton_default: !idp,
            mx_SSOButton_primary: primary,
        },
        brandPart,
    );

    if (mini) {
        // TODO fallback icon
        return (
            <AccessibleButton {...props} title={label} className={classes} onClick={onClick}>
                {icon}
            </AccessibleButton>
        );
    }

    return (
        <AccessibleButton {...props} className={classes} onClick={onClick}>
            {icon}
            {label}
        </AccessibleButton>
    );
};

interface IProps {
    matrixClient: MatrixClient;
    flow: SSOFlow;
    loginType: "sso" | "cas";
    fragmentAfterLogin?: string;
    primary?: boolean;
    action?: SSOAction;
    disabled?: boolean;
}

const MAX_PER_ROW = 6;

const SSOButtons: React.FC<IProps> = ({
    matrixClient,
    flow,
    loginType,
    fragmentAfterLogin,
    primary,
    action,
    disabled,
}) => {
    const providers = flow.identity_providers || [];
    if (providers.length < 2) {
        return (
            <div className="mx_SSOButtons">
                <SSOButton
                    matrixClient={matrixClient}
                    loginType={loginType}
                    fragmentAfterLogin={fragmentAfterLogin}
                    idp={providers[0]}
                    primary={primary}
                    action={action}
                    flow={flow}
                    disabled={disabled}
                />
            </div>
        );
    }

    const rows = Math.ceil(providers.length / MAX_PER_ROW);
    const size = Math.ceil(providers.length / rows);

    return (
        <div className="mx_SSOButtons">
            {chunk(providers, size).map((chunk) => (
                <div key={chunk[0].id} className="mx_SSOButtons_row">
                    {chunk.map((idp) => (
                        <SSOButton
                            key={idp.id}
                            matrixClient={matrixClient}
                            loginType={loginType}
                            fragmentAfterLogin={fragmentAfterLogin}
                            idp={idp}
                            mini={true}
                            primary={primary}
                            action={action}
                            flow={flow}
                        />
                    ))}
                </div>
            ))}
        </div>
    );
};

export default SSOButtons;

/*
Copyright 2024 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type ComponentProps, type JSX } from "react";
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
import { Button, Tooltip } from "@vector-im/compound-web";
import { MacIcon } from "@vector-im/compound-design-tokens/assets/web/icons";

import PlatformPeg from "../../../PlatformPeg";
import { _t } from "../../../languageHandler";
import { mediaFromMxc } from "../../../customisations/Media";
import { PosthogAnalytics } from "../../../PosthogAnalytics";
import { Icon as FacebookIcon } from "../../../../res/img/element-icons/brands/facebook.svg";
import { Icon as GithubIcon } from "../../../../res/img/element-icons/brands/github.svg";
import { Icon as GitlabIcon } from "../../../../res/img/element-icons/brands/gitlab.svg";
import { Icon as GoogleIcon } from "../../../../res/img/element-icons/brands/google.svg";
import { Icon as TwitterIcon } from "../../../../res/img/element-icons/brands/twitter.svg";

interface ISSOButtonProps extends IProps {
    idp?: IIdentityProvider;
    mini?: boolean;
    action?: SSOAction;
}

const getIcon = (brand: IdentityProviderBrand | string): typeof FacebookIcon | null => {
    switch (brand) {
        case IdentityProviderBrand.Apple:
            return MacIcon;
        case IdentityProviderBrand.Facebook:
            return FacebookIcon;
        case IdentityProviderBrand.Github:
            return GithubIcon;
        case IdentityProviderBrand.Gitlab:
            return GitlabIcon;
        case IdentityProviderBrand.Google:
            return GoogleIcon;
        case IdentityProviderBrand.Twitter:
            return TwitterIcon;
        default:
            return null;
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
    mini: iconOnly,
    action,
    flow,
    disabled,
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

    const commonProps: Partial<ComponentProps<typeof Button>> & Record<`data-${string}`, string> = {
        iconOnly,
        className: classNames("mx_SSOButton", {
            mx_SSOButton_mini: iconOnly,
        }),
        onClick,
        kind: primary ? "primary" : "secondary",
        disabled,
    };

    let icon: JSX.Element | undefined;
    const BrandIcon = idp?.brand ? getIcon(idp.brand) : null;
    if (idp?.brand && BrandIcon) {
        const brandName = idp.brand.split(".").pop();
        icon = <BrandIcon aria-label={brandName} />;
        commonProps["data-testid"] = `idp-${idp.id}`;
    } else if (typeof idp?.icon === "string" && idp.icon.startsWith("mxc://")) {
        const src = mediaFromMxc(idp.icon, matrixClient).getSquareThumbnailHttp(24) ?? undefined;
        icon = <img src={src} alt={idp.name} />;
    }

    // TODO fallback icon
    if (iconOnly) {
        return (
            <Tooltip label={label}>
                <Button {...commonProps} size="lg">
                    {icon}
                </Button>
            </Tooltip>
        );
    }

    return (
        <Button {...commonProps} size="sm">
            {icon}
            {label}
        </Button>
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
